"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db } = require("../shared/context");
const { buildAsiDocumentId, buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const { resolverCapaTeoricaGrupo } = require("../shared/capaTeoricaPorGrupoCore");
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
 * Lee capa teórica materializada por grupo (capa_teorica_por_grupo[gdt]) + token de concurrencia (vis_*).
 */
const obtenerCapaTeoricaDia = onCall({
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120,
}, async (request) => {
  const data = request.data || {};
  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
  const fecha = typeof data.fecha === "string" ? data.fecha.trim() : "";
  const grupoTrabajoId = typeof data.grupo_trabajo_id === "string" ? data.grupo_trabajo_id.trim()
    : (typeof data.grupo_id === "string" ? data.grupo_id.trim() : "");
  if (!personaId) throw new HttpsError("invalid-argument", "[CAPA-001] persona_id requerido.");
  if (!YMD.test(fecha)) throw new HttpsError("invalid-argument", "[CAPA-002] fecha YYYY-MM-DD requerida.");
  if (!/^gdt_/i.test(grupoTrabajoId)) {
    throw new HttpsError("invalid-argument", "[CAPA-003] grupo_trabajo_id (gdt_*) requerido.");
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) await assertOverrideAuth(request, personaId);

  const asiDocId = buildAsiDocumentId(personaId, fecha);
  const visDocId = buildVisDocumentId(personaId, fecha, grupoTrabajoId);
  const asiSnap = await db.collection(COL_ASISTENCIA).doc(asiDocId).get();
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visDocId).get();

  const asiData = asiSnap.exists ? asiSnap.data() : null;
  const capaGrupo = resolverCapaTeoricaGrupo(asiData, grupoTrabajoId);
  const periodo = await consultarEstadoPeriodoLiquidacion(personaId, fecha, grupoTrabajoId);
  const diaKey = fecha.slice(8, 10);
  const diaVis = visSnap?.exists && visSnap.data()?.dias?.[diaKey] ? visSnap.data().dias[diaKey] : null;
  const versionToken = tsToIso(visSnap?.data()?.metadata?.version_token)
    || tsToIso(visSnap?.data()?.metadata?.ultima_sync_teorica);

  return {
    ok: true,
    doc_id: asiDocId,
    vis_id: visDocId,
    grupo_trabajo_id: grupoTrabajoId,
    capa_teorica: capaGrupo,
    capa_teorica_grupo: capaGrupo,
    concurrencia: {
      version_capa_teorica: capaGrupo?.version_capa_teorica ?? null,
      vis_ultima_sync: tsToIso(visSnap?.data()?.metadata?.ultima_sync_teorica),
      expected_version_token: versionToken,
    },
    periodo_liquidacion: periodo,
    vis_dia: diaVis,
  };
});

module.exports = { obtenerCapaTeoricaDia };
