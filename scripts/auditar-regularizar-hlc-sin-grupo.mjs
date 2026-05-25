import "./load-env-v2.mjs";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en entorno (.env.v2.local).");
  process.exit(1);
}

if (!admin.apps.length) {
  const projectId =
    process.env.FIREBASE_V2_PROJECT_ID?.trim() ||
    JSON.parse(readFileSync(credPath, "utf8")).project_id;
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();

function parseArgs(argv) {
  const raw = argv.slice(2);
  const args = new Set(raw);
  const getValue = (flag) => {
    const idx = raw.indexOf(flag);
    if (idx < 0) return "";
    return String(raw[idx + 1] || "").trim();
  };
  return {
    apply: args.has("--apply"),
    onlyAbiertos: args.has("--solo-abiertos"),
    hlcId: getValue("--hlc-id"),
    grupoId: getValue("--grupo-id"),
  };
}

function hasValue(v) {
  return v != null && String(v).trim() !== "";
}

function toDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function isAbierto(fechaHasta) {
  return !hasValue(fechaHasta);
}

async function main() {
  const { apply, onlyAbiertos, hlcId, grupoId } = parseArgs(process.argv);
  const mode = apply ? "APPLY" : "DRY_RUN";

  const hasModoPuntual = Boolean(hlcId || grupoId);
  if (hasModoPuntual && (!hlcId || !grupoId)) {
    throw new Error("Modo puntual inválido: debés enviar ambos --hlc-id y --grupo-id.");
  }

  const [hlcSnap, hldSnap, hlgSnap] = await Promise.all([
    db.collection("historial_laboral_cargos").get(),
    db.collection("historial_laboral_datos").get(),
    db.collection("historial_laboral_grupos").get(),
  ]);

  const hldByCargo = new Map();
  hldSnap.docs.forEach((doc) => {
    const cargoId = String(doc.get("cargo_id") || "").trim();
    if (!cargoId) return;
    const list = hldByCargo.get(cargoId) || [];
    list.push({ id: doc.id, ...doc.data() });
    hldByCargo.set(cargoId, list);
  });

  const hlgByDato = new Map();
  hlgSnap.docs.forEach((doc) => {
    const datoId = String(doc.get("dato_laboral_id") || "").trim();
    if (!datoId) return;
    const list = hlgByDato.get(datoId) || [];
    list.push({ id: doc.id, ...doc.data() });
    hlgByDato.set(datoId, list);
  });

  const candidatos = [];

  for (const cargoDoc of hlcSnap.docs) {
    const cargo = cargoDoc.data() || {};
    const cargoId = cargoDoc.id;
    const personaId = String(cargo.persona_id || "").trim();
    const grupoActual = String(cargo.grupo_de_trabajo_id || "").trim();
    const fechaHasta = toDateKey(cargo.fecha_hasta);

    if (hasValue(grupoActual)) continue;
    if (onlyAbiertos && !isAbierto(fechaHasta)) continue;

    const hldRows = hldByCargo.get(cargoId) || [];
    const gruposDetectados = new Set();
    const evidencias = [];

    hldRows.forEach((hld) => {
      const hlgRows = hlgByDato.get(String(hld.id)) || [];
      hlgRows.forEach((hlg) => {
        const grupoId = String(hlg.grupo_de_trabajo_id || "").trim();
        if (!grupoId) return;
        gruposDetectados.add(grupoId);
        evidencias.push({
          hld_id: hld.id,
          hlg_id: hlg.id,
          grupo_de_trabajo_id: grupoId,
          fecha_inicio: toDateKey(hlg.fecha_inicio),
          fecha_fin: toDateKey(hlg.fecha_fin),
        });
      });
    });

    const grupos = [...gruposDetectados];
    let resolucion = "SIN_CANDIDATO";
    let grupoSugerido = null;

    if (grupos.length === 1) {
      resolucion = "CANDIDATO_UNICO";
      [grupoSugerido] = grupos;
    } else if (grupos.length > 1) {
      resolucion = "AMBIGUO_MULTIPLES_GRUPOS";
    }

    candidatos.push({
      hlc_id: cargoId,
      persona_id: personaId || null,
      fecha_desde: toDateKey(cargo.fecha_desde),
      fecha_hasta: fechaHasta || null,
      abierto: isAbierto(fechaHasta),
      grupos_detectados: grupos,
      grupo_sugerido: grupoSugerido,
      resolucion,
      evidencias: evidencias.slice(0, 10),
    });
  }

  const paraRegularizarAuto = candidatos.filter((x) => x.resolucion === "CANDIDATO_UNICO");
  const ambiguos = candidatos.filter((x) => x.resolucion === "AMBIGUO_MULTIPLES_GRUPOS");
  const sinCandidato = candidatos.filter((x) => x.resolucion === "SIN_CANDIDATO");
  const paraRegularizar = hasModoPuntual
    ? [{ hlc_id: hlcId, grupo_sugerido: grupoId, resolucion: "MANUAL_PUNTUAL" }]
    : paraRegularizarAuto;

  const actualizados = [];
  if (apply && paraRegularizar.length > 0) {
    let batch = db.batch();
    let count = 0;
    for (const item of paraRegularizar) {
      const ref = db.collection("historial_laboral_cargos").doc(item.hlc_id);
      batch.set(
        ref,
        {
          grupo_de_trabajo_id: item.grupo_sugerido,
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      actualizados.push({ hlc_id: item.hlc_id, grupo_de_trabajo_id: item.grupo_sugerido });
      count += 1;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 400 !== 0) await batch.commit();
  }

  const reporte = {
    generado_en: new Date().toISOString(),
    modo: mode,
    filtros: {
      solo_abiertos: onlyAbiertos,
      modo_puntual: hasModoPuntual,
      hlc_id: hlcId || null,
      grupo_de_trabajo_id: grupoId || null,
    },
    resumen: {
      total_hlc_sin_grupo: candidatos.length,
      candidato_unico: paraRegularizarAuto.length,
      ambiguo_multiples_grupos: ambiguos.length,
      sin_candidato: sinCandidato.length,
      actualizados: actualizados.length,
    },
    candidato_unico: paraRegularizarAuto,
    ambiguos,
    sin_candidato: sinCandidato,
    updates_aplicados: actualizados,
  };

  const backupsDir = join(process.cwd(), "backups");
  mkdirSync(backupsDir, { recursive: true });
  const outPath = join(
    backupsDir,
    `auditoria-hlc-sin-grupo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(outPath, `${JSON.stringify(reporte, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(reporte, null, 2));
  console.log(`[hlc-sin-grupo] Archivo generado: ${outPath}`);
}

main().catch((error) => {
  console.error("[hlc-sin-grupo] Error:", error?.message || error);
  if (error?.stack) console.error(error.stack);
  process.exit(1);
});
