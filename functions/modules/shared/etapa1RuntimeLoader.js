"use strict";

const {
  CFG_ETAPA1_COLLECTION,
  CFG_ETAPA1_RUNTIME_DOC,
  normalizeEtapa1Runtime,
  personaPermitidaCircuitoEtapa1,
  articuloFilaPermitidaEtapa1,
  debeFiltrarCatalogoEtapa1,
} = require("./etapa1RuntimeConfig");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function loadEtapa1Runtime(db) {
  const snap = await db.collection(CFG_ETAPA1_COLLECTION).doc(CFG_ETAPA1_RUNTIME_DOC).get();
  if (!snap.exists) return normalizeEtapa1Runtime(null);
  return normalizeEtapa1Runtime(snap.data());
}

module.exports = {
  loadEtapa1Runtime,
  normalizeEtapa1Runtime,
  personaPermitidaCircuitoEtapa1,
  articuloFilaPermitidaEtapa1,
  debeFiltrarCatalogoEtapa1,
  CFG_ETAPA1_COLLECTION,
  CFG_ETAPA1_RUNTIME_DOC,
};
