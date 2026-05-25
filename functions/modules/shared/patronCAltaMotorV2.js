"use strict";

/**
 * Motor alta solicitud Patron C V2 — compuesto sobre orquestador generico.
 *
 * Patron C = cuenta corriente continua (saldo global, origen externo, horas).
 * Fases: P -> C -> E -> W -> F -> T -> S -> G
 * Genera motor_snapshot, config_usada y contexto_auditoria (misma shape que A/B).
 *
 * Decisiones V2:
 * - Unidad nativa: horas (cfg_uma_horas); campo solicitud: horas_solicitadas
 * - Saldo global: sal_global_per_* / bol_{art}_global / anio_origen=0
 * - Sin anio_ciclo_consumo (cuenta corriente interanual)
 * - tope_dias_por_evento se interpreta como horas cuando unidad=horas
 * - Cableado total 7 bloques
 */

const { runMotorPipeline, motorCheck, mergeMotivosFromChecks } = require("./motorSolicitudOrquestador");
const { resolvePatronCMotorConfig, buildPatronCConfigUsada, assertPatronSaldoC } = require("./patronCMotorConfigResolver");
const { resolvePatronSaldo, PATRON_SALDO_C } = require("./resolvePatronSaldo");
const { ensamblarContextoDeAuditoria, buildMotorSnapshot } = require("./laoMotorAuditoriaSnapshot");
const { evaluatePreavisoWarnings } = require("./laoAltaMotorCompleto");
const { parseYmd } = require("./laoPreviewDateUtils");
const { saldoGlobalDocId, pickBolsaParaConsumo } = require("./laoSaldosBolsa");
const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
  mapHlcRow,
  mensajeParaCodigo,
  CODIGO_SUPERPOSICION,
  CODIGO_SALDO_CICLO,
  CODIGO_SALDO_MES,
  CODIGO_SALDO_EVENTO,
  CODIGO_FECHA_RANGO,
} = require("./solicitudElegibilidadLaboral");
const { validarSuperposicionFechasPatronB } = require("./patronBSuperposicionValidacion");
const { resolverGrupoTrabajoIdAnclaParaSolicitud } = require("./solicitudGrupoTrabajoAncla");
const { validarGrillaHorariaParaSolicitud } = require("./mdcGrillaHorariaGate");
const { validarFechasArticuloEnMotor, readModoCalculo } = require("./validarFechasArticuloRuntime");
const { tokenHasRrhhLaborAccess } = require("./laborProfile");

const MOTOR_VERSION_C = "patron-c-v2";
const ANIO_ORIGEN_GLOBAL = 0;

const ESTADOS_CUENTAN_FRECUENCIA_MES = new Set([
  "cfg_esa_borrador",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
  "cfg_esa_aprobada",
]);

