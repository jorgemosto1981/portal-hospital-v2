"use strict";

/**
 * Materialización Art. 77-0 (rechazo autorización o alta RRHH).
 * @see docs/v2/RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md
 */

const { ulid } = require("ulid");
const { FieldValue } = require("./context");
const { ESTADO_SOLICITUD_APROBADA } = require("./solicitudesArticuloEstados");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
} = require("./mdcTicketeraEmisor");
const { registrarEventoTicket } = require("./registrarEventoTicket");
const { TIPO_EVENTO_TICKET, ORIGEN_EVENTO } = require("./solicitudEventosTicketConstants");
const {
  MODO_RESOLUCION_JEFE_AUTORIZACION,
  modoResolucionJefeDesdeSolicitud,
  modoResolucionJefeDesdeVersion,
} = require("./modoResolucionJefe");
const {
  sumarDiasInjustificadosVentana,
  umbralInjustificadasExcedido,
} = require("./acumuladoInasistenciasInjustificadas");
const { parseYmd } = require("./laoPreviewDateUtils");

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @param {string} rolId
 */
function versionIncluyeRolEnCircuito(versionData, rolId) {
  const rol = String(rolId || "").trim();
  if (!rol) return false;
  const bloque = versionData?.bloque_workflow_sla_cobertura;
  const raw = bloque && typeof bloque === "object" ? bloque.circuito_ingreso_ids : [];
  const list = Array.isArray(raw) ? raw.map((x) => String(x || "").trim()).filter(Boolean) : [];
  return list.includes(rol);
}

const COL_SOL = "solicitudes_articulo";
const COL_ART = "cfg_articulos";
const COD_77_0 = "77-0";
const ORIGEN_ACTO_ALTA_RRHH = "alta_rrhh";
const ORIGEN_ACTO_RECHAZO_JEFE = "rechazo_autorizacion_jefe";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @returns {Promise<{ artId: string, verId: string, versionData: Record<string, unknown> }|null>}
 */
async function resolverArticulo770Publicado(db) {
  const snap = await db.collection(COL_ART).where("codigo", "==", COD_77_0).limit(2).get();
  if (snap.empty) return null;
  const artId = snap.docs[0].id;
  const vers = await db
    .collection(COL_ART)
    .doc(artId)
    .collection("versiones")
    .where("estado_version_id", "==", "cfg_est_ver_publicada")
    .limit(2)
    .get();
  if (vers.empty) return null;
  return { artId, verId: vers.docs[0].id, versionData: vers.docs[0].data() || {} };
}

/**
 * @param {Record<string, unknown>} sol
 * @param {{ decision_ui?: string, codigo_grilla?: string }} opts
 */
function debeMaterializar770AlRechazar(sol, opts = {}) {
  const decisionUi = String(opts.decision_ui || "").trim().toLowerCase();
  if (decisionUi === "observado") return false;
  const modo = modoResolucionJefeDesdeSolicitud(sol, opts.codigo_grilla || sol.codigo_grilla);
  return modo === MODO_RESOLUCION_JEFE_AUTORIZACION;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   artId: string,
 *   versionData: Record<string, unknown>,
 *   solHijaId: string,
 *   titularId: string,
 *   fechaDesde: string,
 *   fechaHasta: string,
 *   diasSol: number,
 *   actorPersonaId: string,
 *   origenRechazoSolId: string | null,
 * }} params
 */
