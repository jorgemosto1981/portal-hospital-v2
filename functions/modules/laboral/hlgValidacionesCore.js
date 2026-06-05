"use strict";

const { ymdDesdeValorLaboral } = require("../shared/fechaLaboralYmd");

function ymdLaboralOrNull(v) {
  const y = ymdDesdeValorLaboral(v);
  return y || null;
}

function hasRangoSolapado({ desdeA, hastaA, desdeB, hastaB }) {
  const inicioA = ymdLaboralOrNull(desdeA);
  const finA = ymdLaboralOrNull(hastaA) || "9999-12-31";
  const inicioB = ymdLaboralOrNull(desdeB);
  const finB = ymdLaboralOrNull(hastaB) || "9999-12-31";
  if (!inicioA || !inicioB) return false;
  return inicioA <= finB && inicioB <= finA;
}

function isRegimenHorarioActivo(regimenDoc) {
  if (!regimenDoc || typeof regimenDoc !== "object") return false;
  if (Object.hasOwn(regimenDoc, "activo") && regimenDoc.activo === false) return false;
  return true;
}

/** HLg que compite en validación de solape operativo (excluye baja administrativa). */
function hlgCuentaParaSolapeOperativo(hlgDoc) {
  if (!hlgDoc || typeof hlgDoc !== "object") return false;
  if (hlgDoc.eliminado === true) return false;
  if (String(hlgDoc.estado || "").trim().toUpperCase() === "ANULADO") return false;
  return hlgDoc.activo !== false;
}

module.exports = {
  hasRangoSolapado,
  isRegimenHorarioActivo,
  hlgCuentaParaSolapeOperativo,
};