function resolveExternosDesdePersona(persona) {
  if (!persona || typeof persona !== "object") return 0;
  const n = Number(persona.antiguedad_reconocida_dias ?? persona.dias_antiguedad_reconocida);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function countSolicitudesMesArticulo(db, personaId, articuloId, anio, mes, excludeSolId = "") {
  const snap = await db
    .collection("solicitudes_articulo")
    .where("titular_persona_id", "==", personaId)
    .where("articulo_id", "==", articuloId)
    .get();
  let n = 0;
  for (const doc of snap.docs) {
    if (excludeSolId && doc.id === excludeSolId) continue;
    const s = doc.data() || {};
    if (s.estado_solicitud_id === "cfg_esa_rechazada") continue;
    const fd = typeof s.fecha_desde === "string" ? s.fecha_desde.slice(0, 10) : "";
    const p = parseYmd(fd);
    if (!p || p.y !== anio || p.mo !== mes) continue;
    if (!ESTADOS_CUENTAN_FRECUENCIA_MES.has(String(s.estado_solicitud_id || ""))) continue;
    n += 1;
  }
  return n;
}

/**
 * Resuelve la cantidad a consumir segun unidad de medida.
 * Si la unidad es horas, usa horas_solicitadas; si es dias, usa dias_solicitados.
 */
function resolveConsumo(solicitud, cfg) {
  if (cfg.unidad_medida_id === "cfg_uma_horas") {
    const h = Number(solicitud.horas_solicitadas);
    return { cantidad: Number.isFinite(h) && h > 0 ? h : 0, unidad: "horas" };
  }
  const d = Number(solicitud.dias_solicitados);
  return { cantidad: Number.isFinite(d) && d > 0 ? Math.floor(d) : 1, unidad: "dias" };
}

// ---------------------------------------------------------------------------
// Fases del pipeline
// ---------------------------------------------------------------------------

function faseP(versionData) {
  return {
    id: "P",
    run() {
      try {
        resolvePatronCMotorConfig(versionData);
        return { checks: [motorCheck("P", "PATRON_SALDO_C", "ok", "Patron de saldo C verificado.")] };
      } catch (err) {
        const code = err?.code || "ERROR_PATRON_SALDO_NO_C";
        return { checks: [motorCheck("P", code, "bloqueante", err?.message || String(err))] };
      }
    },
  };
}

function faseC(db, versionData, fechaDesde, fechaHasta, cantidadConsumo, authToken) {
  return {
    id: "C",
    async run() {
      const fechasVal = await validarFechasArticuloEnMotor(db, {
        versionData,
        fechaDesde,
        fechaHasta: fechaHasta || fechaDesde,
        diasSolicitados: cantidadConsumo,
        omitirHorizonte: tokenHasRrhhLaborAccess(authToken),
      });
      if (!fechasVal.ok) {
        return {
          checks: [motorCheck("C", "ERROR_FECHAS", "bloqueante", (fechasVal.mensajes || []).join(" "))],
          data: { fechasVal },
        };
      }
      return {
        checks: [motorCheck("C", "FECHAS_OK", "ok", "Rango y computo de fechas validos.")],
        data: {
          fechasVal,
          fechaHastaEff: fechasVal.fecha_hasta || fechaDesde,
        },
      };
    },
  };
}

function faseE(db, versionData, personaId, fechaDesde, hlcArray, diasExternos, authToken, excludeSolId) {
  return {
    id: "E",
    async run(ctx) {
      const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde);
      const eleg = resolverElegibilidadSolicitud({
        versionData,
        hlcVigentes,
        personaId,
        fechaDesde,
        diasExternos,
        authToken,
        skipPortalRoleCheck: authToken == null,
      });
      if (!eleg.ok) {
        return {
          checks: [motorCheck("E", "ERROR_ELEGIBILIDAD", "bloqueante", (eleg.mensajes || []).join(" "))],
          data: { elegibilidad: eleg },
        };
      }

      const fechaHastaEff = ctx.fechaHastaEff || fechaDesde;
      const superpos = await validarSuperposicionFechasPatronB(db, {
        persona_id: personaId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHastaEff,
        exclude_sol_id: excludeSolId || "",
        version_data: versionData,
      });
      const checks = [motorCheck("E", "ELEGIBILIDAD_OK", "ok", "Elegibilidad laboral verificada.")];
      if (!superpos.ok) {
        checks.push(
          motorCheck("E", superpos.codigo || CODIGO_SUPERPOSICION, "bloqueante",
            superpos.mensaje || mensajeParaCodigo(CODIGO_SUPERPOSICION) || "Superposicion de fechas."),
        );
        return { checks, data: { elegibilidad: eleg, superposicion: superpos } };
      }
      checks.push(motorCheck("E", "SUPERPOSICION_OK", "ok", "Sin superposicion bloqueante."));
      return { checks, data: { elegibilidad: eleg, superposicion: superpos } };
    },
  };
}

function faseW(versionData, fechaDesde) {
  return {
    id: "W",
    run() {
      return evaluatePreavisoWarnings(versionData, fechaDesde);
    },
  };
}

