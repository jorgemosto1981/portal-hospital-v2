"use strict";

/**
 * Trigger: alta solicitud Patrón B en BORRADOR → valida y descuenta saldo ciclo.
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { ulid } = require("ulid");

const { db, FieldValue } = require("../modules/shared/context");
const { pickBolsaParaConsumo } = require("../modules/shared/laoSaldosBolsa");
const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
} = require("../modules/shared/solicitudesArticuloEstados");
const { runPatronBAltaMotor } = require("../modules/shared/solicitudPatronBAltaMotor");
const {
  resolverCadenaAutorizacion,
  buildAutorizacionSnapshotFields,
} = require("../modules/shared/solicitudAutorizacionJerarquicaCore");
const { loadArticuloDisplay } = require("../modules/shared/solicitudBandejaJefeCore");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_PROYECTAR_PENDIENTE,
} = require("../modules/shared/mdcTicketeraEmisor");
const {
  TIPO_EVENTO_TICKET,
  ORIGEN_EVENTO,
} = require("../modules/shared/solicitudEventosTicketConstants");
const {
  registrarEventoTicket,
  scheduleEventoTicketGlobal,
} = require("../modules/shared/registrarEventoTicket");

const COL_SALDOS = "saldos_articulo_agente";

const onSolicitudArticuloPatronBOnCreate = onDocumentCreated(
  { document: "solicitudes_articulo/{solId}", region: "southamerica-east1" },
  async (event) => {
    const solId = event.params.solId;
    const snap = event.data;
    if (!snap) return;

    const d = snap.data() || {};
    const schemaVersion = Number(d.schema_version);
    const patron = String(d.patron_saldo || "").trim();

    if (schemaVersion !== 2 && patron !== "B") return;
    if (d.estado_solicitud_id !== ESTADO_SOLICITUD_BORRADOR) return;

    const solRef = db.collection("solicitudes_articulo").doc(solId);

    let motor;
    try {
      motor = await runPatronBAltaMotor({
        db,
        solicitud: d,
        excludeSolId: solId,
        authToken: null,
      });
    } catch (err) {
      logger.error("solicitud_patron_b_motor_error", {
        solId,
        message: err instanceof Error ? err.message : String(err),
      });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_codigos: ["MOTOR_ERROR"],
        motor_mensajes: ["Error al validar la solicitud."],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (!motor.ok) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_codigos: motor.codigos || [],
        motor_mensajes: motor.mensajes || [],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    let cadenaAutorizacion;
    try {
      cadenaAutorizacion = await resolverCadenaAutorizacion(db, {
        titularPersonaId: String(d.titular_persona_id || "").trim(),
        grupoTrabajoIdAncla: motor.grupo_trabajo_id_ancla || String(d.grupo_trabajo_id_ancla || "").trim(),
        fechaRefYmd: String(d.fecha_desde || "").slice(0, 10),
      });
    } catch (err) {
      logger.error("solicitud_patron_b_autorizacion_error", {
        solId,
        message: err instanceof Error ? err.message : String(err),
      });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_codigos: ["AUTORIZACION_ERROR"],
        motor_mensajes: ["Error al resolver autorizadores."],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (!cadenaAutorizacion.ok) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_codigos: cadenaAutorizacion.codigo ? [cadenaAutorizacion.codigo] : ["AUTORIZACION_INVALIDA"],
        motor_mensajes: cadenaAutorizacion.mensaje
          ? [cadenaAutorizacion.mensaje]
          : ["No se pudo resolver la autorización jerárquica."],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const snapshotAutorizacion = buildAutorizacionSnapshotFields(cadenaAutorizacion);

    const diasConsumo = motor.dias_consumo;
    const salRef = db.collection(COL_SALDOS).doc(motor.saldo_doc_id);
    const motorOkPayload = {
      estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      hlc_id_elegibilidad: motor.hlc_id || null,
      motor_validado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
      motor_descuento_aplicado: false,
    };

    let evtIdPostTx = null;
    let ticketEventPostTx = null;

    try {
      await db.runTransaction(async (tx) => {
        const sSnap = await tx.get(solRef);
        if (!sSnap.exists) return;
        const cur = sSnap.data() || {};
        if (cur.estado_solicitud_id !== ESTADO_SOLICITUD_BORRADOR) return;

        const salSnap = await tx.get(salRef);
        if (!salSnap.exists) {
          tx.update(solRef, {
            ...motorOkPayload,
            estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
            motor_codigos: ["SALDO_CICLO"],
            motor_mensajes: ["No hay saldo disponible en el ciclo."],
          });
          return;
        }

        const match = pickBolsaParaConsumo(salSnap.data() || {}, motor.articulo_id, motor.anio_ciclo_consumo);
        if (!match) {
          tx.update(solRef, {
            ...motorOkPayload,
            estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
            motor_codigos: ["SALDO_CICLO"],
            motor_mensajes: ["No hay saldo disponible en el ciclo."],
          });
          return;
        }

        const disp = Number(match.bolsa.disponible);
        const cons = Number(match.bolsa.consumido) || 0;
        if (!Number.isFinite(disp) || disp < diasConsumo) {
          tx.update(solRef, {
            estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
            motor_codigos: ["SALDO_CICLO"],
            motor_mensajes: ["No hay saldo disponible en el ciclo."],
            motor_validado_en: FieldValue.serverTimestamp(),
            actualizado_en: FieldValue.serverTimestamp(),
          });
          return;
        }

        const debito = {
          bolsa_id: match.bolsaId,
          anio_origen: motor.anio_ciclo_consumo,
          dias: diasConsumo,
        };

        tx.update(salRef, {
          [`bolsas.${match.bolsaId}.consumido`]: cons + diasConsumo,
          [`bolsas.${match.bolsaId}.disponible`]: disp - diasConsumo,
          [`bolsas.${match.bolsaId}.ultima_actualizacion`]: FieldValue.serverTimestamp(),
          "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
        });

        const titularId = String(cur.titular_persona_id || d.titular_persona_id || "").trim();
        evtIdPostTx = `evt_${ulid()}`;
        ticketEventPostTx = {
          tipo_evento: TIPO_EVENTO_TICKET.SOLICITUD_CREADA_REVISION_JEFE,
          actor_persona_id: titularId || null,
          titular_persona_id: titularId || null,
          estado_anterior_id: ESTADO_SOLICITUD_BORRADOR,
          estado_nuevo_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
          origen: ORIGEN_EVENTO.TRIGGER,
          accion: "patron_b_on_create_ok",
          metadata: {
            articulo_id: motor.articulo_id || cur.articulo_id || null,
            version_id_aplicada: cur.version_id_aplicada || d.version_id_aplicada || null,
            grupo_trabajo_id_ancla: motor.grupo_trabajo_id_ancla || null,
            fecha_desde: String(cur.fecha_desde || d.fecha_desde || "").slice(0, 10),
          },
        };
        await registrarEventoTicket(db, solId, ticketEventPostTx, {
          writer: tx,
          evento_id: evtIdPostTx,
        });

        tx.update(solRef, {
          ...motorOkPayload,
          ...snapshotAutorizacion,
          motor_descuento_aplicado: true,
          motor_bolsa_id: match.bolsaId,
          motor_dias_descontados: diasConsumo,
          grupo_trabajo_id_ancla: motor.grupo_trabajo_id_ancla || null,
          _debito_origen: [debito],
        });
      });
    } catch (err) {
      logger.error("solicitud_patron_b_tx_error", { solId, message: err instanceof Error ? err.message : String(err) });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_codigos: ["MOTOR_TX"],
        motor_mensajes: ["Error al aplicar descuento de saldo."],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      const artCache = new Map();
      const artDisplay = await loadArticuloDisplay(db, motor.articulo_id, artCache);
      if (evtIdPostTx && ticketEventPostTx) {
        ticketEventPostTx.metadata = {
          ...ticketEventPostTx.metadata,
          codigo_grilla: artDisplay.codigo_grilla || null,
        };
        scheduleEventoTicketGlobal(db, solId, evtIdPostTx, ticketEventPostTx);
      }
      const postSnap = await solRef.get();
      const postData = postSnap.exists ? postSnap.data() || {} : d;
      dispararMdcDesdeSolicitudAsync(db, solId, {
        ...postData,
        codigo_grilla: artDisplay.codigo_grilla,
        articulo_id: motor.articulo_id,
      }, MDC_COMANDO_PROYECTAR_PENDIENTE);
    } catch (mdcErr) {
      logger.warn("solicitud_patron_b_mdc_emit", {
        solId,
        message: mdcErr instanceof Error ? mdcErr.message : String(mdcErr),
      });
    }
  },
);

module.exports = { onSolicitudArticuloPatronBOnCreate };
