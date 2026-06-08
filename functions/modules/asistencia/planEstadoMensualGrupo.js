"use strict";

const { elegirPlanMensualCanonico } = require("./planGrupoAgentesNuevos");

const COL_PLANES = "planes_turno_servicio";

/**
 * Estado canónico del plan mensual principal del grupo/período (US-13 G1).
 * Fallback `BORRADOR` si no hay plan (misma política que el frontend).
 *
 * @param {import("firebase-admin/firestore").Firestore} firestore
 * @param {string} grupoId gdt_*
 * @param {string} periodo YYYY-MM
 * @returns {Promise<string>}
 */
async function resolverEstadoPlanMensualGrupo(firestore, grupoId, periodo) {
  const gdt = String(grupoId || "").trim();
  const periodoNorm = String(periodo || "").trim();
  if (!gdt || !/^\d{4}-\d{2}$/.test(periodoNorm)) {
    return "BORRADOR";
  }

  const planesSnap = await firestore
    .collection(COL_PLANES)
    .where("grupo_id", "==", gdt)
    .where("periodo", "==", periodoNorm)
    .where("tipo_plan", "==", "mensual")
    .limit(20)
    .get();

  if (planesSnap.empty) {
    return "BORRADOR";
  }

  const planesActivos = planesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.eliminado !== true);

  if (!planesActivos.length) {
    return "BORRADOR";
  }

  const canon = elegirPlanMensualCanonico(planesActivos);
  return String(canon?.estado || "BORRADOR").trim() || "BORRADOR";
}

module.exports = {
  COL_PLANES,
  resolverEstadoPlanMensualGrupo,
};