function faseF(db, personaId, articuloId, fechaDesde, topeMes, excludeSolId) {
  return {
    id: "F",
    async run() {
      if (!Number.isFinite(topeMes) || topeMes <= 0) {
        return { checks: [motorCheck("F", "FRECUENCIA_SIN_TOPE", "ok", "Sin tope de frecuencia mensual.")] };
      }
      const pDesde = parseYmd(fechaDesde);
      if (!pDesde) {
        return { checks: [motorCheck("F", "ERROR_FECHA_FRECUENCIA", "bloqueante", "Fecha invalida para frecuencia.")] };
      }
      const enMes = await countSolicitudesMesArticulo(db, personaId, articuloId, pDesde.y, pDesde.mo, excludeSolId || "");
      if (enMes >= topeMes) {
        return {
          checks: [motorCheck("F", CODIGO_SALDO_MES, "bloqueante", mensajeParaCodigo(CODIGO_SALDO_MES))],
          data: { frecuencia_mes: { en_mes: enMes, tope_mes: Math.floor(topeMes) } },
        };
      }
      return {
        checks: [motorCheck("F", "FRECUENCIA_OK", "ok", `${enMes}/${Math.floor(topeMes)} solicitudes en el mes.`)],
        data: { frecuencia_mes: { en_mes: enMes, tope_mes: Math.floor(topeMes) } },
      };
    },
  };
}

function faseT(cantidadConsumo, unidadLabel, cfg) {
  return {
    id: "T",
    run() {
      const checks = [];
      const topeEvento = Number(cfg.tope_dias_por_evento);
      if (Number.isFinite(topeEvento) && topeEvento > 0 && cantidadConsumo > topeEvento) {
        checks.push(motorCheck("T", CODIGO_SALDO_EVENTO, "bloqueante",
          `${unidadLabel} solicitadas (${cantidadConsumo}) superan el tope por evento (${topeEvento}).`));
        return { checks };
      }
      if (Number.isFinite(topeEvento) && topeEvento > 0) {
        checks.push(motorCheck("T", "TOPE_EVENTO_OK", "ok", `${cantidadConsumo} <= ${topeEvento} ${unidadLabel} por evento.`));
      }

      const minEvento = Number(cfg.dias_minimos_por_evento);
      if (Number.isFinite(minEvento) && minEvento > 0 && cantidadConsumo < minEvento) {
        checks.push(motorCheck("T", "ERROR_MINIMO_EVENTO", "bloqueante",
          `${unidadLabel} solicitadas (${cantidadConsumo}) menor al minimo por evento (${minEvento}).`));
        return { checks };
      }
      if (Number.isFinite(minEvento) && minEvento > 0) {
        checks.push(motorCheck("T", "MINIMO_EVENTO_OK", "ok", `${cantidadConsumo} >= ${minEvento} minimo ${unidadLabel} por evento.`));
      }

      return { checks };
    },
  };
}

function faseS(db, personaId, articuloId, cantidadConsumo, unidadLabel) {
  return {
    id: "S",
    async run() {
      const salId = saldoGlobalDocId(personaId);
      if (!salId) {
        return { checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante", "Saldo global invalido.")] };
      }

      const salSnap = await db.collection("saldos_articulo_agente").doc(salId).get();
      if (!salSnap.exists) {
        return {
          checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante", "No hay saldo global disponible.")],
          data: { saldo_doc_id: salId },
        };
      }

      const match = pickBolsaParaConsumo(salSnap.data() || {}, articuloId, ANIO_ORIGEN_GLOBAL);
      if (!match) {
        return {
          checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante", "No hay bolsa global para este articulo.")],
          data: { saldo_doc_id: salId },
        };
      }

      const disp = Number(match.bolsa.disponible);
      if (!Number.isFinite(disp) || disp < cantidadConsumo) {
        return {
          checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante",
            `Saldo insuficiente: disponible ${disp} ${unidadLabel}, solicitado ${cantidadConsumo}.`)],
          data: { saldo_doc_id: salId, bolsa_id: match.bolsaId, saldo_disponible: disp },
        };
      }

      return {
        checks: [motorCheck("S", "SALDO_OK", "ok", `Saldo disponible ${disp} ${unidadLabel}, solicitado ${cantidadConsumo}.`)],
        data: {
          saldo_doc_id: salId,
          bolsa_id: match.bolsaId,
          saldo_disponible: disp,
          saldo_restante_preview: disp - cantidadConsumo,
        },
      };
    },
  };
}

