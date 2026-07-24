"use strict";

/**
 * Callable: obtenerPlantelPorGdt
 * @see docs/v2/RFC_PLANTEL_Y_PASES_GDT_V2.md §3.4
 *
 * Auth:
 * - RRHH: cualquier GDT activo.
 * - Jefe/miembro: `assertPlanAuth(..., "leer")` — debe tener HLg vigente en ese GDT
 *   (MVP; expansión a subárbol → listarArbolGdtPlantel Fase 1b).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertPlanAuth } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { obtenerYmdHoyInstitucional } = require("../../modules/shared/fechaLaboralYmd");
const {
  normalizeYmd,
  obtenerPlantelPorGdtCore,
} = require("../../modules/organizacion/obtenerPlantelPorGdtCore");

const obtenerPlantelPorGdtCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const gdtId = typeof d.gdt_id === "string" ? d.gdt_id.trim() : "";
  if (!/^gdt_/i.test(gdtId)) {
    throw new HttpsError("invalid-argument", "gdt_id inválido.");
  }

  const aFechaRaw =
    typeof d.a_fecha === "string" && d.a_fecha.trim()
      ? d.a_fecha.trim()
      : obtenerYmdHoyInstitucional();
  const aFechaYmd = normalizeYmd(aFechaRaw);
  if (!aFechaYmd) {
    throw new HttpsError("invalid-argument", "a_fecha inválida (YYYY-MM-DD).");
  }

  const token = request.auth.token || {};
  const esRrhh = tokenHasRrhhLaborAccess(token);
  if (!esRrhh) {
    await assertPlanAuth(request, gdtId, "leer");
  }

  try {
    const result = await obtenerPlantelPorGdtCore(db, { gdtId, aFechaYmd });
    if (!result.ok) {
      throw new HttpsError(
        /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
        result.message || "No se pudo obtener el plantel.",
      );
    }
    return {
      ok: true,
      gdt: result.gdt,
      a_fecha: result.a_fecha,
      total: result.total,
      integrantes: result.integrantes,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("obtenerPlantelPorGdt", err);
    throw new HttpsError(
      "internal",
      err instanceof Error ? err.message : "Error al obtener plantel por GDT.",
    );
  }
});

module.exports = { obtenerPlantelPorGdt: obtenerPlantelPorGdtCallable };
