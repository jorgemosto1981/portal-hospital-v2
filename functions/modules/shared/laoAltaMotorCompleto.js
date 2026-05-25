"use strict";

/**
 * Orquestador LAO v2 — preview y alta (motor_snapshot SSoT).
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §6
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const { formatYmdEnZona, obtenerYmdHoyInstitucional } = require("./fechaInstitucionalBa");
const { anchorFromYmd, parseYmd } = require("./laoPreviewDateUtils");
const {
  assertPatronSaldoLAO,
  validarDiasMinimosR3,
  laoMotorError,
} = require("./laoMotorConfigResolver");
const { runLaoAsignacionDiasCore, MOTOR_VERSION } = require("./laoAsignacionDiasCore");
const {
  ensamblarContextoDeAuditoria,
  buildConfigUsada,
  buildMotorSnapshot,
} = require("./laoMotorAuditoriaSnapshot");
const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
  CODIGO_SUPERPOSICION,
  mensajeParaCodigo,
} = require("./solicitudElegibilidadLaboral");

function addDaysToYmd(ymd, days) {
  const anchor = anchorFromYmd(ymd);
  if (anchor == null) return ymd;
  return formatYmdEnZona(anchor + Math.floor(days) * MS_PER_DAY);
}

/**
 * R4 — preaviso normativo / retroactividad (advertencias, no bloquean).
 * @param {object} versionData
 * @param {string} fechaDesdeYmd
 * @param {string} [hoyYmd]
 */
function evaluatePreavisoWarnings(versionData, fechaDesdeYmd, hoyYmd = obtenerYmdHoyInstitucional()) {
  const workflow = versionData?.bloque_workflow_sla_cobertura || {};
  const warnings = [];
  const checks = [];

  const plazoNorm = Number(workflow.plazo_preaviso_normativa_dias);
  if (Number.isFinite(plazoNorm) && plazoNorm > 0) {
    const limiteNorm = addDaysToYmd(hoyYmd, plazoNorm);
    if (fechaDesdeYmd < limiteNorm) {
      warnings.push({
        codigo: "PREAVISO_FUERA_NORMA",
        copy: `Presentación con menos de ${plazoNorm} días de preaviso normativo. El hospital permite el trámite bajo aviso institucional.`,
        campos_origen: ["plazo_preaviso_normativa_dias", "fecha_desde"],
      });
      checks.push({
        fase: "W",
        codigo: "PREAVISO_FUERA_NORMA",
        nivel: "advertencia",
        detalle: `fecha_desde ${fechaDesdeYmd} anterior a ${limiteNorm}.`,
      });
    }
  }

  const plazoInst = Number(workflow.plazo_preaviso_interno_dias);
  if (Number.isFinite(plazoInst) && plazoInst > 0) {
    const limiteInst = addDaysToYmd(hoyYmd, plazoInst);
    if (fechaDesdeYmd < limiteInst) {
      checks.push({
        fase: "W",
        codigo: "PREAVISO_INSTITUCIONAL",
        nivel: "advertencia",
        detalle: `fecha_desde anterior al plazo institucional (${plazoInst} días).`,
      });
    }
  }

  if (fechaDesdeYmd < hoyYmd) {
    if (workflow.permite_retroactividad === true) {
      warnings.push({
        codigo: "PREAVISO_RETROACTIVIDAD",
        copy: "La fecha de inicio es anterior a hoy; trámite permitido con trazabilidad institucional.",
        campos_origen: ["permite_retroactividad", "fecha_desde"],
      });
      checks.push({
        fase: "W",
        codigo: "PREAVISO_RETROACTIVIDAD",
        nivel: "advertencia",
        detalle: `fecha_desde ${fechaDesdeYmd} en el pasado (hoy ${hoyYmd}).`,
      });
    }
  }

  return { warnings, checks };
}

function pushCheck(checks, fase, codigo, nivel, detalle) {
  checks.push({ fase, codigo, nivel, detalle });
}

