"use strict";

const { logger } = require("firebase-functions");
const {
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcComandosConstants");
const {
  encolarComandoMdcTicketera,
  buildMdcPayloadDesdeSolicitud,
} = require("./mdcTicketeraEmisor");
const { limpiarIdempotenciaMdc, enriquecerGruposTrabajoAvisoMedico } = require("./avisoMedicoGrillaMdcCore");
const {
  esSolicitudMedAviso,
  mapSolicitudMedAvisoParaMdc,
  resolverRangoYmdAvisoMedico,
  resolverRangoYmdEfectivoAvisoMedico,
} = require("./avisoMedicoGrillaMdcPayload");
const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");

const ESTADO_RECHAZADA = "cfg_esa_rechazada";
const ESTADO_APROBADA = "cfg_esa_aprobada";
const ESTADO_ESPERANDO_JUNTA = "cfg_esa_esperando_dictamen_junta";

const COL_SOL = "solicitudes_articulo";

/**
 * @param {string} estadoDestino
 */
function resolverComandoMdcPrincipalEstadoMedica(estadoDestino) {
  const est = String(estadoDestino || "").trim();
  if (est === ESTADO_RECHAZADA) return MDC_COMANDO_REVERTIR_PROYECCION;
  if (est === ESTADO_APROBADA) return MDC_COMANDO_CONSOLIDAR_APROBADO;
  if (est === ESTADO_ESPERANDO_JUNTA) return MDC_COMANDO_PROYECTAR_PENDIENTE;
  return null;
}

/**
 * @param {{ fecha_desde: string, fecha_hasta: string }|null|undefined} a
 * @param {{ fecha_desde: string, fecha_hasta: string }|null|undefined} b
 */
function rangosYmdIguales(a, b) {
  if (!a || !b) return false;
  return a.fecha_desde === b.fecha_desde && a.fecha_hasta === b.fecha_hasta;
}

/**
 * Plan puro de comandos MDC (mismo `sol_id`, sin trámites paralelos).
 *
 * @param {string} estadoDestino
 * @param {{ fecha_desde: string, fecha_hasta: string }|null} rangoProyeccionAnterior
 * @param {{ fecha_desde: string, fecha_hasta: string }|null} rangoEfectivoPosterior
 */
function planificarComandosMutacionMedicaAviso(estadoDestino, rangoProyeccionAnterior, rangoEfectivoPosterior) {
  const comandoPrincipal = resolverComandoMdcPrincipalEstadoMedica(estadoDestino);
  if (!comandoPrincipal) {
    return { ok: false, codigo: "ESTADO_SIN_MDC", comandos: [] };
  }

  /** @type {Array<{ comando: string, fecha_desde: string, fecha_hasta: string }>} */
  const comandos = [];

  if (estadoDestino === ESTADO_RECHAZADA) {
    const rango = rangoProyeccionAnterior || rangoEfectivoPosterior;
    if (rango) {
      comandos.push({
        comando: MDC_COMANDO_REVERTIR_PROYECCION,
        fecha_desde: rango.fecha_desde,
        fecha_hasta: rango.fecha_hasta,
      });
    }
    return { ok: true, comandos };
  }

  if (
    rangoProyeccionAnterior &&
    rangoEfectivoPosterior &&
    !rangosYmdIguales(rangoProyeccionAnterior, rangoEfectivoPosterior)
  ) {
    comandos.push({
      comando: MDC_COMANDO_REVERTIR_PROYECCION,
      fecha_desde: rangoProyeccionAnterior.fecha_desde,
      fecha_hasta: rangoProyeccionAnterior.fecha_hasta,
    });
  }

  if (rangoEfectivoPosterior) {
    comandos.push({
      comando: comandoPrincipal,
      fecha_desde: rangoEfectivoPosterior.fecha_desde,
      fecha_hasta: rangoEfectivoPosterior.fecha_hasta,
    });
  }

  return { ok: true, comandos };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {string} versionId
 * @param {Map<string, unknown>} cache
 */
async function resolverCodigoGrillaArticuloVersion(db, articuloId, versionId, cache) {
  const art = String(articuloId || "").trim();
  const ver = String(versionId || "").trim();
  if (!/^art_/i.test(art)) return "";
  if (/^ver_/i.test(ver)) {
    const snap = await db.collection("cfg_articulos").doc(art).collection("versiones").doc(ver).get();
    if (snap.exists) {
      const vd = snap.data() || {};
      const cg =
        vd?.bloque_identidad_naturaleza?.visualizacion?.codigo_grilla ??
        vd?.visualizacion?.codigo_grilla;
      if (cg) return String(cg).trim();
    }
  }
  const display = await loadArticuloDisplay(db, art, cache);
  return String(display.codigo_grilla || "").trim();
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {Record<string, unknown>} solBase
 * @param {{ comando: string, fecha_desde: string, fecha_hasta: string }} cmd
 * @param {string} codigoGrilla
 */
async function ejecutarComandoMdcMutacion(db, solId, solBase, cmd, codigoGrilla) {
  const payload = buildMdcPayloadDesdeSolicitud(
    {
      ...solBase,
      id: solId,
      codigo_grilla: codigoGrilla,
      fecha_desde: cmd.fecha_desde,
      fecha_hasta: cmd.fecha_hasta,
    },
    cmd.comando,
  );
  await limpiarIdempotenciaMdc(db, solId, cmd.comando);
  return encolarComandoMdcTicketera(db, payload);
}

/**
 * Mutación MDC post-clasificación (mismo `sol_id` — §5.9 RFC Caja Negra).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solicitudId: string,
 *   estadoDestino: string,
 *   rangoProyeccionAnterior?: { fecha_desde: string, fecha_hasta: string } | null,
 * }} input
 */
async function mutarEstadoSolicitudMedicaMdc(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  const estadoDestino = String(input.estadoDestino || "").trim();
  if (!/^sol_/i.test(solicitudId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO" };
  }

  const snap = await db.collection(COL_SOL).doc(solicitudId).get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADA" };
  }

  const raw = snap.data() || {};
  if (!esSolicitudMedAviso(raw)) {
    return { ok: false, codigo: "NO_MED_AVISO" };
  }

  const artCache = new Map();
  const codigoGrilla = await resolverCodigoGrillaArticuloVersion(
    db,
    String(raw.articulo_id || ""),
    String(raw.version_id_aplicada || ""),
    artCache,
  );

  let sol = { id: solicitudId, ...raw, codigo_grilla: codigoGrilla || raw.codigo_grilla };
  sol = await enriquecerGruposTrabajoAvisoMedico(db, sol, solicitudId);

  const rangoPosterior = resolverRangoYmdEfectivoAvisoMedico(sol);
  const rangoAnterior =
    input.rangoProyeccionAnterior && input.rangoProyeccionAnterior.fecha_desde
      ? input.rangoProyeccionAnterior
      : resolverRangoYmdAvisoMedico(sol);

  const plan = planificarComandosMutacionMedicaAviso(estadoDestino, rangoAnterior, rangoPosterior);
  if (!plan.ok || !plan.comandos.length) {
    return { ok: false, codigo: plan.codigo || "SIN_COMANDOS_MDC" };
  }

  const mapped = mapSolicitudMedAvisoParaMdc(sol, solicitudId);
  if (!mapped) {
    return { ok: false, codigo: "RANGO_FECHAS_INVALIDO" };
  }

  const codigoParaMdc = String(mapped.codigo_grilla || codigoGrilla || "").trim();
  if (!codigoParaMdc && estadoDestino !== ESTADO_RECHAZADA) {
    return { ok: false, codigo: "CODIGO_GRILLA_REQUERIDO" };
  }

  /** @type {Array<Record<string, unknown>>} */
  const resultados = [];
  for (const cmd of plan.comandos) {
    const result = await ejecutarComandoMdcMutacion(
      db,
      solicitudId,
      { ...mapped, estado_solicitud_id: estadoDestino },
      cmd,
      codigoParaMdc,
    );
    resultados.push({ comando: cmd.comando, ...result });
    if (result.ok !== true && result.skipped !== true) {
      logger.warn("mutacion_medica_mdc_paso_fallido", {
        solicitudId,
        estadoDestino,
        comando: cmd.comando,
        codigo: result.codigo,
      });
      return {
        ok: false,
        codigo: result.codigo || "MDC_MUTACION_FALLIDA",
        comando_fallido: cmd.comando,
        resultados,
      };
    }
  }

  return {
    ok: true,
    solicitud_id: solicitudId,
    estado_solicitud_id: estadoDestino,
    comandos: plan.comandos.map((c) => c.comando),
    resultados,
  };
}

function mutarEstadoSolicitudMedicaMdcAsync(db, input) {
  void mutarEstadoSolicitudMedicaMdc(db, input).catch((err) => {
    logger.warn("mutacion_medica_mdc_async_error", {
      solicitudId: input?.solicitudId,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

module.exports = {
  resolverComandoMdcPrincipalEstadoMedica,
  planificarComandosMutacionMedicaAviso,
  mutarEstadoSolicitudMedicaMdc,
  mutarEstadoSolicitudMedicaMdcAsync,
};