async function evaluarUmbral770TrasAlta(db, params) {
  const wf = params.versionData.bloque_workflow_sla_cobertura || {};
  const umbral =
    wf.umbral_inasistencias_injustificadas_dias == null
      ? 10
      : Math.max(1, Math.floor(Number(wf.umbral_inasistencias_injustificadas_dias)));
  const ventana =
    wf.ventana_acumulado_meses == null
      ? 12
      : Math.max(1, Math.floor(Number(wf.ventana_acumulado_meses)));
  const notificar = wf.notificar_rrhh_al_umbral !== false;

  let diasAcumulados = params.diasSol;
  let alertaEmitida = false;

  if (notificar && params.titularId) {
    const snapTitular = await db
      .collection(COL_SOL)
      .where("titular_persona_id", "==", params.titularId)
      .where("articulo_id", "==", params.artId)
      .get();
    const sols = snapTitular.docs.map((d) => {
      const x = d.data() || {};
      return {
        fecha_desde: x.fecha_desde,
        dias_solicitados: x.dias_solicitados,
        estado_solicitud_id: x.estado_solicitud_id,
        articulo_id: x.articulo_id,
        codigo_grilla: x.codigo_grilla || COD_77_0,
      };
    });
    sols.push({
      fecha_desde: params.fechaDesde,
      dias_solicitados: params.diasSol,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      articulo_id: params.artId,
      codigo_grilla: COD_77_0,
    });
    diasAcumulados = sumarDiasInjustificadosVentana(sols, {
      articuloId77: params.artId,
      fechaHastaRef: params.fechaHasta,
      ventanaMeses: ventana,
    });

    if (umbralInjustificadasExcedido(diasAcumulados, umbral)) {
      const perRef = db.collection("personas").doc(params.titularId);
      const perSnap = await perRef.get();
      const ya =
        perSnap.exists &&
        perSnap.data()?.alerta_77_0_umbral_pendiente_rrhh === true &&
        String(perSnap.data()?.alerta_77_0_umbral_sol_id || "") === params.solHijaId;
      if (!ya) {
        await perRef.set(
          {
            alerta_77_0_umbral_pendiente_rrhh: true,
            alerta_77_0_umbral_dias: diasAcumulados,
            alerta_77_0_umbral_sol_id: params.solHijaId,
            alerta_77_0_umbral_en: FieldValue.serverTimestamp(),
            actualizado_en: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        void registrarEventoTicket(db, params.solHijaId, {
          tipo_evento: TIPO_EVENTO_TICKET.ALERTA_77_0_UMBRAL_EXCEDIDO,
          actor_persona_id: params.actorPersonaId,
          titular_persona_id: params.titularId,
          estado_anterior_id: null,
          estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
          origen: ORIGEN_EVENTO.SISTEMA,
          accion: "alerta_77_0_umbral",
          metadata: {
            codigo_grilla: COD_77_0,
            dias_acumulados: diasAcumulados,
            umbral_dias: umbral,
            ventana_meses: ventana,
            fecha_desde: params.fechaDesde,
            origen_rechazo_sol_id: params.origenRechazoSolId,
          },
        });
        alertaEmitida = true;
      }
    }
  }

  return { diasAcumulados, alertaEmitida };
}

/**
 * Motor centralizado Art. 77-0.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titularPersonaId: string,
 *   fechaDesde: string,
 *   fechaHasta?: string | null,
 *   diasSolicitados?: number | null,
 *   grupoTrabajoIdAncla?: string | null,
 *   gruposTrabajoInvolucradosIds?: string[] | null,
 *   actorPersonaId: string,
 *   origenActo: string,
 *   origenRechazoSolId?: string | null,
 *   observacionAlta?: string | null,
 *   art?: { artId: string, verId: string, versionData: Record<string, unknown> } | null,
 * }} params
 */
async function materializarSol770(db, params) {
  const art = params.art || (await resolverArticulo770Publicado(db));
  if (!art) {
    return { ok: false, codigo: "ART_77_0_NO_CONFIGURADO", mensaje: "Art. 77-0 no está publicado en el catálogo." };
  }

  const titularId = String(params.titularPersonaId || "").trim();
  if (!/^per_/i.test(titularId)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "titular_persona_id inválido." };
  }

  const fechaDesde = String(params.fechaDesde || "").slice(0, 10);
  if (!parseYmd(fechaDesde)) {
    return { ok: false, codigo: "FECHA_INVALIDA", mensaje: "fecha_desde inválida." };
  }
  const fechaHasta = String(params.fechaHasta || fechaDesde).slice(0, 10);
  const dias = Number(params.diasSolicitados);
  const diasSol = Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 1;
  const gdt = String(params.grupoTrabajoIdAncla || "").trim() || null;
  const actorPersonaId = String(params.actorPersonaId || "").trim() || null;
  const origenActo = String(params.origenActo || ORIGEN_ACTO_RECHAZO_JEFE).trim();
  const origenRechazoSolId = String(params.origenRechazoSolId || "").trim() || null;
  const observacionAltaRaw =
    typeof params.observacionAlta === "string" ? params.observacionAlta.trim() : "";
  const observacionAlta = observacionAltaRaw ? observacionAltaRaw.slice(0, 2000) : null;
  const solHijaId = `sol_${ulid()}`;

  const grupos =
    Array.isArray(params.gruposTrabajoInvolucradosIds) && params.gruposTrabajoInvolucradosIds.length
      ? params.gruposTrabajoInvolucradosIds.map((x) => String(x || "").trim()).filter(Boolean)
      : gdt
        ? [gdt]
        : [];

  /** @type {Record<string, unknown>} */
  const hija = {
    schema_version: 2,
    patron_saldo: "B",
    articulo_id: art.artId,
    version_id_aplicada: art.verId,
    codigo_grilla: COD_77_0,
    titular_persona_id: titularId,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    dias_solicitados: diasSol,
    grupo_trabajo_id_ancla: gdt,
    grupos_trabajo_involucrados_ids: grupos,
    estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
    modo_resolucion_jefe: "ninguno",
    origen_rechazo_sol_id: origenRechazoSolId,
    origen_acto: origenActo,
    creado_por_persona_id: actorPersonaId,
    motor_descuento_aplicado: false,
    es_sancion: true,
    es_inasistencia: true,
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };
  if (observacionAlta) hija.observacion_alta = observacionAlta;

  await db.collection(COL_SOL).doc(solHijaId).set(hija);

  dispararMdcDesdeSolicitudAsync(
    db,
    solHijaId,
    {
      ...hija,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      codigo_grilla: COD_77_0,
    },
    MDC_COMANDO_CONSOLIDAR_APROBADO,
  );

  const accionEvento =
    origenActo === ORIGEN_ACTO_ALTA_RRHH ? "art_77_0_alta_rrhh" : "art_77_0_derivado_rechazo";

  void registrarEventoTicket(db, solHijaId, {
    tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
    actor_persona_id: actorPersonaId,
    titular_persona_id: titularId,
    estado_anterior_id: null,
    estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
    origen: ORIGEN_EVENTO.CALLABLE,
    accion: accionEvento,
    metadata: {
      decision: "alta_77_0",
      codigo_grilla: COD_77_0,
      origen_rechazo_sol_id: origenRechazoSolId,
      origen_acto: origenActo,
      fecha_desde: fechaDesde,
    },
  });

  const umbral = await evaluarUmbral770TrasAlta(db, {
    artId: art.artId,
    versionData: art.versionData,
    solHijaId,
    titularId,
    fechaDesde,
    fechaHasta,
    diasSol,
    actorPersonaId: actorPersonaId || "",
    origenRechazoSolId,
  });

  return {
    ok: true,
    solicitud_77_0_id: solHijaId,
    dias_acumulados: umbral.diasAcumulados,
    alerta_umbral_emitida: umbral.alertaEmitida,
  };
}

/**
 * Wrapper rechazo jefe / RRHH sustituta (firma estable).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solOrigen: Record<string, unknown>,
 *   solOrigenId: string,
 *   revisorPersonaId: string,
 *   origenActo?: string,
 * }} params
 */
async function materializarSol770DesdeRechazo(db, params) {
  const solOrigen = params.solOrigen || {};
  return materializarSol770(db, {
    titularPersonaId: String(solOrigen.titular_persona_id || "").trim(),
    fechaDesde: String(solOrigen.fecha_desde || "").slice(0, 10),
    fechaHasta: String(solOrigen.fecha_hasta || solOrigen.fecha_desde || "").slice(0, 10),
    diasSolicitados: Number(solOrigen.dias_solicitados),
    grupoTrabajoIdAncla: String(solOrigen.grupo_trabajo_id_ancla || "").trim() || null,
    gruposTrabajoInvolucradosIds: Array.isArray(solOrigen.grupos_trabajo_involucrados_ids)
      ? solOrigen.grupos_trabajo_involucrados_ids
      : null,
    actorPersonaId: String(params.revisorPersonaId || "").trim(),
    origenActo: String(params.origenActo || ORIGEN_ACTO_RECHAZO_JEFE).trim(),
    origenRechazoSolId: String(params.solOrigenId || "").trim() || null,
    observacionAlta: null,
  });
}

/**
 * Alta directa RRHH: exige circuito con CFG_RRHH.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titularPersonaId: string,
 *   fechaDesde: string,
 *   fechaHasta?: string | null,
 *   diasSolicitados?: number | null,
 *   grupoTrabajoIdAncla?: string | null,
 *   actorPersonaId: string,
 *   observacionAlta?: string | null,
 * }} params
 */
async function materializarSol770AltaRrhh(db, params) {
  const art = await resolverArticulo770Publicado(db);
  if (!art) {
    return { ok: false, codigo: "ART_77_0_NO_CONFIGURADO", mensaje: "Art. 77-0 no está publicado en el catálogo." };
  }
  if (!versionIncluyeRolEnCircuito(art.versionData, "CFG_RRHH")) {
    return {
      ok: false,
      codigo: "CIRCUITO_ROL",
      mensaje: "El artículo 77-0 no habilita carga manual por RRHH.",
    };
  }
  return materializarSol770(db, {
    ...params,
    art,
    origenActo: ORIGEN_ACTO_ALTA_RRHH,
    origenRechazoSolId: null,
  });
}

module.exports = {
  COD_77_0,
  ORIGEN_ACTO_ALTA_RRHH,
  ORIGEN_ACTO_RECHAZO_JEFE,
  resolverArticulo770Publicado,
  debeMaterializar770AlRechazar,
  materializarSol770,
  materializarSol770DesdeRechazo,
  materializarSol770AltaRrhh,
  modoResolucionJefeDesdeVersion,
};
