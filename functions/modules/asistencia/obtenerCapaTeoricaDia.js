"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db } = require("../shared/context");
const { buildAsiDocumentId, buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const { consultarEstadoPeriodoLiquidacion } = require("./asistenciaPeriodoLiquidacion");
const runtimeFlags = require("../shared/runtimeFlags.json");
const { assertOverrideAuth } = require("../shared/helpers");

const COL_ASISTENCIA = "asistencia_diaria";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function tsToIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Lee capa_teorica materializada (asi_*) + token de concurrencia (vis_*).
 */
const obtenerCapaTeoricaDia = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data || {};
  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
  const fecha = typeof data.fecha === "string" ? data.fecha.trim() : "";
  if (!personaId) throw new HttpsError("invalid-argument", "[CAPA-001] persona_id requerido.");
  if (!YMD.test(fecha)) throw new HttpsError("invalid-argument", "[CAPA-002] fecha YYYY-MM-DD requerida.");
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertOverrideAuth(request, personaId);

  const asiDocId = buildAsiDocumentId(personaId, fecha);
  const visDocId = buildVisDocumentId(personaId, fecha);
  const asiSnap = await db.collection(COL_ASISTENCIA).doc(asiDocId).get();
  const visSnap = visDocId ? await db.collection("vistas_grilla_mes_agente").doc(visDocId).get() : null;

  const capa = asiSnap.exists ? (asiSnap.data()?.capa_teorica || null) : null;
  const periodo = await consultarEstadoPeriodoLiquidacion(personaId, fecha);
  const diaKey = fecha.slice(8, 10);
  const diaVis = visSnap?.exists && visSnap.data()?.dias?.[diaKey] ? visSnap.data().dias[diaKey] : null;
  const versionToken = tsToIso(visSnap?.data()?.metadata?.version_token)
    || tsToIso(visSnap?.data()?.metadata?.ultima_sync_teorica);

  return {
    ok: true,
    doc_id: asiDocId,
    vis_id: visDocId,
    capa_teorica: capa,
    concurrencia: {
      version_capa_teorica: capa?.version_capa_teorica ?? null,
      vis_ultima_sync: tsToIso(visSnap?.data()?.metadata?.ultima_sync_teorica),
      expected_version_token: versionToken,
    },
    periodo_liquidacion: periodo,
    vis_dia: diaVis,
  };
});

module.exports = { obtenerCapaTeoricaDia };
