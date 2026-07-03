/**
 * Purga solicitudes médicas erróneas de piloto: limpia vis/asi (todos los gdt del fan-out) + borra sol_*.
 *
 * Uso:
 *   node scripts/purge-solicitudes-med-piloto.mjs --dry-run sol_0125598C... sol_01710EDC...
 *   node scripts/purge-solicitudes-med-piloto.mjs --apply sol_0125598C... sol_01710EDC...
 */
import "./load-env-v2.mjs";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { MDC_COMANDO_VERSION } = require("../functions/modules/shared/mdcComandosConstants.js");
const { buildAsiDocumentId, buildVisDocumentId, diaMesKeyDesdeYmd, iterarYmdInclusive } = require("../functions/modules/shared/mdcRdaDocumentIds.js");
const { calcularTieneConflictoDia } = require("../functions/modules/shared/mdcVisConflictoDia.js");
const { resolverGruposFanOut } = require("../functions/modules/shared/mdcFanOutVis.js");
const { loadArticuloDisplay } = require("../functions/modules/shared/solicitudBandejaJefeCore.js");
const { resolverRangoYmdEfectivoAvisoMedico, mapSolicitudMedAvisoParaMdc } = require("../functions/modules/shared/avisoMedicoGrillaMdcPayload.js");

const COL_VISTAS = "vistas_grilla_mes_agente";

const TAG = "[purge-sol-med]";
const apply = process.argv.includes("--apply");
const solIds = process.argv.filter((a) => /^sol_/i.test(a));

if (!solIds.length) {
  console.error("Uso: node scripts/purge-solicitudes-med-piloto.mjs [--dry-run|--apply] sol_... [sol_...]");
  process.exit(1);
}

const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const COMANDOS_IDEM = [
  "PROYECTAR_PENDIENTE",
  "CONSOLIDAR_APROBADO",
  "REVERTIR_PROYECCION",
  "AUTORIZAR_JEFE",
  "REINTENTAR_CONSOLIDACION",
];

async function borrarEventosTicket(solId) {
  const snaps = await db.collection("eventos_ticket").where("solicitud_id", "==", solId).limit(50).get();
  const snaps2 = await db.collection("eventos_ticket").where("sol_id", "==", solId).limit(50).get();
  return [...new Set([...snaps.docs, ...snaps2.docs].map((d) => d.id))];
}

async function limpiarVisDiaGrupo(db, personaId, solId, ymd, gdt) {
  const visId = buildVisDocumentId(personaId, ymd, gdt);
  const diaKey = diaMesKeyDesdeYmd(ymd);
  const visRef = db.collection(COL_VISTAS).doc(visId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(visRef);
    const data = snap.exists ? snap.data() || {} : {};
    const dias = { ...(data.dias || {}) };
    const prev = dias[diaKey] || { eventos: [] };
    const eventos = (Array.isArray(prev.eventos) ? prev.eventos : []).filter(
      (e) => String(e?.solicitud_id || "") !== solId,
    );
    if (eventos.length === (Array.isArray(prev.eventos) ? prev.eventos : []).length) return;
    dias[diaKey] = {
      ...prev,
      eventos,
      tiene_conflicto: calcularTieneConflictoDia(eventos),
    };
    tx.set(
      visRef,
      {
        persona_id: personaId,
        anio: Number(ymd.slice(0, 4)),
        mes: Number(ymd.slice(5, 7)),
        grupo_de_trabajo_id: gdt,
        dias,
        metadata: {
          generado_en: FieldValue.serverTimestamp(),
          ultima_sync_mdc: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
  });
}

async function limpiarDia(db, mapped, raw, ymd) {
  const personaId = String(mapped.titular_persona_id || "").trim();
  const solId = String(mapped.id || mapped.sol_id || "").trim();
  const asiId = buildAsiDocumentId(personaId, ymd);
  if (asiId) {
    const asiRef = db.collection("asistencia_diaria").doc(asiId);
    const asiSnap = await asiRef.get();
    if (asiSnap.exists && asiSnap.data()?.aportes_normativos?.[solId]) {
      await asiRef.set(
        {
          [`aportes_normativos.${solId}`]: FieldValue.delete(),
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }
  const grupos = resolverGruposFanOut({
    grupos_trabajo_involucrados_ids: raw.grupos_trabajo_involucrados_ids,
    grupo_trabajo_id_ancla: mapped.grupo_trabajo_id_ancla || raw.grupo_trabajo_id_ancla,
    grupo_de_trabajo_id: mapped.grupo_de_trabajo_id || raw.grupo_de_trabajo_id,
  });
  for (const gdt of grupos) {
    await limpiarVisDiaGrupo(db, personaId, solId, ymd, gdt);
  }
}

async function purgarSolicitud(solId) {
  const ref = db.collection("solicitudes_articulo").doc(solId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(TAG, solId, "no existe — skip");
    return { solId, ok: true, skipped: true };
  }
  const raw = snap.data() || {};
  const artCache = new Map();
  const display = raw.articulo_id
    ? await loadArticuloDisplay(db, String(raw.articulo_id), artCache)
    : { codigo_grilla: "" };
  const codigoGrilla = String(display.codigo_grilla || raw.codigo_grilla || "LM").trim();

  const mapped = mapSolicitudMedAvisoParaMdc(
    { id: solId, ...raw, codigo_grilla: codigoGrilla },
    solId,
  );
  if (!mapped) {
    console.error(TAG, solId, "sin rango fechas válido");
    return { solId, ok: false, codigo: "RANGO_INVALIDO" };
  }

  const rango = resolverRangoYmdEfectivoAvisoMedico(raw);
  const dias = rango ? iterarYmdInclusive(rango.fecha_desde, rango.fecha_hasta) : [];

  console.log(TAG, solId, {
    estado: raw.estado_solicitud_id,
    articulo_id: raw.articulo_id,
    codigo_grilla: codigoGrilla,
    titular: raw.titular_persona_id,
    rango,
    dias: dias.length,
  });

  const evtIds = await borrarEventosTicket(solId);

  if (!apply) {
    console.log(TAG, "dry-run limpiaría", dias.length, "días vis/asi + borrar sol +", evtIds.length, "eventos");
    return { solId, ok: true, dryRun: true, dias: dias.length, eventos: evtIds.length };
  }

  for (const cmd of COMANDOS_IDEM) {
    await db
      .collection("mdc_comandos_aplicados")
      .doc(`${solId}_${cmd}_v${MDC_COMANDO_VERSION}`)
      .delete()
      .catch(() => {});
  }

  for (const ymd of dias) {
    await limpiarDia(db, mapped, raw, ymd);
  }

  for (const evtId of evtIds) {
    await db.collection("eventos_ticket").doc(evtId).delete();
  }

  await ref.delete();
  console.log(TAG, "OK eliminado", solId, "días:", dias.length, "eventos:", evtIds.length);

  return { solId, ok: true, dias: dias.length, eventos: evtIds.length };
}

console.log(TAG, apply ? "APPLY" : "DRY-RUN", "solicitudes:", solIds.join(", "));
const results = [];
for (const solId of solIds) {
  results.push(await purgarSolicitud(solId));
}
console.log(TAG, "resumen:", JSON.stringify(results, null, 2));
