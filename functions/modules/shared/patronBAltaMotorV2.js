"use strict";

/**
 * Motor alta solicitud Patron B V2 — compuesto sobre orquestador generico.
 *
 * Fases: P -> C -> E -> W -> F -> T -> S -> G
 * Genera motor_snapshot, config_usada y contexto_auditoria (misma shape que LAO).
 *
 * Decisiones V2:
 * - tope_dias_por_evento: <= (no igualdad estricta)
 * - Multi-dia en CORRIDOS: desbloqueado
 * - Cableado total 7 bloques
 */

const { runMotorPipeline, motorCheck, mergeMotivosFromChecks } = require("./motorSolicitudOrquestador");
const { resolvePatronBMotorConfig, buildPatronBConfigUsada, assertPatronSaldoB } = require("./patronBMotorConfigResolver");
const { resolvePatronSaldo, PATRON_SALDO_B } = require("./resolvePatronSaldo");
const { ensamblarContextoDeAuditoria, buildMotorSnapshot } = require("./laoMotorAuditoriaSnapshot");
const { evaluatePreavisoWarnings } = require("./laoAltaMotorCompleto");
const { parseYmd } = require("./laoPreviewDateUtils");
const { saldoAnualDocId, pickBolsaParaConsumo } = require("./laoSaldosBolsa");
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
const {
  resolvePatronBConsumoDesdeSolicitud,
  CODIGOS_CONSUMO,
  esArticuloPatronBSinCupoAnualCiclo,
} = require("./opcionesConsumoSolicitud");
const {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronBAsync,
} = require("./patronBFechasSolicitud");

const MOTOR_VERSION_B = "patron-b-v2";

const MENSAJES_OPCION_CONSUMO = {
  [CODIGOS_CONSUMO.OPCION_CONSUMO_REQUERIDA]: "Debe elegir el vínculo (opcion_consumo_id).",
  [CODIGOS_CONSUMO.OPCION_CONSUMO_INVALIDA]: "La opción de consumo no es válida para este artículo.",
  [CODIGOS_CONSUMO.SIN_OPCIONES_CONSUMO]: "El artículo no admite opciones de consumo.",
  [CODIGOS_CONSUMO.DIAS_NO_COINCIDEN_OPCION]:
    "Los días solicitados no coinciden con la opción de vínculo elegida.",
};

function patronFromVersion(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  const topes = versionData?.bloque_topes_plazos_computo || {};
  return resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, ident.es_lao_anual === true);
}

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

