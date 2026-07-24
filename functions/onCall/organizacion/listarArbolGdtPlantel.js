"use strict";

/**
 * Callable: listarArbolGdtPlantel
 * @see docs/v2/RFC_PLANTEL_Y_PASES_GDT_V2.md §3.4 Fase 1b
 *
 * Input: { alcance?: "rrhh"|"jefe", a_fecha?: "YYYY-MM-DD" }
 * - RRHH + alcance rrhh (default si token RRHH): árbol completo de GDT activos.
 * - alcance jefe: subárbol desde HLg vigentes del actor (persona_id del token).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { obtenerYmdHoyInstitucional } = require("../../modules/shared/fechaLaboralYmd");
const { normalizeYmd } = require("../../modules/organizacion/obtenerPlantelPorGdtCore");
const { listarArbolGdtPlantelCore } = require("../../modules/organizacion/listarArbolGdtPlantelCore");

const listarArbolGdtPlantelCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth.token || {};
  const esRrhh = tokenHasRrhhLaborAccess(token);
  const personaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";

  const alcanceRaw = typeof d.alcance === "string" ? d.alcance.trim().toLowerCase() : "";
  let alcance = alcanceRaw === "jefe" || alcanceRaw === "rrhh" ? alcanceRaw : "";
  if (!alcance) {
    alcance = esRrhh ? "rrhh" : "jefe";
  }

  if (alcance === "rrhh" && !esRrhh) {
    throw new HttpsError("permission-denied", "Solo RRHH puede listar el árbol completo de plantel.");
  }

  const aFechaRaw =
    typeof d.a_fecha === "string" && d.a_fecha.trim()
      ? d.a_fecha.trim()
      : obtenerYmdHoyInstitucional();
  const aFechaYmd = normalizeYmd(aFechaRaw);
  if (!aFechaYmd) {
    throw new HttpsError("invalid-argument", "a_fecha inválida (YYYY-MM-DD).");
  }

  try {
    const result = await listarArbolGdtPlantelCore(db, {
      alcance: /** @type {"rrhh"|"jefe"} */ (alcance),
      personaId,
      aFechaYmd,
    });
    if (!result.ok) {
      throw new HttpsError(
        /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
        result.message || "No se pudo listar el árbol de GDT.",
      );
    }
    return {
      ok: true,
      alcance: result.alcance,
      a_fecha: result.a_fecha,
      raices_ids: result.raices_ids,
      nodos: result.nodos,
      arbol: result.arbol,
      total: result.total,
      ...(result.aviso ? { aviso: result.aviso } : {}),
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("listarArbolGdtPlantel", err);
    throw new HttpsError(
      "internal",
      err instanceof Error ? err.message : "Error al listar árbol GDT plantel.",
    );
  }
});

module.exports = { listarArbolGdtPlantel: listarArbolGdtPlantelCallable };
