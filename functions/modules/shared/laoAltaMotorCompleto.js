"use strict";

/**
 * Orquestador LAO v2 — preview y alta (motor_snapshot SSoT).
 * Refactorizado sobre runMotorPipeline generico (paridad Patron B).
 * Fases: A -> C -> E -> W -> L -> S
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §6
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const { formatYmdEnZona, obtenerYmdHoyInstitucional } = require("./fechaInstitucionalBa");
const { parseYmd } = require("./laoPreviewDateUtils");
const { anchorFromYmd } = require("./laoPreviewDateUtils");
const {
  assertPatronSaldoLAO,
  validarDiasMinimosR3,
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
const { runMotorPipeline, motorCheck, mergeMotivosFromChecks } = require("./motorSolicitudOrquestador");

function addDaysToYmd(ymd, days) {
  const anchor = anchorFromYmd(ymd);
  if (anchor == null) return ymd;
  return formatYmdEnZona(anchor + Math.floor(days) * MS_PER_DAY);
}

/**
 * R4 — preaviso normativo / retroactividad (advertencias, no bloquean).
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
      checks.push(motorCheck("W", "PREAVISO_FUERA_NORMA", "advertencia",
        `fecha_desde ${fechaDesdeYmd} anterior a ${limiteNorm}.`));
    }
  }

  const plazoInst = Number(workflow.plazo_preaviso_interno_dias);
  if (Number.isFinite(plazoInst) && plazoInst > 0) {
    const limiteInst = addDaysToYmd(hoyYmd, plazoInst);
    if (fechaDesdeYmd < limiteInst) {
      checks.push(motorCheck("W", "PREAVISO_INSTITUCIONAL", "advertencia",
        `fecha_desde anterior al plazo institucional (${plazoInst} días).`));
    }
  }

  if (fechaDesdeYmd < hoyYmd) {
    if (workflow.permite_retroactividad === true) {
      warnings.push({
        codigo: "PREAVISO_RETROACTIVIDAD",
        copy: "La fecha de inicio es anterior a hoy; trámite permitido con trazabilidad institucional.",
        campos_origen: ["permite_retroactividad", "fecha_desde"],
      });
      checks.push(motorCheck("W", "PREAVISO_RETROACTIVIDAD", "advertencia",
        `fecha_desde ${fechaDesdeYmd} en el pasado (hoy ${hoyYmd}).`));
    }
  }

  return { warnings, checks };
}

/**
 * Campos legacy para UI que aún consume shape v1 parcial.
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

// ---------------------------------------------------------------------------
// Fases del pipeline LAO
// ---------------------------------------------------------------------------

function faseA(versionData) {
  return {
    id: "A",
    run() {
      try {
        assertPatronSaldoLAO(versionData);
        return { checks: [motorCheck("A", "PATRON_SALDO_A", "ok", "Patrón de saldo A verificado.")] };
      } catch (err) {
        const code = err?.code || "ERROR_PATRON_SALDO_NO_A";
        return { checks: [motorCheck("A", code, "bloqueante", err instanceof Error ? err.message : String(err))] };
      }
    },
  };
}

function faseC(fechasVal) {
  return {
    id: "C",
    run() {
      if (!fechasVal) return { checks: [] };
      if (fechasVal.ok) {
        return { checks: [motorCheck("C", "FECHAS_OK", "ok", "Rango y cómputo de fechas válidos.")] };
      }
      return {
        checks: [motorCheck("C", "ERROR_FECHAS", "bloqueante", (fechasVal.mensajes || []).join(" "))],
      };
    },
  };
}

function faseE(persona, personaId, versionData, hlcArray, fechaDesdeYmd, diasExternos, superposicionVal) {
  return {
    id: "E",
    run() {
      const checks = [];
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
        if (!eleg.ok) {
          checks.push(motorCheck("E", "ERROR_ELEGIBILIDAD", "bloqueante", (eleg.mensajes || []).join(" ")));
          return { checks };
        }
        checks.push(motorCheck("E", "ELEGIBILIDAD_OK", "ok", "Elegibilidad laboral verificada."));
      }

      if (superposicionVal != null) {
        if (superposicionVal.ok) {
          checks.push(motorCheck("E", "SUPERPOSICION_OK", "ok", "Sin superposición bloqueante en el rango."));
        } else {
          const codigo = superposicionVal.codigo || CODIGO_SUPERPOSICION;
          const detalle = superposicionVal.mensaje || mensajeParaCodigo(codigo) || "Superposición de fechas detectada.";
          checks.push(motorCheck("E", codigo, "bloqueante", detalle));
        }
      }
      return { checks };
    },
  };
}

function faseW(versionData, fechaDesdeYmd, hoyYmd) {
  return {
    id: "W",
    run() {
      return evaluatePreavisoWarnings(versionData, fechaDesdeYmd, hoyYmd);
    },
  };
}

function faseL(versionData, fechaDesdeYmd, fechaHastaYmd, anioOrigenBolsa, anioCalendarioActual, hlcArray, diasExternos, exclusionIntervals, operadorCodigoPorId) {
  return {
    id: "L",
    run() {
      const result = runLaoAsignacionDiasCore({
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

      const checks = [];
      for (const c of result.codigos || []) {
        checks.push(motorCheck(c.fase || "L", c.codigo, c.nivel || "bloqueante",
          result.motivos_ineligibilidad?.find((m) => m.includes(c.codigo)) || c.codigo));
      }
      if (result.eligible) {
        checks.push(motorCheck("L", "ASIGNACION_OK", "ok", `Camino ${result.camino_asignacion}.`));
      }
      return { checks, data: { asignacionResult: result } };
    },
  };
}

function faseS(diasSolicitados, disponibleBolsa, configUsada, saldoEval) {
  return {
    id: "S",
    run() {
      const checks = [];
      if (diasSolicitados != null && Number.isFinite(Number(disponibleBolsa))) {
        const minRes = validarDiasMinimosR3(diasSolicitados, {
          minConfig: configUsada.dias_minimos_por_evento,
          disponibleBolsa,
        });
        if (!minRes.ok) {
          checks.push(motorCheck("S", minRes.code || "ERROR_DIAS_MINIMOS", "bloqueante", minRes.detalle || ""));
          return { checks };
        }
        checks.push(motorCheck("S", "MINIMO_DIAS_OK", "ok", "Mínimo de días (R3) verificado."));
      }

      if (saldoEval && saldoEval.ok === false) {
        checks.push(motorCheck("S", "ERROR_SALDO_INSUFICIENTE", "bloqueante", (saldoEval.motivos || []).join(" ")));
      } else if (saldoEval?.ok === true) {
        checks.push(motorCheck("S", "SALDO_OK", "ok", `Saldo disponible ${saldoEval.disponible ?? "n/d"}.`));
      }
      return { checks };
    },
  };
}

// ---------------------------------------------------------------------------
// Orquestador principal — sobre runMotorPipeline genérico
// ---------------------------------------------------------------------------

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
 * @param {object} [params.fechasVal]
 * @param {object} [params.superposicionVal]
 * @param {object} [params.saldoEval]
 * @param {string} [params.hoyYmd]
 */