function faseG(db, personaId, fechaDesde, cfg, grupoTrabajoId) {
  return {
    id: "G",
    async run(ctx) {
      const fechaHastaEff = ctx.fechaHastaEff || fechaDesde;
      const gateGrilla = await validarGrillaHorariaParaSolicitud(db, {
        depende_rda: cfg.depende_rda,
        persona_id: personaId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHastaEff,
        grupo_trabajo_id: grupoTrabajoId || undefined,
      });
      if (!gateGrilla.ok) {
        return {
          checks: [motorCheck("G", gateGrilla.codigo || "GRILLA_NO_AUTORIZADA", "bloqueante",
            gateGrilla.mensaje || "Grilla horaria no autorizada.")],
        };
      }
      return {
        checks: [motorCheck("G", "GRILLA_OK", "ok", "Grilla horaria autorizada.")],
        data: { grilla: gateGrilla },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   db: import("firebase-admin/firestore").Firestore,
 *   solicitud: Record<string, unknown>,
 *   excludeSolId?: string,
 *   authToken?: unknown,
 *   versionData: object,
 *   versionId: string,
 * }} params
 */
async function runPatronCAltaMotorV2(params) {
  const { db, solicitud, excludeSolId, authToken, versionData, versionId } = params;

  const personaId = String(solicitud.titular_persona_id || "").trim();
  const articuloId = String(solicitud.articulo_id || "").trim();
  const fechaDesde = String(solicitud.fecha_desde || "").slice(0, 10);
  const fechaHasta = String(solicitud.fecha_hasta || "").slice(0, 10);

  const pDesde = parseYmd(fechaDesde);
  if (!pDesde) {
    return buildRejection([CODIGO_FECHA_RANGO], [mensajeParaCodigo(CODIGO_FECHA_RANGO)], versionData, versionId);
  }

  const cfg = resolvePatronCMotorConfig(versionData);
  const configUsada = buildPatronCConfigUsada(cfg, versionId);
  const contextoAuditoria = ensamblarContextoDeAuditoria(versionData);

  const { cantidad: cantidadConsumo, unidad: unidadLabel } = resolveConsumo(solicitud, cfg);
  if (cantidadConsumo <= 0) {
    return buildRejection(["ERROR_CANTIDAD"], ["Cantidad solicitada debe ser mayor a cero."], versionData, versionId);
  }

  const topeMes = Number(cfg.tope_frecuencia_mensual);

  const [personaSnap, hlcSnap] = await Promise.all([
    db.collection("personas").doc(personaId).get(),
    db.collection("historial_laboral_cargos").where("persona_id", "==", personaId).get(),
  ]);

  const hlcArray = hlcSnap.docs.map((doc) => mapHlcRow({ ...(doc.data() || {}), id: doc.id }, doc.id));
  const diasExternos = resolveExternosDesdePersona(personaSnap.exists ? personaSnap.data() : null);

  const grupoAncla = await resolverGrupoTrabajoIdAnclaParaSolicitud(db, {
    persona_id: personaId,
    fecha_desde: fechaDesde,
    grupo_trabajo_id_ancla:
      String(solicitud.grupo_trabajo_id_ancla || solicitud.grupo_de_trabajo_id || "").trim() || null,
  });

  const fases = [
    faseP(versionData),
    faseC(db, versionData, fechaDesde, fechaHasta, cantidadConsumo, authToken),
    faseE(db, versionData, personaId, fechaDesde, hlcArray, diasExternos, authToken, excludeSolId),
    faseW(versionData, fechaDesde),
    faseF(db, personaId, articuloId, fechaDesde, topeMes, excludeSolId),
    faseT(cantidadConsumo, unidadLabel, cfg),
    faseS(db, personaId, articuloId, cantidadConsumo, unidadLabel),
    faseG(db, personaId, fechaDesde, cfg, grupoAncla.ok ? grupoAncla.grupo_trabajo_id_ancla : null),
  ];

  const pipeline = await runMotorPipeline(fases);

  const motor_snapshot = buildMotorSnapshot({
    versionId,
    checks: pipeline.checks,
    warnings: pipeline.warnings,
    asignacionBlock: pipeline.eligible ? {
      cantidad_consumo: cantidadConsumo,
      unidad_consumo: unidadLabel,
      bolsa_id: pipeline.ctx.bolsa_id || null,
      saldo_disponible: pipeline.ctx.saldo_disponible ?? null,
      saldo_restante_preview: pipeline.ctx.saldo_restante_preview ?? null,
    } : null,
    contextoAuditoria,
    configUsada,
    eligible: pipeline.eligible,
  });
  motor_snapshot.motor_version = MOTOR_VERSION_C;

  const motivos = pipeline.eligible
    ? []
    : mergeMotivosFromChecks(pipeline.checks);

  return {
    ok: pipeline.eligible,
    eligible: pipeline.eligible,
    motor_snapshot,
    config_usada: configUsada,
    checks: pipeline.checks,
    warnings: pipeline.warnings,
    codigos: pipeline.checks.filter((c) => c.nivel === "bloqueante").map((c) => c.codigo),
    mensajes: motivos,
    motivos_ineligibilidad: motivos,
    hlc_id: pipeline.ctx.elegibilidad?.hlc_id ?? null,
    grupo_trabajo_id_ancla: grupoAncla.ok ? grupoAncla.grupo_trabajo_id_ancla : null,
    grupos_trabajo_vigentes: grupoAncla.grupos_vigentes || [],
    requiere_seleccion_grupo: grupoAncla.requiere_seleccion === true,
    cantidad_consumo: cantidadConsumo,
    unidad_consumo: unidadLabel,
    bolsa_id: pipeline.ctx.bolsa_id || null,
    saldo_doc_id: pipeline.ctx.saldo_doc_id || null,
    saldo_disponible: pipeline.ctx.saldo_disponible ?? null,
    saldo_restante_preview: pipeline.ctx.saldo_restante_preview ?? null,
    frecuencia_mes: pipeline.ctx.frecuencia_mes || null,
    fecha_hasta: pipeline.ctx.fechaHastaEff || fechaDesde,
    calendario_resumen: pipeline.ctx.fechasVal?.calendario_resumen || null,
    modo_computo: pipeline.ctx.fechasVal?.modo_computo || readModoCalculo(versionData).modo,
    usa_calendario_institucional: pipeline.ctx.fechasVal?.usa_calendario_institucional === true,
    incluye_feriados_institucionales: pipeline.ctx.fechasVal?.incluye_feriados_institucionales === true,
    grilla: pipeline.ctx.grilla || null,
    articulo_id: articuloId,
    fase_corte: pipeline.fase_corte,
  };
}

function buildRejection(codigos, mensajes, versionData, versionId) {
  const contextoAuditoria = ensamblarContextoDeAuditoria(versionData);
  let configUsada = null;
  try {
    const cfg = resolvePatronCMotorConfig(versionData);
    configUsada = buildPatronCConfigUsada(cfg, versionId);
  } catch { /* pre-validation rejection */ }

  const motor_snapshot = buildMotorSnapshot({
    versionId,
    checks: codigos.map((c) => motorCheck("PRE", c, "bloqueante", mensajes[0] || c)),
    warnings: [],
    asignacionBlock: null,
    contextoAuditoria,
    configUsada,
    eligible: false,
  });
  motor_snapshot.motor_version = MOTOR_VERSION_C;

  return {
    ok: false,
    eligible: false,
    motor_snapshot,
    config_usada: configUsada,
    checks: motor_snapshot.checks,
    warnings: [],
    codigos,
    mensajes,
    motivos_ineligibilidad: mensajes,
    hlc_id: null,
    grupo_trabajo_id_ancla: null,
    grupos_trabajo_vigentes: [],
    cantidad_consumo: 0,
    unidad_consumo: null,
    bolsa_id: null,
    saldo_doc_id: null,
    saldo_disponible: null,
    saldo_restante_preview: null,
    frecuencia_mes: null,
    fecha_hasta: null,
    calendario_resumen: null,
    modo_computo: null,
    grilla: null,
    fase_corte: "PRE",
  };
}

module.exports = {
  runPatronCAltaMotorV2,
  MOTOR_VERSION_C,
  PATRON_SALDO_C,
  ANIO_ORIGEN_GLOBAL,
  countSolicitudesMesArticulo,
  resolveConsumo,
};
