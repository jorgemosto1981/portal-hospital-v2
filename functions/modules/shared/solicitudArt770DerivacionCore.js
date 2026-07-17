"use strict";

/**
 * Derivación Art. 77-0 al rechazar autorización.
 * @see docs/v2/RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md
 */

const { ulid } = require("ulid");
const { FieldValue } = require("./context");
const {
  ESTADO_SOLICITUD_APROBADA,
} = require("./solicitudesArticuloEstados");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
} = require("./mdcTicketeraEmisor");
const { registrarEventoTicket } = require("./registrarEventoTicket");
const {
  TIPO_EVENTO_TICKET,
  ORIGEN_EVENTO,
} = require("./solicitudEventosTicketConstants");
const {
  MODO_RESOLUCION_JEFE_AUTORIZACION,
  modoResolucionJefeDesdeSolicitud,
  modoResolucionJefeDesdeVersion,
} = require("./modoResolucionJefe");
const {
  sumarDiasInjustificadosVentana,
  umbralInjustificadasExcedido,
} = require("./acumuladoInasistenciasInjustificadas");

const COL_SOL = "solicitudes_articulo";
const COL_ART = "cfg_articulos";
const COD_77_0 = "77-0";

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
 * ¿Corresponde materializar 77-0 en este rechazo?
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
 *   solOrigen: Record<string, unknown>,
 *   solOrigenId: string,
 *   revisorPersonaId: string,
 *   origenActo?: string,
 * }} params
 */
async function materializarSol770DesdeRechazo(db, params) {
  const art = await resolverArticulo770Publicado(db);
  if (!art) {
    return { ok: false, codigo: "ART_77_0_NO_CONFIGURADO", mensaje: "Art. 77-0 no está publicado en el catálogo." };
  }

  const solOrigen = params.solOrigen || {};
  const titularId = String(solOrigen.titular_persona_id || "").trim();
  const fechaDesde = String(solOrigen.fecha_desde || "").slice(0, 10);
  const fechaHasta = String(solOrigen.fecha_hasta || fechaDesde).slice(0, 10);
  const dias = Number(solOrigen.dias_solicitados);
  const diasSol = Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 1;
  const gdt = String(solOrigen.grupo_trabajo_id_ancla || "").trim() || null;
  const solHijaId = `sol_${ulid()}`;
  const origenActo = String(params.origenActo || "rechazo_autorizacion_jefe").trim();

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
    grupos_trabajo_involucrados_ids: Array.isArray(solOrigen.grupos_trabajo_involucrados_ids)
      ? solOrigen.grupos_trabajo_involucrados_ids
      : gdt
        ? [gdt]
        : [],
    estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
    modo_resolucion_jefe: "ninguno",
    origen_rechazo_sol_id: String(params.solOrigenId || "").trim() || null,
    origen_acto: origenActo,
    creado_por_persona_id: String(params.revisorPersonaId || "").trim() || null,
    motor_descuento_aplicado: false,
    es_sancion: true,
    es_inasistencia: true,
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };

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

  void registrarEventoTicket(db, solHijaId, {
    tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
    actor_persona_id: params.revisorPersonaId,
    titular_persona_id: titularId,
    estado_anterior_id: null,
    estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
    origen: ORIGEN_EVENTO.CALLABLE,
    accion: "art_77_0_derivado_rechazo",
    metadata: {
      decision: "alta_77_0",
      codigo_grilla: COD_77_0,
      origen_rechazo_sol_id: String(params.solOrigenId || "") || null,
      origen_acto: origenActo,
      fecha_desde: fechaDesde,
    },
  });

  const wf = art.versionData.bloque_workflow_sla_cobertura || {};
  const umbral =
    wf.umbral_inasistencias_injustificadas_dias == null
      ? 10
      : Math.max(1, Math.floor(Number(wf.umbral_inasistencias_injustificadas_dias)));
  const ventana =
    wf.ventana_acumulado_meses == null
      ? 12
      : Math.max(1, Math.floor(Number(wf.ventana_acumulado_meses)));
  const notificar = wf.notificar_rrhh_al_umbral !== false;

  let diasAcumulados = diasSol;
  let alertaEmitida = false;

  if (notificar && titularId) {
    const snapTitular = await db
      .collection(COL_SOL)
      .where("titular_persona_id", "==", titularId)
      .where("articulo_id", "==", art.artId)
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
    // Incluir la hija recién escrita (get puede no verla aún según consistencia; forzar en lista)
    sols.push({
      fecha_desde: fechaDesde,
      dias_solicitados: diasSol,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      articulo_id: art.artId,
      codigo_grilla: COD_77_0,
    });
    diasAcumulados = sumarDiasInjustificadosVentana(sols, {
      articuloId77: art.artId,
      fechaHastaRef: fechaHasta,
      ventanaMeses: ventana,
    });

    if (umbralInjustificadasExcedido(diasAcumulados, umbral)) {
      const perRef = db.collection("personas").doc(titularId);
      const perSnap = await perRef.get();
      const ya =
        perSnap.exists &&
        perSnap.data()?.alerta_77_0_umbral_pendiente_rrhh === true &&
        String(perSnap.data()?.alerta_77_0_umbral_sol_id || "") === solHijaId;
      if (!ya) {
        await perRef.set(
          {
            alerta_77_0_umbral_pendiente_rrhh: true,
            alerta_77_0_umbral_dias: diasAcumulados,
            alerta_77_0_umbral_sol_id: solHijaId,
            alerta_77_0_umbral_en: FieldValue.serverTimestamp(),
            actualizado_en: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        void registrarEventoTicket(db, solHijaId, {
          tipo_evento: TIPO_EVENTO_TICKET.ALERTA_77_0_UMBRAL_EXCEDIDO,
          actor_persona_id: params.revisorPersonaId,
          titular_persona_id: titularId,
          estado_anterior_id: null,
          estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
          origen: ORIGEN_EVENTO.SISTEMA,
          accion: "alerta_77_0_umbral",
          metadata: {
            codigo_grilla: COD_77_0,
            dias_acumulados: diasAcumulados,
            umbral_dias: umbral,
            ventana_meses: ventana,
            fecha_desde: fechaDesde,
            origen_rechazo_sol_id: String(params.solOrigenId || "") || null,
          },
        });
        alertaEmitida = true;
      }
    }
  }

  return {
    ok: true,
    solicitud_77_0_id: solHijaId,
    dias_acumulados: diasAcumulados,
    alerta_umbral_emitida: alertaEmitida,
  };
}

module.exports = {
  COD_77_0,
  resolverArticulo770Publicado,
  debeMaterializar770AlRechazar,
  materializarSol770DesdeRechazo,
  modoResolucionJefeDesdeVersion,
};
