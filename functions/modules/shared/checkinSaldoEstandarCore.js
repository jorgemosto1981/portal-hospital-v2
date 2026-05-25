"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("./context");
const { resolvePublishedLaoVersion } = require("./laoVersionResolverDb");
const {
  saldoAnualDocId,
  saldoGlobalDocId,
  buildBolsaCheckinPatronB,
  buildBolsaCheckinPatronC,
  resolveCodigoGrillaForBolsa,
  pickBolsaParaConsumo,
} = require("./laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} params
 */
async function prepareBolsaPatronB(db, params) {
  const {
    personaId,
    articuloId,
    anioCorteA,
    anioCiclo,
    diasUsados,
    cupoFromClient,
    versionIdFromClient,
    rectificacion,
    forzarGlobal,
    salDataExisting,
  } = params;

  let versionId = String(versionIdFromClient || "").trim();
  let cupo = cupoFromClient != null ? Number(cupoFromClient) : NaN;

  const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
  const articuloCodigo =
    (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "ART";

  if (!Number.isFinite(cupo) || cupo < 0) {
    if (!versionId) {
      const resolved = await resolvePublishedLaoVersion(db, articuloId, anioCiclo);
      versionId = resolved.versionId;
    }
    const vSnap = await db
      .collection("cfg_articulos")
      .doc(articuloId)
      .collection("versiones")
      .doc(versionId)
      .get();
    const topes = vSnap.exists ? vSnap.data()?.bloque_topes_plazos_computo || {} : {};
    cupo = Number(topes.cupo_dias_por_ciclo);
  }

  if (!Number.isFinite(cupo) || cupo < 0) {
    throw new HttpsError("failed-precondition", `Falta cupo_dias_por_ciclo (${articuloId}).`);
  }

  if (!versionId) {
    const resolved = await resolvePublishedLaoVersion(db, articuloId, anioCiclo);
    versionId = resolved.versionId;
  }

  const vSnap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  const versionData = vSnap.exists ? vSnap.data() : {};
  const codigoGrilla = resolveCodigoGrillaForBolsa(versionData, anioCiclo, articuloCodigo);

  let built;
  try {
    built = buildBolsaCheckinPatronB({
      articuloId,
      versionId,
      codigoGrilla,
      anioCiclo,
      cupoDias: cupo,
      diasConsumidosPrevios: diasUsados,
    });
  } catch (err) {
    throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
  }

  const existente = pickBolsaParaConsumo(salDataExisting || {}, articuloId, anioCiclo);
  if (existente && !rectificacion) {
    const cons = Number(existente.bolsa.consumido) || 0;
    if (cons > diasUsados && !forzarGlobal) {
      throw new HttpsError(
        "already-exists",
        `Bolsa ${anioCiclo} (${articuloCodigo}) ya tiene consumo (${cons} días).`,
      );
    }
  }

  const { bolsaId, bolsa } = built;
  if (existente && rectificacion) {
    const prev = existente.bolsa;
    bolsa.version_id_origen = String(prev.version_id_origen || bolsa.version_id_origen).trim();
    bolsa.codigo_grilla = String(prev.codigo_grilla || bolsa.codigo_grilla).trim();
    bolsa.origen_saldo_id = String(prev.origen_saldo_id || bolsa.origen_saldo_id).trim();
  }
  bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

  return { bolsaId, bolsa, versionId, articuloCodigo, disponible: bolsa.disponible };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} params
 */
async function prepareBolsaPatronC(db, params) {
  const {
    articuloId,
    anioCorteA,
    saldoDisponible,
    versionIdFromClient,
    rectificacion,
    salDataExisting,
  } = params;

  let versionId = String(versionIdFromClient || "").trim();
  const disp = Number(saldoDisponible);
  if (!Number.isFinite(disp)) {
    throw new HttpsError("invalid-argument", "saldo_disponible_inicial inválido.");
  }

  const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
  const articuloCodigo =
    (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "ART";

  if (!versionId) {
    try {
      const resolved = await resolvePublishedLaoVersion(db, articuloId, anioCorteA);
      versionId = resolved.versionId;
    } catch {
      const snap = await db
        .collection("cfg_articulos")
        .doc(articuloId)
        .collection("versiones")
        .where("estado_version_id", "==", "cfg_est_ver_publicada")
        .limit(1)
        .get();
      if (snap.empty) throw new HttpsError("not-found", `Sin versión publicada (${articuloId}).`);
      versionId = snap.docs[0].id;
    }
  }

  const vSnap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  const versionData = vSnap.exists ? vSnap.data() : {};
  const codigoGrilla = resolveCodigoGrillaForBolsa(versionData, 0, articuloCodigo);

  let built;
  try {
    built = buildBolsaCheckinPatronC({
      articuloId,
      versionId,
      codigoGrilla,
      saldoDisponible: disp,
    });
  } catch (err) {
    throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
  }

  const existenteC = pickBolsaParaConsumo(salDataExisting || {}, articuloId, 0);
  const { bolsaId, bolsa } = built;
  if (existenteC && rectificacion) {
    const prev = existenteC.bolsa;
    bolsa.version_id_origen = String(prev.version_id_origen || bolsa.version_id_origen).trim();
    bolsa.codigo_grilla = String(prev.codigo_grilla || bolsa.codigo_grilla).trim();
    bolsa.origen_saldo_id = String(prev.origen_saldo_id || bolsa.origen_saldo_id).trim();
  }
  bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

  return { bolsaId, bolsa, versionId, articuloCodigo, disponible: bolsa.disponible };
}

module.exports = {
  COL_SALDOS,
  prepareBolsaPatronB,
  prepareBolsaPatronC,
  saldoAnualDocId,
  saldoGlobalDocId,
};