function mergeMotivos(checks, extra = []) {
  const bloqueantes = checks.filter((c) => c.nivel === "bloqueante");
  const msgs = bloqueantes.map((c) => c.detalle).filter(Boolean);
  return [...msgs, ...extra];
}

/**
 * Campos legacy para UI que aún consume shape v1 parcial.
 * @param {object} asignacionResult
 */
function buildLegacyPreviewCompat(asignacionResult) {
  if (!asignacionResult || !asignacionResult.ok) {
    return {
      camino: asignacionResult?.camino_bolsa ?? "rechazado",
      motor_version: MOTOR_VERSION,
    };
  }
  const caminoBolsa = asignacionResult.camino_bolsa;
  const caminoAsig = asignacionResult.camino_asignacion;
  return {
    camino: caminoBolsa,
    motor_version: MOTOR_VERSION,
    anio_solicitud: asignacionResult.anio_solicitud,
    anio_origen_bolsa: asignacionResult.anio_origen_bolsa,
    fecha_desde: asignacionResult.fecha_desde,
    antiguedad: asignacionResult.antiguedad,
    guardas: asignacionResult.guardas
      ? {
          julio_primero: {
            aplica: caminoBolsa === "proporcional",
            ok: asignacionResult.guardas.apertura,
          },
          tse_180: {
            aplica: caminoBolsa === "proporcional",
            ok: asignacionResult.guardas.tse,
            dias_tse: asignacionResult.asignacion?.dias_tse,
            minimo: asignacionResult.asignacion?.tse_minimo_aplicado,
          },
        }
      : undefined,
    matriz: asignacionResult.matriz,
    proporcional: {
      aplica: caminoAsig === "proporcional",
      dias_proporcionales_piso: caminoAsig === "proporcional" ? asignacionResult.asignacion?.cupo : null,
      meses_para_formula: asignacionResult.asignacion?.meses_computables_ejercicio,
    },
    stock: {
      aplica: caminoBolsa === "stock",
    },
  };
}

/**
 * @param {object} params
 * @param {object} params.versionData
 * @param {string} params.versionId
 * @param {string} params.fechaDesdeYmd
 * @param {string} params.fechaHastaYmd
 * @param {number} params.anioOrigenBolsa
 * @param {number} [params.anioCalendarioActual]
 * @param {unknown[]} [params.hlcArray]
 * @param {number} [params.diasExternos]
 * @param {{ inicioUtc: number, finUtc: number }[]} [params.exclusionIntervals]
 * @param {Record<string, string>} [params.operadorCodigoPorId]
 * @param {number} [params.diasSolicitados]
 * @param {number} [params.disponibleBolsa]
 * @param {object} [params.persona]
 * @param {string} [params.personaId]
 * @param {object} [params.fechasVal] — resultado previo validarFechasArticulo
 * @param {object} [params.superposicionVal] — resultado previo validarSuperposicionLaoEnMotor
 * @param {object} [params.saldoEval] — resultado evaluarSaldoBolsaParaPreview
 * @param {string} [params.hoyYmd]
 */
