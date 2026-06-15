"use strict";

const { calcularDeltasCumplimiento } = require("./calcularDeltasCumplimiento");
const { enriquecerLimitesCumplimientoEnCapa } = require("./capaTeoricaLimitesCumplimiento");
const { leerCeldaVisDiaFusionada } = require("./visCeldaFusionLectura");
const { resolverCapaTeoricaGrupo } = require("./capaTeoricaPorGrupoCore");
const { buildAsiDocumentId } = require("./mdcRdaDocumentIds");

const COL_VIS = "vistas_grilla_mes_agente";
const COL_ASISTENCIA = "asistencia_diaria";

/**
 * Recalcula analítica de cumplimiento tras ABM de fichadas_reales.
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function actualizarAnaliticaCumplimientoTrasFichada(db, params) {
  const persona_id = String(params.persona_id || "").trim();
  const gdt = String(params.grupo_trabajo_id || "").trim();
  const fecha_ymd = String(params.fecha_ymd || "").slice(0, 10);
  const visId = String(params.vis_id || "").trim();
  const diaKey = String(params.dia_key || "").trim();
  if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(gdt) || !visId || !diaKey) {
    return null;
  }

  const visRef = db.collection(COL_VIS).doc(visId);
  const visSnap = await visRef.get();
  if (!visSnap.exists) return null;

  const celdaRaw =
    params.celda_override && typeof params.celda_override === "object"
      ? params.celda_override
      : leerCeldaVisDiaFusionada(visSnap.data() || {}, diaKey);

  const asiDocId = buildAsiDocumentId(persona_id, fecha_ymd);
  let capaRaw = null;
  if (asiDocId) {
    const asiSnap = await db.collection(COL_ASISTENCIA).doc(asiDocId).get();
    if (asiSnap.exists) {
      capaRaw = resolverCapaTeoricaGrupo(asiSnap.data(), gdt);
    }
  }

  const capaEnriquecida = enriquecerLimitesCumplimientoEnCapa(capaRaw || {}, null);
  const celdaCtx = {
    ...celdaRaw,
    tipo_dia: celdaRaw.tipo_dia ?? capaEnriquecida.tipo_dia,
    fichadas_esperadas: celdaRaw.fichadas_esperadas ?? capaEnriquecida.fichadas_esperadas,
    fichadas_reales: celdaRaw.fichadas_reales,
    rda_turno_id: celdaRaw.rda_turno_id,
    rda_ingreso: celdaRaw.rda_ingreso,
    rda_egreso: celdaRaw.rda_egreso,
  };

  const analitica = calcularDeltasCumplimiento(celdaCtx, capaEnriquecida, {
    fecha_ymd,
    ahora_evaluacion_ms: Date.now(),
  });

  await visRef.update({ [`dias.${diaKey}.analitica_cumplimiento`]: analitica });

  if (asiDocId) {
    const asiRef = db.collection(COL_ASISTENCIA).doc(asiDocId);
    const asiSnap = await asiRef.get();
    if (asiSnap.exists) {
      await asiRef.update({ [`analitica_cumplimiento_por_grupo.${gdt}`]: analitica });
    }
  }

  return analitica;
}

module.exports = { actualizarAnaliticaCumplimientoTrasFichada };
