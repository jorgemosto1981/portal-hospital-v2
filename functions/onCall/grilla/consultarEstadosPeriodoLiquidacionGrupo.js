"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertPlanAuth, tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const {
  consultarEstadosPeriodoLiquidacionGrupoBatch,
} = require("../../modules/asistencia/asistenciaPeriodoLiquidacion");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");

const consultarEstadosPeriodoLiquidacionGrupo = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const raw = Array.isArray(d.items) ? d.items : [];
  const parsed = raw
    .map((it) => ({
      grupo_trabajo_id: String(it?.grupo_trabajo_id || "").trim(),
      anio: Number(it?.anio),
      mes: Number(it?.mes),
    }))
    .filter(
      (it) =>
        /^gdt_/i.test(it.grupo_trabajo_id) &&
        Number.isFinite(it.anio) &&
        Number.isFinite(it.mes) &&
        it.mes >= 1 &&
        it.mes <= 12,
    )
    .slice(0, 48);

  if (parsed.length === 0) {
    throw new HttpsError("invalid-argument", "items[] con grupo_trabajo_id, anio y mes es obligatorio.");
  }

  const esRrhh =
    runtimeFlags.OPEN_ACCESS_TEMP === true || tokenHasRrhhAccess(request.auth.token);
  const items = [];
  for (const it of parsed) {
    if (esRrhh) {
      items.push(it);
      continue;
    }
    try {
      await assertPlanAuth(request, it.grupo_trabajo_id, "leer");
      items.push(it);
    } catch (err) {
      if (!(err instanceof HttpsError) || err.code !== "permission-denied") {
        throw err;
      }
    }
  }

  if (items.length === 0) {
    throw new HttpsError("permission-denied", "Sin permisos para consultar estos grupos.");
  }

  try {
    return await consultarEstadosPeriodoLiquidacionGrupoBatch(db, { items });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("consultarEstadosPeriodoLiquidacionGrupo", err);
    throw new HttpsError("internal", "Error al consultar estado de período.");
  }
});

module.exports = { consultarEstadosPeriodoLiquidacionGrupo };
