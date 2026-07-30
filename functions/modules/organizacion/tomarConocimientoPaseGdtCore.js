"use strict";

/**
 * Core: toma de conocimiento de pases GDT.
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.4–§5
 *
 * No revierten ni reejecutan el pase: solo estampan acuse.
 */

const { FieldValue } = require("../shared/context");
const { COL_SOL_PASES_GDT } = require("./ejecutarPaseInternoGdtCore");

const RX_SPG = /^spg_/i;
const RX_PER = /^per_/i;

/** Estados en los que el pase ya se ejecutó (o quedó formalizado) y admite TC. */
const ESTADOS_TC = new Set(["APROBADO_INTERNO", "APROBADO"]);

/**
 * @param {unknown} estado
 */
function estadoAdmiteTc(estado) {
  return ESTADOS_TC.has(String(estado || "").trim());
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   paseId: string;
 *   actorPersonaId: string;
 * }} input
 */
async function tomarConocimientoPaseGdtRrhhCore(db, input) {
  const paseId = String(input.paseId || "").trim();
  const actorPersonaId = String(input.actorPersonaId || "").trim();

  if (!RX_SPG.test(paseId)) {
    return { ok: false, code: "invalid-argument", message: "pase_id inválido." };
  }
  if (!RX_PER.test(actorPersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }

  const paseRef = db.collection(COL_SOL_PASES_GDT).doc(paseId);
  const snap = await paseRef.get();
  if (!snap.exists) {
    return { ok: false, code: "not-found", message: "Pase no encontrado." };
  }
  const data = snap.data() || {};
  const estado = String(data.estado || "").trim();

  if (!estadoAdmiteTc(estado)) {
    return {
      ok: false,
      code: "failed-precondition",
      message: `El pase no admite toma de conocimiento RRHH (estado: ${estado || "—"}).`,
    };
  }
  if (data.requiere_conocimiento_rrhh !== true) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "Este pase no requiere toma de conocimiento de RRHH.",
    };
  }
  if (data.rrhh_toma_conocimiento_en) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "La toma de conocimiento de RRHH ya fue registrada.",
    };
  }

  const agenteId = String(data.agente_persona_id || "").trim();
  if (RX_PER.test(agenteId) && agenteId === actorPersonaId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "No podés tomar conocimiento de un pase sobre vos mismo.",
    };
  }

  try {
    await paseRef.update({
      rrhh_toma_conocimiento_en: FieldValue.serverTimestamp(),
      rrhh_toma_conocimiento_por: actorPersonaId,
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("tomarConocimientoPaseGdtRrhhCore.update", err);
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : "Error al registrar TC RRHH.",
    };
  }

  return {
    ok: true,
    pase_id: paseId,
    estado,
    actor: "rrhh",
    rrhh_toma_conocimiento_por: actorPersonaId,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   paseId: string;
 *   actorPersonaId: string;
 * }} input
 */
async function tomarConocimientoPaseGdtJefeCore(db, input) {
  const paseId = String(input.paseId || "").trim();
  const actorPersonaId = String(input.actorPersonaId || "").trim();

  if (!RX_SPG.test(paseId)) {
    return { ok: false, code: "invalid-argument", message: "pase_id inválido." };
  }
  if (!RX_PER.test(actorPersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }

  const paseRef = db.collection(COL_SOL_PASES_GDT).doc(paseId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(paseRef);
      if (!snap.exists) {
        throw Object.assign(new Error("Pase no encontrado."), { code: "not-found" });
      }
      const data = snap.data() || {};
      const estado = String(data.estado || "").trim();

      if (!estadoAdmiteTc(estado)) {
        throw Object.assign(
          new Error(`El pase no admite toma de conocimiento de jefe (estado: ${estado || "—"}).`),
          { code: "failed-precondition" },
        );
      }

      const pendientes = Array.isArray(data.jefes_pendientes_conocimiento_ids)
        ? data.jefes_pendientes_conocimiento_ids.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      if (!pendientes.includes(actorPersonaId)) {
        throw Object.assign(
          new Error("No figurás entre los jefes pendientes de toma de conocimiento."),
          { code: "permission-denied" },
        );
      }

      const acuses =
        data.jefes_acuses && typeof data.jefes_acuses === "object" && !Array.isArray(data.jefes_acuses)
          ? /** @type {Record<string, unknown>} */ (data.jefes_acuses)
          : {};
      if (acuses[actorPersonaId] && typeof acuses[actorPersonaId] === "object") {
        throw Object.assign(new Error("Ya registraste toma de conocimiento en este pase."), {
          code: "failed-precondition",
        });
      }

      const pendientesNext = pendientes.filter((id) => id !== actorPersonaId);
      /** @type {Record<string, unknown>} */
      const patch = {
        jefes_pendientes_conocimiento_ids: pendientesNext,
        jefes_acuses_ids: FieldValue.arrayUnion(actorPersonaId),
        actualizado_en: FieldValue.serverTimestamp(),
      };
      patch[`jefes_acuses.${actorPersonaId}`] = {
        en: FieldValue.serverTimestamp(),
        por: actorPersonaId,
      };
      tx.update(paseRef, patch);

      return {
        ok: true,
        pase_id: paseId,
        estado,
        actor: "jefe",
        jefes_pendientes_restantes: pendientesNext,
      };
    });
    return result;
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err && err.code ? String(err.code) : "internal";
    const message = err instanceof Error ? err.message : "Error al registrar TC jefe.";
    if (
      code === "not-found" ||
      code === "failed-precondition" ||
      code === "permission-denied" ||
      code === "invalid-argument"
    ) {
      return { ok: false, code, message };
    }
    console.error("tomarConocimientoPaseGdtJefeCore.tx", err);
    return { ok: false, code: "internal", message };
  }
}

module.exports = {
  ESTADOS_TC,
  estadoAdmiteTc,
  tomarConocimientoPaseGdtRrhhCore,
  tomarConocimientoPaseGdtJefeCore,
};