function runLaoAltaMotorCompleto(params) {
  const {
    versionData,
    versionId = "",
    fechaDesdeYmd,
    fechaHastaYmd,
    anioOrigenBolsa,
    anioCalendarioActual,
    hlcArray = [],
    diasExternos = 0,
    exclusionIntervals = [],
    operadorCodigoPorId = {},
    diasSolicitados,
    disponibleBolsa,
    persona,
    personaId = "",
    fechasVal,
    superposicionVal,
    saldoEval,
    hoyYmd = obtenerYmdHoyInstitucional(),
  } = params;

  const checks = [];
  const warnings = [];
  const motivosExtra = [];
  let asignacionResult = null;

  const contextoAuditoria = ensamblarContextoDeAuditoria(versionData);
  const configUsada = buildConfigUsada(versionData, versionId);

  try {
    assertPatronSaldoLAO(versionData);
    pushCheck(checks, "A", "PATRON_SALDO_A", "ok", "Patrón de saldo A verificado.");
  } catch (err) {
    const code = err?.code || "ERROR_PATRON_SALDO_NO_A";
    pushCheck(checks, "A", code, "bloqueante", err instanceof Error ? err.message : String(err));
    const motor_snapshot = buildMotorSnapshot({
      versionId,
      checks,
      warnings,
      asignacionBlock: null,
      contextoAuditoria,
      configUsada,
      eligible: false,
    });
    return finalize(false, motor_snapshot, checks, warnings, null, motivosExtra);
  }

  if (fechasVal) {
    pushCheck(
      checks,
      "C",
      fechasVal.ok ? "FECHAS_OK" : "ERROR_FECHAS",
      fechasVal.ok ? "ok" : "bloqueante",
      fechasVal.ok ? "Rango y cómputo de fechas válidos." : (fechasVal.mensajes || []).join(" "),
    );
    if (!fechasVal.ok) {
      const motor_snapshot = buildMotorSnapshot({
        versionId,
        checks,
        warnings,
        asignacionBlock: null,
        contextoAuditoria,
        configUsada,
        eligible: false,
      });
      return finalize(false, motor_snapshot, checks, warnings, null, fechasVal.mensajes || []);
    }
  }

  if (persona && personaId) {
    const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesdeYmd);
    const eleg = resolverElegibilidadSolicitud({
      versionData,
      hlcVigentes,
      personaId,
      fechaDesde: fechaDesdeYmd,
      diasExternos,
      skipPortalRoleCheck: true,
    });
    pushCheck(
      checks,
      "E",
      eleg.ok ? "ELEGIBILIDAD_OK" : "ERROR_ELEGIBILIDAD",
      eleg.ok ? "ok" : "bloqueante",
      eleg.ok ? "Elegibilidad laboral verificada." : (eleg.mensajes || []).join(" "),
    );
    if (!eleg.ok) {
      const motor_snapshot = buildMotorSnapshot({
        versionId,
        checks,
        warnings,
        asignacionBlock: null,
        contextoAuditoria,
        configUsada,
        eligible: false,
      });
      return finalize(false, motor_snapshot, checks, warnings, null, eleg.mensajes || []);
    }
  }

  if (superposicionVal != null) {
    if (superposicionVal.ok) {
      pushCheck(checks, "E", "SUPERPOSICION_OK", "ok", "Sin superposición bloqueante en el rango.");
    } else {
      const codigo = superposicionVal.codigo || CODIGO_SUPERPOSICION;
      const detalle =
        superposicionVal.mensaje ||
        mensajeParaCodigo(codigo) ||
        "Superposición de fechas detectada.";
      pushCheck(checks, "E", codigo, "bloqueante", detalle);
      const motor_snapshot = buildMotorSnapshot({
        versionId,
        checks,
        warnings,
        asignacionBlock: null,
        contextoAuditoria,
        configUsada,
        eligible: false,
      });
      return finalize(false, motor_snapshot, checks, warnings, null, [detalle]);
    }
  }

  const preaviso = evaluatePreavisoWarnings(versionData, fechaDesdeYmd, hoyYmd);
  warnings.push(...preaviso.warnings);
  checks.push(...preaviso.checks);

  asignacionResult = runLaoAsignacionDiasCore({
    versionData,
    fechaDesdeYmd,
    fechaHastaYmd,
    anioOrigenBolsa,
    anioCalendarioActual: anioCalendarioActual ?? parseYmd(fechaDesdeYmd)?.y,
    hlcArray,
    diasExternos,
    exclusionIntervals,
    operadorCodigoPorId,
  });

  for (const c of asignacionResult.codigos || []) {
    checks.push({
      fase: c.fase || "L",
      codigo: c.codigo,
      nivel: c.nivel || "bloqueante",
      detalle: asignacionResult.motivos_ineligibilidad?.find((m) => m.includes(c.codigo)) || c.codigo,
    });
  }
  if (asignacionResult.eligible) {
    pushCheck(checks, "L", "ASIGNACION_OK", "ok", `Camino ${asignacionResult.camino_asignacion}.`);
  }

  let eligible = asignacionResult.eligible === true;

  if (eligible && diasSolicitados != null && Number.isFinite(Number(disponibleBolsa))) {
    const config = asignacionResult.config_usada || {};
    const minRes = validarDiasMinimosR3(diasSolicitados, {
      minConfig: configUsada.dias_minimos_por_evento,
      disponibleBolsa: disponibleBolsa,
    });
    if (!minRes.ok) {
      pushCheck(checks, "S", minRes.code || "ERROR_DIAS_MINIMOS", "bloqueante", minRes.detalle || "");
      eligible = false;
      motivosExtra.push(minRes.detalle || "");
    } else {
      pushCheck(checks, "S", "MINIMO_DIAS_OK", "ok", "Mínimo de días (R3) verificado.");
    }
  }

  if (eligible && saldoEval && saldoEval.ok === false) {
    pushCheck(checks, "S", "ERROR_SALDO_INSUFICIENTE", "bloqueante", (saldoEval.motivos || []).join(" "));
    eligible = false;
    motivosExtra.push(...(saldoEval.motivos || []));
  } else if (eligible && saldoEval?.ok === true) {
    pushCheck(checks, "S", "SALDO_OK", "ok", `Saldo disponible ${saldoEval.disponible ?? "n/d"}.`);
  }

  const asignacionBlock = asignacionResult.asignacion
    ? {
        ...asignacionResult.asignacion,
        camino_bolsa: asignacionResult.camino_bolsa,
        camino_asignacion: asignacionResult.camino_asignacion,
      }
    : null;

  const motor_snapshot = buildMotorSnapshot({
    versionId,
    checks,
    warnings,
    asignacionBlock,
    contextoAuditoria,
    configUsada,
    eligible,
  });

  return finalize(eligible, motor_snapshot, checks, warnings, asignacionResult, motivosExtra);
}

