import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY_RUN = !APPLY;
const CHUNK_SIZE = 400;
const EVENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

function resolveProjectId() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!credPath) return null;
  try {
    const parsed = JSON.parse(readFileSync(credPath, "utf8"));
    return parsed?.project_id || null;
  } catch {
    return null;
  }
}

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw || raw === "default" || raw === "(default)") return undefined;
  return raw;
}

function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function normalizeFamiliares(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((f) => ({
      parentesco_id: String(f?.parentesco_id || "").trim(),
      parentesco_otro_detalle: String(f?.parentesco_otro_detalle || "").trim(),
      nombre: String(f?.nombre || "").trim(),
      apellido: String(f?.apellido || "").trim(),
      dni: String(f?.dni || "").trim(),
      fecha_nacimiento: String(f?.fecha_nacimiento || "").trim(),
      convive: f?.convive === true,
      domicilio_familiar: String(f?.domicilio_familiar || "").trim(),
      dependiente: f?.dependiente === true,
      detalle_dependencia: String(f?.detalle_dependencia || f?.dependiente_detalle || "").trim(),
      discapacidad_declarada: f?.discapacidad_declarada === true,
      notas_titular: String(f?.notas_titular || "").trim(),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function buildDdjjSignature(data) {
  const estado = String(data?.estado_declaracion_id || "").trim().toUpperCase();
  const aceptada = data?.declaracion_jurada_aceptada === true;
  const familiares = normalizeFamiliares(data?.familiares);
  return JSON.stringify({ estado, aceptada, familiares });
}

function buildEventoSignature(data) {
  const tipo = String(data?.tipo_evento_id || "").trim().toUpperCase();
  const tipoCfg = String(data?.tipo_evento_cfg_id || "").trim().toLowerCase();
  const persona = String(data?.persona_id || "").trim();
  const accion = String(data?.payload?.accion || "").trim().toLowerCase();
  const cambios = Array.isArray(data?.payload?.cambios)
    ? data.payload.cambios.map((c) => ({
        campo: String(c?.campo || "").trim(),
        anterior: c?.anterior ?? null,
        nuevo: c?.nuevo ?? null,
      }))
    : [];
  return JSON.stringify({ tipo, tipoCfg, persona, accion, cambios });
}

function pickCanonicalDdjj(docs) {
  const sorted = [...docs].sort((a, b) => {
    const aData = a.data() || {};
    const bData = b.data() || {};
    const aPresentada = String(aData.estado_declaracion_id || "").trim().toUpperCase() === "CFG_DDJJ_03_PRESENTADA";
    const bPresentada = String(bData.estado_declaracion_id || "").trim().toUpperCase() === "CFG_DDJJ_03_PRESENTADA";
    if (aPresentada !== bPresentada) return aPresentada ? -1 : 1;
    const ta = toEpochMs(aData.actualizado_en) || toEpochMs(aData.creado_en);
    const tb = toEpochMs(bData.actualizado_en) || toEpochMs(bData.creado_en);
    if (tb !== ta) return tb - ta;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  return sorted[0];
}

async function commitInChunks(db, ops) {
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    for (const op of chunk) {
      batch.set(op.ref, op.data, { merge: true });
    }
    await batch.commit();
  }
}

async function main() {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error(
      "No se pudo resolver projectId. Definí FIREBASE_V2_PROJECT_ID o GOOGLE_APPLICATION_CREDENTIALS válido.",
    );
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId,
      credential: admin.credential.applicationDefault(),
    });
  }

  const databaseId = resolveNonDefaultDatabaseId();
  const db = databaseId ? getFirestore(admin.app(), databaseId) : getFirestore();
  const nowIso = new Date().toISOString();

  console.log(`[normalize:ddjj-dup] mode=${DRY_RUN ? "dry-run" : "apply"} project=${projectId} database=${databaseId || "default"}`);

  const ddjjSnap = await db.collection("declaraciones_grupo_familiar").get();
  const groupedDdjj = new Map();
  for (const doc of ddjjSnap.docs) {
    const d = doc.data() || {};
    const titular = String(d.titular_persona_id || "").trim();
    const version = Number(d.declaracion_version) || 0;
    if (!titular || version <= 0) continue;
    const key = `${titular}::${version}`;
    if (!groupedDdjj.has(key)) groupedDdjj.set(key, []);
    groupedDdjj.get(key).push(doc);
  }

  const ddjjDuplicados = [...groupedDdjj.entries()].filter(([, docs]) => docs.length > 1);
  const ddjjOps = [];
  let ddjjMarcados = 0;

  for (const [groupKey, docs] of ddjjDuplicados) {
    const canonical = pickCanonicalDdjj(docs);
    const canonicalData = canonical.data() || {};
    const canonicalSig = buildDdjjSignature(canonicalData);
    for (const doc of docs) {
      if (doc.id === canonical.id) continue;
      const data = doc.data() || {};
      const sameContent = buildDdjjSignature(data) === canonicalSig;
      ddjjOps.push({
        ref: doc.ref,
        data: {
          duplicado_de_id: canonical.id,
          dedupe_bucket_id: groupKey,
          duplicado_detectado_en: nowIso,
          duplicado_contenido_igual: sameContent,
          saneamiento_ddjj_v2: {
            estado: "duplicado",
            canonical_id: canonical.id,
            bucket: groupKey,
            run_at: nowIso,
          },
          actualizado_en: FieldValue.serverTimestamp(),
        },
      });
      ddjjMarcados += 1;
    }
  }

  const eventosSnap = await db.collection("eventos_ticket").get();
  const eventosDdjj = eventosSnap.docs.filter((doc) => {
    const d = doc.data() || {};
    const tipo = String(d.tipo_evento_id || "").trim().toUpperCase();
    return tipo === "EVT_DATOS_ALTA_DDJJ" || tipo === "EVT_DATOS_ACTUALIZA_DDJJ";
  });

  const eventosByPersona = new Map();
  for (const doc of eventosDdjj) {
    const d = doc.data() || {};
    const persona = String(d.persona_id || "").trim();
    if (!persona) continue;
    if (!eventosByPersona.has(persona)) eventosByPersona.set(persona, []);
    eventosByPersona.get(persona).push(doc);
  }

  const eventosOps = [];
  let eventosMarcados = 0;
  let gruposEventosDuplicados = 0;

  for (const [personaId, docs] of eventosByPersona.entries()) {
    const sorted = [...docs].sort((a, b) => toEpochMs((a.data() || {}).ocurrido_en) - toEpochMs((b.data() || {}).ocurrido_en));
    let cursor = 0;
    while (cursor < sorted.length) {
      const base = sorted[cursor];
      const baseData = base.data() || {};
      const baseTime = toEpochMs(baseData.ocurrido_en);
      const baseSig = buildEventoSignature(baseData);
      const cluster = [base];
      let j = cursor + 1;
      while (j < sorted.length) {
        const cand = sorted[j];
        const candData = cand.data() || {};
        const candTime = toEpochMs(candData.ocurrido_en);
        if (candTime - baseTime > EVENT_WINDOW_MS) break;
        if (buildEventoSignature(candData) === baseSig) {
          cluster.push(cand);
        }
        j += 1;
      }

      if (cluster.length > 1) {
        gruposEventosDuplicados += 1;
        const keeper = cluster[0];
        for (const dup of cluster.slice(1)) {
          eventosOps.push({
            ref: dup.ref,
            data: {
              estado_bandeja_rrhh_id: "cfg_ebr_arch",
              saneamiento_ddjj_v2: {
                estado: "evento_duplicado_archivado",
                canonical_evento_id: keeper.id,
                persona_id: personaId,
                run_at: nowIso,
              },
              actualizado_en: FieldValue.serverTimestamp(),
            },
          });
          eventosMarcados += 1;
        }
      }

      cursor += 1;
    }
  }

  const summary = {
    mode: DRY_RUN ? "dry-run" : "apply",
    ddjj_total: ddjjSnap.size,
    ddjj_grupos_duplicados: ddjjDuplicados.length,
    ddjj_docs_marcados_duplicado: ddjjMarcados,
    eventos_ddjj_total: eventosDdjj.length,
    eventos_grupos_duplicados: gruposEventosDuplicados,
    eventos_marcados_archivados: eventosMarcados,
    window_ms: EVENT_WINDOW_MS,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (DRY_RUN) return;

  await commitInChunks(db, [...ddjjOps, ...eventosOps]);
  console.log(
    JSON.stringify(
      {
        ...summary,
        committed_ops: ddjjOps.length + eventosOps.length,
        message: "Saneamiento aplicado (sin borrado físico).",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[normalize:ddjj-dup] ERROR", err?.message || err);
  process.exit(1);
});
