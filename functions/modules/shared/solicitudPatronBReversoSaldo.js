"use strict";

const { FieldValue } = require("./context");
const { saldoAnualDocId } = require("./laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";

/**
 * Devuelve saldo Patrón B en transacción si la solicitud tenía descuento aplicado.
 * @param {import("firebase-admin/firestore").Transaction} tx
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} cur
 * @param {string} titularId
 */
async function revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId) {
  if (cur.motor_descuento_aplicado !== true || !cur.motor_bolsa_id || !cur.motor_dias_descontados) {
    return false;
  }
  const anio = Number(cur.anio_ciclo_consumo);
  const salId = saldoAnualDocId(titularId, anio);
  const bolsaId = String(cur.motor_bolsa_id);
  const dias = Math.floor(Number(cur.motor_dias_descontados));
  if (!salId || !bolsaId || dias <= 0) return false;

  const salRef = db.collection(COL_SALDOS).doc(salId);
  const salSnap = await tx.get(salRef);
  if (!salSnap.exists) return false;

  const bolsas = salSnap.data()?.bolsas || {};
  const b = bolsas[bolsaId];
  if (!b || typeof b !== "object") return false;

  const disp = Number(b.disponible);
  const cons = Number(b.consumido);
  if (!Number.isFinite(disp) || !Number.isFinite(cons)) return false;

  tx.update(salRef, {
    [`bolsas.${bolsaId}.disponible`]: disp + dias,
    [`bolsas.${bolsaId}.consumido`]: Math.max(0, cons - dias),
    [`bolsas.${bolsaId}.ultima_actualizacion`]: FieldValue.serverTimestamp(),
    "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
  });
  return true;
}

module.exports = { revertirMotorBolsaPatronBEnTx };