async function loadHlcArray(db, personaId) {
  const snap = await db.collection("historial_laboral_cargos").where("persona_id", "==", personaId).get();
  return snap.docs.map((doc) => mapHlcRow({ ...(doc.data() || {}), id: doc.id }, doc.id));
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

// ---------------------------------------------------------------------------
// Fases del pipeline
// ---------------------------------------------------------------------------

function faseP(versionData) {
  return {
    id: "P",
    run() {
      try {
        resolvePatronBMotorConfig(versionData);
        return { checks: [motorCheck("P", "PATRON_SALDO_B", "ok", "Patron de saldo B verificado.")] };
      } catch (err) {
        const code = err?.code || "ERROR_PATRON_SALDO_NO_B";
        return { checks: [motorCheck("P", code, "bloqueante", err?.message || String(err))] };
      }
    },
  };
}

function faseC(db, versionData, fechaDesde, fechaHasta, diasPedidos, authToken) {
  return {
    id: "C",
    async run() {
      const fechasVal = await validarFechasArticuloEnMotor(db, {
        versionData,
        fechaDesde,
        fechaHasta: fechaHasta || fechaDesde,
        diasSolicitados: diasPedidos,
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

function faseT(diasPedidos, cfg) {
  return {
    id: "T",
    run() {
      const checks = [];
      const topeEvento = Number(cfg.tope_dias_por_evento);
      if (Number.isFinite(topeEvento) && topeEvento > 0 && diasPedidos > topeEvento) {
        checks.push(motorCheck("T", CODIGO_SALDO_EVENTO, "bloqueante",
          `Dias solicitados (${diasPedidos}) superan el tope por evento (${topeEvento}).`));
        return { checks };
      }
      if (Number.isFinite(topeEvento) && topeEvento > 0) {
        checks.push(motorCheck("T", "TOPE_EVENTO_OK", "ok", `${diasPedidos} <= ${topeEvento} dias por evento.`));
      }

      const minEvento = Number(cfg.dias_minimos_por_evento);
      if (Number.isFinite(minEvento) && minEvento > 0 && diasPedidos < minEvento) {
        checks.push(motorCheck("T", "ERROR_DIAS_MINIMOS", "bloqueante",
          `Dias solicitados (${diasPedidos}) menor al minimo por evento (${minEvento}).`));
        return { checks };
      }
      if (Number.isFinite(minEvento) && minEvento > 0) {
        checks.push(motorCheck("T", "MINIMO_DIAS_OK", "ok", `${diasPedidos} >= ${minEvento} minimo por evento.`));
      }

      return { checks };
    },
  };
}

function faseS(db, personaId, articuloId, anioCiclo, diasPedidos, versionData) {
  return {
    id: "S",
    async run() {
      if (esArticuloPatronBSinCupoAnualCiclo(versionData)) {
        return {
          checks: [
            motorCheck(
              "S",
              "SALDO_EVENTO_SIN_CICLO",
              "ok",
              "Sin cupo anual: control por evento (Fase T); no descuenta bolsa de ciclo.",
            ),
          ],
          data: { sin_descuento_bolsa_ciclo: true },
        };
      }

      const salId = saldoAnualDocId(personaId, anioCiclo);
      if (!salId) {
        return { checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante", "Saldo anual invalido.")] };
      }

      const salSnap = await db.collection("saldos_articulo_agente").doc(salId).get();
      if (!salSnap.exists) {
        return {
          checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante", "No hay saldo disponible en el ciclo.")],
          data: { saldo_doc_id: salId },
        };
      }

      const match = pickBolsaParaConsumo(salSnap.data() || {}, articuloId, anioCiclo);
      if (!match) {
        return {
          checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante", "No hay bolsa para este articulo en el ciclo.")],
          data: { saldo_doc_id: salId },
        };
      }

      const disp = Number(match.bolsa.disponible);
      if (!Number.isFinite(disp) || disp < diasPedidos) {
        return {
          checks: [motorCheck("S", CODIGO_SALDO_CICLO, "bloqueante",
            `Saldo insuficiente: disponible ${disp}, solicitado ${diasPedidos}.`)],
          data: { saldo_doc_id: salId, bolsa_id: match.bolsaId, saldo_disponible: disp },
        };
      }

      return {
        checks: [motorCheck("S", "SALDO_OK", "ok", `Saldo disponible ${disp}, solicitado ${diasPedidos}.`)],
        data: {
          saldo_doc_id: salId,
          bolsa_id: match.bolsaId,
          saldo_disponible: disp,
          saldo_restante_preview: disp - diasPedidos,
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
      return { checks: [motorCheck("G", "GRILLA_OK", "ok", "Grilla horaria autorizada.")] };
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
async function runPatronBAltaMotorV2(params) {
  const { db, solicitud, excludeSolId, authToken, versionData, versionId } = params;

  const personaId = String(solicitud.titular_persona_id || "").trim();
  const articuloId = String(solicitud.articulo_id || "").trim();
  const fechaDesde = String(solicitud.fecha_desde || "").slice(0, 10);
  const fechaHastaIn = String(solicitud.fecha_hasta || "").slice(0, 10);
  const anioCiclo = Number(solicitud.anio_ciclo_consumo);

  const pDesde = parseYmd(fechaDesde);
  if (!pDesde) {
    return buildRejection([CODIGO_FECHA_RANGO], [mensajeParaCodigo(CODIGO_FECHA_RANGO)], versionData, versionId);
  }
  if (anioCiclo !== pDesde.y) {
    return buildRejection([CODIGO_FECHA_RANGO], ["anio_ciclo_consumo no coincide con fecha_desde."], versionData, versionId);
  }

  const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, solicitud);
  if (!consumo.ok) {
    const codigo = consumo.codigo || CODIGOS_CONSUMO.OPCION_CONSUMO_INVALIDA;
    const mensaje = MENSAJES_OPCION_CONSUMO[codigo] || mensajeParaCodigo(codigo) || codigo;
    return buildRejection([codigo], [mensaje], versionData, versionId);
  }

  const versionEff = consumo.versionEff;
  const diasPedidos = consumo.diasPedidos;
  const fechaHastaPre = await fechaHastaDesdeVersionPatronBAsync(db, fechaDesde, diasPedidos, versionEff);
  const fechaHasta =
    fechaHastaIn && fechaHastaIn >= fechaDesde ? fechaHastaIn : fechaHastaPre;

  const cfg = resolvePatronBMotorConfig(versionEff);
  const configUsada = buildPatronBConfigUsada(cfg, versionId);
  const contextoAuditoria = ensamblarContextoDeAuditoria(versionEff);

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
    faseP(versionEff),
    faseC(db, versionEff, fechaDesde, fechaHasta, diasPedidos, authToken),
    faseE(db, versionEff, personaId, fechaDesde, hlcArray, diasExternos, authToken, excludeSolId),
    faseW(versionEff, fechaDesde),
    faseF(db, personaId, articuloId, fechaDesde, topeMes, excludeSolId),
    faseT(diasPedidos, cfg),
    faseS(db, personaId, articuloId, anioCiclo, diasPedidos, versionEff),
    faseG(db, personaId, fechaDesde, cfg, grupoAncla.ok ? grupoAncla.grupo_trabajo_id_ancla : null),
  ];

  const pipeline = await runMotorPipeline(fases);

  const motor_snapshot = buildMotorSnapshot({
    versionId,
    checks: pipeline.checks,
    warnings: pipeline.warnings,
    asignacionBlock: pipeline.eligible ? {
      dias_consumo: diasPedidos,
      anio_ciclo_consumo: anioCiclo,
      bolsa_id: pipeline.ctx.bolsa_id || null,
      saldo_disponible: pipeline.ctx.saldo_disponible ?? null,
      saldo_restante_preview: pipeline.ctx.saldo_restante_preview ?? null,
    } : null,
    contextoAuditoria,
    configUsada,
    eligible: pipeline.eligible,
  });
  motor_snapshot.motor_version = MOTOR_VERSION_B;

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
    dias_consumo: diasPedidos,
    anio_ciclo_consumo: anioCiclo,
    bolsa_id: pipeline.ctx.bolsa_id || null,
    saldo_doc_id: pipeline.ctx.saldo_doc_id || null,
    saldo_disponible: pipeline.ctx.saldo_disponible ?? null,
    saldo_restante_preview: pipeline.ctx.saldo_restante_preview ?? null,
    sin_descuento_bolsa_ciclo: pipeline.ctx.sin_descuento_bolsa_ciclo === true,
    frecuencia_mes: pipeline.ctx.frecuencia_mes || null,
    fecha_hasta: pipeline.ctx.fechaHastaEff || fechaHastaPre || fechaDesde,
    opcion_consumo_id: consumo.opcion_consumo_id || null,
    codigo_sarh_opcion: consumo.opcion?.codigo_sarh || null,
    calendario_resumen: pipeline.ctx.fechasVal?.calendario_resumen || null,
    modo_computo: pipeline.ctx.fechasVal?.modo_computo || readModoCalculo(versionEff).modo,
    usa_calendario_institucional: pipeline.ctx.fechasVal?.usa_calendario_institucional === true,
    incluye_feriados_institucionales: pipeline.ctx.fechasVal?.incluye_feriados_institucionales === true,
    articulo_id: articuloId,
    fase_corte: pipeline.fase_corte,
  };
}

function buildRejection(codigos, mensajes, versionData, versionId) {
  const contextoAuditoria = ensamblarContextoDeAuditoria(versionData);
  let configUsada = null;
  try {
    const cfg = resolvePatronBMotorConfig(versionData);
    configUsada = buildPatronBConfigUsada(cfg, versionId);
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
  motor_snapshot.motor_version = MOTOR_VERSION_B;

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
    dias_consumo: 0,
    anio_ciclo_consumo: 0,
    bolsa_id: null,
    saldo_doc_id: null,
    saldo_disponible: null,
    saldo_restante_preview: null,
    frecuencia_mes: null,
    fecha_hasta: null,
    calendario_resumen: null,
    modo_computo: null,
    fase_corte: "PRE",
  };
}

module.exports = {
  runPatronBAltaMotorV2,
  MOTOR_VERSION_B,
  PATRON_SALDO_B,
  patronFromVersion,
  countSolicitudesMesArticulo,
  loadHlcArray,
};