function finalize(eligible, motor_snapshot, checks, warnings, asignacionResult, motivosExtra) {
  const legacy = buildLegacyPreviewCompat(asignacionResult);
  const motivos_ineligibilidad = eligible
    ? [...(asignacionResult?.motivos_ineligibilidad || [])].filter(Boolean)
    : mergeMotivos(checks, [
        ...(asignacionResult?.motivos_ineligibilidad || []),
        ...motivosExtra,
      ]);

  return {
    ok: true,
    eligible: Boolean(eligible),
    motor_snapshot,
    checks,
    warnings,
    motivos_ineligibilidad: [...new Set(motivos_ineligibilidad.filter(Boolean))],
    config_usada: motor_snapshot.config_usada,
    ...legacy,
    asignacion: asignacionResult?.asignacion,
    codigos: checks.filter((c) => c.nivel === "bloqueante").map((c) => c.codigo),
  };
}

/**
 * Cupo operativo para descuento de saldo (wizard / trigger).
 * @param {ReturnType<typeof runLaoAltaMotorCompleto>} resultado
 */
function resolveCupoOperativoDesdeMotor(resultado) {
  if (!resultado?.eligible) return 0;
  const cupo = Number(resultado.asignacion?.cupo ?? resultado.proporcional?.dias_proporcionales_piso);
  if (Number.isFinite(cupo) && cupo > 0) return cupo;
  const base = Number(resultado.matriz?.dias_base);
  return Number.isFinite(base) && base > 0 ? base : 0;
}

module.exports = {
  runLaoAltaMotorCompleto,
  evaluatePreavisoWarnings,
  resolveCupoOperativoDesdeMotor,
  MOTOR_VERSION,
};