async function runLaoAltaMotorCompleto(params) {
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

  const contextoAuditoria = ensamblarContextoDeAuditoria(versionData);
  const configUsada = buildConfigUsada(versionData, versionId);

  const fases = [
    faseA(versionData),
    faseC(fechasVal),
    faseE(persona, personaId, versionData, hlcArray, fechaDesdeYmd, diasExternos, superposicionVal),
    faseW(versionData, fechaDesdeYmd, hoyYmd),
    faseL(versionData, fechaDesdeYmd, fechaHastaYmd, anioOrigenBolsa, anioCalendarioActual, hlcArray, diasExternos, exclusionIntervals, operadorCodigoPorId),
    faseS(diasSolicitados, disponibleBolsa, configUsada, saldoEval),
  ];

  const pipeline = await runMotorPipeline(fases);

  const asignacionResult = pipeline.ctx.asignacionResult || null;
  const asignacionBlock = asignacionResult?.asignacion
    ? {
        ...asignacionResult.asignacion,
        camino_bolsa: asignacionResult.camino_bolsa,
        camino_asignacion: asignacionResult.camino_asignacion,
      }
    : null;

  const motor_snapshot = buildMotorSnapshot({
    versionId,
    checks: pipeline.checks,
    warnings: pipeline.warnings,
    asignacionBlock,
    contextoAuditoria,
    configUsada,
    eligible: pipeline.eligible,
  });

  const legacy = buildLegacyPreviewCompat(asignacionResult);
  const motivos = pipeline.eligible
    ? [...(asignacionResult?.motivos_ineligibilidad || [])].filter(Boolean)
    : mergeMotivosFromChecks(pipeline.checks, [
        ...(asignacionResult?.motivos_ineligibilidad || []),
      ]);

  return {
    ok: true,
    eligible: pipeline.eligible,
    motor_snapshot,
    checks: pipeline.checks,
    warnings: pipeline.warnings,
    motivos_ineligibilidad: [...new Set(motivos.filter(Boolean))],
    config_usada: motor_snapshot.config_usada,
    ...legacy,
    asignacion: asignacionResult?.asignacion,
    codigos: pipeline.checks.filter((c) => c.nivel === "bloqueante").map((c) => c.codigo),
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
