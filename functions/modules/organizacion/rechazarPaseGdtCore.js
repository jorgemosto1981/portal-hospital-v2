"use strict";

/**
 * Core: rechazarPaseGdt — SPIKE_PASES_GDT_FASE2_V2.md §4.3
 * Solo RRHH. Marca RECHAZADO. No muta HLg.
 */

const { FieldValue } = require("../shared/context");
const { COL_SOL_PASES_GDT } = require("./ejecutarPaseInternoGdtCore");

const RX_SPG = /^spg_/i;
const RX_PER = /^per_/i;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   paseId: string;
 *   motivoRechazo: string;
 *   resolventePersonaId: string;
 * }} input
 */
async function rechazarPaseGdtCore(db, input) {
  const paseId = String(input.paseId || "").trim();
  const motivoRechazo = String(input.motivoRechazo || "").trim();
  const resolventePersonaId = String(input.resolventePersonaId || "").trim();

  if (!RX_SPG.test(paseId)) {
    return { ok: false, code: "invalid-argument", message: "pase_id inválido." };
  }
  if (!motivoRechazo || motivoRechazo.length < 3) {
    return {
      ok: false,
      code: "invalid-argument",
      message: "motivo_rechazo obligatorio (mín. 3 caracteres).",
    };
  }
  if (!RX_PER.test(resolventePersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }

  const paseRef = db.collection(COL_SOL_PASES_GDT).doc(paseId);
  const snap = await paseRef.get();
  if (!snap.exists) {
    return { ok: false, code: "not-found", message: "Pase no encontrado." };
  }
  const data = snap.data() || {};
  const estado = String(data.estado || "").trim();
  if (estado !== "PENDIENTE_RRHH") {
    return {
      ok: false,
      code: "failed-precondition",
      message: `El pase no está pendiente (estado actual: ${estado || "—"}).`,
    };
  }
  if (String(data.tipo_pase || "").trim() !== "EXTERNO") {
    return {
      ok: false,
      code: "failed-precondition",
      message: "Solo se rechazan pases externos pendientes.",
    };
  }

  const agenteId = String(data.agente_persona_id || "").trim();
  if (RX_PER.test(agenteId) && agenteId === resolventePersonaId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "No podés resolver un pase sobre vos mismo.",
    };
  }

  try {
    await paseRef.update({
      estado: "RECHAZADO",
      motivo_rechazo: motivoRechazo,
      resuelto_en: FieldValue.serverTimestamp(),
      resuelto_por: resolventePersonaId,
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("rechazarPaseGdtCore.update", err);
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : "Error al rechazar el pase.",
    };
  }

  return {
    ok: true,
    pase_id: paseId,
    estado: "RECHAZADO",
  };
}

module.exports = { rechazarPaseGdtCore };
