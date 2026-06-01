"use strict";

/**
 * Trigger: alta `solicitudes_articulo` en BORRADOR → re-valida motor LAO (Fase 5a) y actualiza estado.
 * Descuento atómico en `saldos_articulo_agente` cuando existe bolsa coincidente y cupo suficiente.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { ulid } = require("ulid");

const { db, FieldValue } = require("../modules/shared/context");
const {
  runLaoAltaMotorCompleto,
  resolveCupoOperativoDesdeMotor,
} = require("../modules/shared/laoAltaMotorCompleto");
const { gatherLaoAltaMotorContext } = require("../modules/shared/solicitudLaoAltaMotorContext");
const { validarSuperposicionLaoEnMotor } = require("../modules/shared/laoSuperposicionMotor");
const { assertVersionInvariantForBolsa } = require("../modules/shared/laoVersionResolver");
const {
  saldoAnualDocId,
  pickBolsaParaConsumo,
  assertFifoAnioOrigen,
  mergeBolsasFromSaldoDocs,
  evaluarSaldoBolsaParaPreview,
} = require("../modules/shared/laoSaldosBolsa");
const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
} = require("../modules/shared/solicitudesArticuloEstados");
const {
  resolverCadenaAutorizacion,
  buildAutorizacionSnapshotFields,
} = require("../modules/shared/solicitudAutorizacionJerarquicaCore");
const {
  resolverGrupoTrabajoIdAnclaParaSolicitud,
  buildGruposTrabajoInvolucradosIdsFromVigentes,
  assertGrupoAnclaEnGruposInvolucrados,
} = require("../modules/shared/solicitudGrupoTrabajoAncla");
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

/** Legado: cupo teórico del motor (matriz / proporcional), no el rango del wizard. */
function resolveDiasConsumoMotor(resultado) {
  return resolveCupoOperativoDesdeMotor(resultado);
}

/**
 * Días a descontar: prioriza `dias_solicitados` / snapshot del wizard; si no, motor legado.
 * @param {Record<string, unknown>} solicitudData
 * @param {ReturnType<typeof runLaoAltaMotorCompleto>} resultado
 */
function resolveDiasConsumoOperativo(solicitudData, resultado) {
  const fromDoc = Number(solicitudData.dias_solicitados);
  const snap =
    solicitudData.resumen_computo_snapshot && typeof solicitudData.resumen_computo_snapshot === "object"
      ? solicitudData.resumen_computo_snapshot
      : null;
  const snapDias = snap ? Number(snap.dias_consumo) : NaN;

  if (Number.isInteger(fromDoc) && fromDoc >= 1 && fromDoc <= 366) {
    if (Number.isInteger(snapDias) && snapDias >= 1 && fromDoc !== snapDias) {
      return {
        dias: 0,
        error: `dias_solicitados (${fromDoc}) no coincide con resumen_computo_snapshot (${snapDias}).`,
        usaRangoWizard: true,
      };
    }
    return { dias: fromDoc, error: null, usaRangoWizard: true };
  }

  if (Number.isInteger(snapDias) && snapDias >= 1) {
    return { dias: snapDias, error: null, usaRangoWizard: true };
  }

  return {
    dias: resolveDiasConsumoMotor(resultado),
    error: null,
    usaRangoWizard: false,
  };
}

/**
 * Oleada A — ancla HLC + cadena jerárquica (paridad Patrón B).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} solicitudData
 * @param {string} personaId
 * @param {string} fechaDesde
 */
async function resolverAutorizacionAltaLao(db, solicitudData, personaId, fechaDesde) {
  let grupoAncla;
  try {
    grupoAncla = await resolverGrupoTrabajoIdAnclaParaSolicitud(db, {
      persona_id: personaId,
      fecha_desde: fechaDesde,
      grupo_trabajo_id_ancla:
        typeof solicitudData.grupo_trabajo_id_ancla === "string"
          ? solicitudData.grupo_trabajo_id_ancla.trim() || null
          : null,
    });
  } catch (err) {
    return {
      ok: false,
      mensajes: [err instanceof Error ? err.message : "Error al resolver grupo de trabajo ancla."],
    };
  }

  if (!grupoAncla.ok) {
    return {
      ok: false,
      mensajes: [grupoAncla.mensaje || "No se pudo resolver el grupo de trabajo ancla."],
    };
  }

  const grupoTrabajoIdAncla = String(grupoAncla.grupo_trabajo_id_ancla || "").trim();
  const gruposTrabajoInvolucradosIds = buildGruposTrabajoInvolucradosIdsFromVigentes(
    grupoAncla.grupos_vigentes || [],
  );

  const anclaEnSnapshot = assertGrupoAnclaEnGruposInvolucrados(
    grupoTrabajoIdAncla,
    gruposTrabajoInvolucradosIds,
  );
  if (!anclaEnSnapshot.ok) {
    return { ok: false, mensajes: [anclaEnSnapshot.mensaje || "Grupo ancla inválido."] };
  }

  if (gruposTrabajoInvolucradosIds.length === 0) {
    return {
      ok: false,
      mensajes: ["No hay grupos de trabajo vigentes para registrar en la solicitud."],
    };
  }

  let cadenaAutorizacion;
  try {
    cadenaAutorizacion = await resolverCadenaAutorizacion(db, {
      titularPersonaId: personaId,
      grupoTrabajoIdAncla,
      fechaRefYmd: fechaDesde,
    });
  } catch (err) {
    return {
      ok: false,
      mensajes: [err instanceof Error ? err.message : "Error al resolver autorizadores."],
    };
  }

  if (!cadenaAutorizacion.ok) {
    return {
      ok: false,
      mensajes: [
        cadenaAutorizacion.mensaje || "No se pudo resolver la autorización jerárquica.",
      ],
    };
  }

  return {
    ok: true,
    grupo_trabajo_id_ancla: grupoTrabajoIdAncla,
    grupos_trabajo_involucrados_ids: gruposTrabajoInvolucradosIds,
    snapshot: buildAutorizacionSnapshotFields(cadenaAutorizacion),
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {Record<string, unknown>} solicitudData
 * @param {string} articuloId
 * @param {string} grupoTrabajoIdAncla
 */
async function emitirEventoYMdcLaoAltaOk(db, solId, solicitudData, articuloId, grupoTrabajoIdAncla) {
  const titularId = String(solicitudData.titular_persona_id || "").trim();
  const evtId = `evt_${ulid()}`;
  const ticketEvent = {
    tipo_evento: TIPO_EVENTO_TICKET.SOLICITUD_CREADA_REVISION_JEFE,
    actor_persona_id: titularId || null,
    titular_persona_id: titularId || null,
    estado_anterior_id: ESTADO_SOLICITUD_BORRADOR,
    estado_nuevo_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
    origen: ORIGEN_EVENTO.TRIGGER,
    accion: "lao_on_create_ok",
    metadata: {
      articulo_id: articuloId,
      version_aplicada:
        solicitudData.version_aplicada || solicitudData.version_aplicada_id || null,
      grupo_trabajo_id_ancla: grupoTrabajoIdAncla || null,
      grupos_trabajo_involucrados_ids: Array.isArray(solicitudData.grupos_trabajo_involucrados_ids)
        ? solicitudData.grupos_trabajo_involucrados_ids
        : [],
      fecha_desde: String(solicitudData.fecha_desde || "").slice(0, 10),
    },
  };

  const artCache = new Map();
  const artDisplay = await loadArticuloDisplay(db, articuloId, artCache);
  ticketEvent.metadata.codigo_grilla = artDisplay.codigo_grilla || null;

  await registrarEventoTicket(db, solId, ticketEvent, { evento_id: evtId });
  scheduleEventoTicketGlobal(db, solId, evtId, ticketEvent);

  const postSnap = await db.collection("solicitudes_articulo").doc(solId).get();
  const postData = postSnap.exists ? postSnap.data() || {} : solicitudData;
  dispararMdcDesdeSolicitudAsync(db, solId, {
    ...postData,
    codigo_grilla: artDisplay.codigo_grilla,
    articulo_id: articuloId,
  }, MDC_COMANDO_PROYECTAR_PENDIENTE);
}

const onSolicitudArticuloLaoMotorValidate = onDocumentCreated(
  { document: "solicitudes_articulo/{solId}", region: "southamerica-east1" },
  async (event) => {
    const solId = event.params.solId;
    const snap = event.data;
    if (!snap) return;

    const d = snap.data() || {};
    if (d.estado_solicitud_id !== ESTADO_SOLICITUD_BORRADOR) return;

    const schemaVersion = Number(d.schema_version);
    const patronSaldo = String(d.patron_saldo || "").trim();
    if (schemaVersion === 2 || patronSaldo === "B") return;

    const personaId = typeof d.titular_persona_id === "string" ? d.titular_persona_id.trim() : "";
    const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
    const versionId =
      typeof d.version_aplicada === "string"
        ? d.version_aplicada.trim()
        : typeof d.version_aplicada_id === "string"
          ? d.version_aplicada_id.trim()
          : "";
    const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
    const fechaHastaRaw = typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim().slice(0, 10) : "";
    const fechaHasta = fechaHastaRaw || fechaDesde;
    const diasSolicitadosDoc = Number(d.dias_solicitados);
    const anioOrigenBolsa = Number(d.anio_origen_bolsa);

    if (!/^per_/i.test(personaId) || !/^art_/i.test(articuloId) || !/^ver_/i.test(versionId) || !fechaDesde) {
      logger.warn("solicitud_lao_motor_skip_datos", { solId });
      return;
    }
    if (!Number.isInteger(anioOrigenBolsa) || anioOrigenBolsa < 1900) {
      logger.warn("solicitud_lao_motor_skip_anio", { solId });
      return;
    }

    const solRef = db.collection("solicitudes_articulo").doc(solId);

    let ctx;
    try {
      ctx = await gatherLaoAltaMotorContext(db, {
        personaId,
        articuloId,
        versionId,
        fechaDesde,
        excludeSolicitudDocId: solId,
      });
    } catch (err) {
      logger.error("solicitud_lao_motor_context_error", { solId, message: err instanceof Error ? err.message : String(err) });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_error_contexto: err instanceof Error ? err.message : String(err),
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      assertVersionInvariantForBolsa(ctx.versionData, anioOrigenBolsa);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    let saldosMerged;
    try {
      const salPersonaSnap = await db.collection(COL_SALDOS).where("persona_id", "==", personaId).get();
      saldosMerged = mergeBolsasFromSaldoDocs(salPersonaSnap.docs.map((doc) => doc.data() || {}));
      assertFifoAnioOrigen(saldosMerged, articuloId, anioOrigenBolsa);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const motorBase = {
      versionData: ctx.versionData,
      versionId,
      fechaDesdeYmd: fechaDesde,
      fechaHastaYmd: fechaHasta,
      anioOrigenBolsa,
      hlcArray: ctx.hlcArray,
      diasExternos: ctx.diasExternos,
      exclusionIntervals: ctx.exclusionIntervals,
      operadorCodigoPorId: ctx.operadorMap,
      persona: ctx.persona,
      personaId,
    };

    let superposicionVal;
    try {
      superposicionVal = await validarSuperposicionLaoEnMotor(db, {
        personaId,
        fechaDesdeYmd: fechaDesde,
        fechaHastaYmd: fechaHasta,
        versionData: ctx.versionData,
        excludeSolId: solId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    motorBase.superposicionVal = superposicionVal;

    let resultado;
    try {
      resultado = await runLaoAltaMotorCompleto(motorBase);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const diasParaSaldo =
      Number.isInteger(diasSolicitadosDoc) && diasSolicitadosDoc >= 1 ? diasSolicitadosDoc : null;

    const saldoValPre = evaluarSaldoBolsaParaPreview({
      saldosMerged,
      articuloId,
      anioOrigenBolsa,
      diasSolicitados: diasParaSaldo ?? 1,
      fechaDesdeYmd: fechaDesde,
      diasProporcionalesPiso: resultado.proporcional?.dias_proporcionales_piso ?? null,
    });

    try {
      resultado = await runLaoAltaMotorCompleto({
        ...motorBase,
        diasSolicitados: diasParaSaldo ?? undefined,
        disponibleBolsa: Number.isFinite(Number(saldoValPre.disponible)) ? Number(saldoValPre.disponible) : 0,
        saldoEval: diasParaSaldo != null ? saldoValPre : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (!resultado.eligible) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: resultado.motivos_ineligibilidad || [],
        motor_snapshot: resultado.motor_snapshot,
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const consumoRes = resolveDiasConsumoOperativo(d, resultado);
    if (consumoRes.error) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [consumoRes.error],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const diasConsumo = consumoRes.dias;

    if (consumoRes.usaRangoWizard && diasConsumo > 0) {
      const saldoVal = evaluarSaldoBolsaParaPreview({
        saldosMerged,
        articuloId,
        anioOrigenBolsa,
        diasSolicitados: diasConsumo,
        fechaDesdeYmd: fechaDesde,
        diasProporcionalesPiso: resultado.proporcional?.dias_proporcionales_piso ?? null,
      });
      if (!saldoVal.ok) {
        await solRef.update({
          estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
          motor_motivos_ineligibilidad: saldoVal.motivos,
          motor_snapshot: {
            ...resultado.motor_snapshot,
            dias_consumo: diasConsumo,
            saldo_camino: saldoVal.camino || resultado.camino,
          },
          motor_validado_en: FieldValue.serverTimestamp(),
          actualizado_en: FieldValue.serverTimestamp(),
        });
        return;
      }
    }

    const autorizacion = await resolverAutorizacionAltaLao(db, d, personaId, fechaDesde);
    if (!autorizacion.ok) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: autorizacion.mensajes,
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const anioSolicitud = resultado.anio_solicitud;
    const salId = saldoAnualDocId(personaId, anioOrigenBolsa);
    const salRef = salId ? db.collection(COL_SALDOS).doc(salId) : null;

    const motorOkPayload = {
      estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      ...autorizacion.snapshot,
      grupo_trabajo_id_ancla: autorizacion.grupo_trabajo_id_ancla,
      grupos_trabajo_involucrados_ids: autorizacion.grupos_trabajo_involucrados_ids,
      motor_snapshot: {
        ...resultado.motor_snapshot,
        dias_consumo: diasConsumo,
        anio_solicitud: anioSolicitud,
      },
      motor_validado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    };

    if (diasConsumo <= 0 || !salRef) {
      await solRef.update({
        ...motorOkPayload,
        motor_descuento_aplicado: false,
        motor_descuento_motivo: diasConsumo <= 0 ? "dias_consumo_cero" : "saldo_doc_id_invalido",
      });
      try {
        await emitirEventoYMdcLaoAltaOk(
          db,
          solId,
          { ...d, ...motorOkPayload },
          articuloId,
          autorizacion.grupo_trabajo_id_ancla,
        );
      } catch (postErr) {
        logger.warn("solicitud_lao_post_ok_emit", {
          solId,
          message: postErr instanceof Error ? postErr.message : String(postErr),
        });
      }
      return;
    }

    let txCompletoRevisionJefe = false;
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
            motor_descuento_aplicado: false,
            motor_descuento_motivo: "sin_documento_saldo_anual",
          });
          return;
        }

        const salData = salSnap.data() || {};
        const match = pickBolsaParaConsumo(salData, articuloId, anioOrigenBolsa);
        if (!match) {
          tx.update(solRef, {
            ...motorOkPayload,
            motor_descuento_aplicado: false,
            motor_descuento_motivo: "sin_bolsa_coincidente",
          });
          return;
        }

        const disp = Number(match.bolsa.disponible);
        const cons = Number(match.bolsa.consumido) || 0;
        if (!Number.isFinite(disp) || disp < diasConsumo) {
          tx.update(solRef, {
            estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
            motor_motivos_ineligibilidad: [
              `Saldo insuficiente en bolsa (disponible ${Number.isFinite(disp) ? disp : "n/d"}, requerido ${diasConsumo}).`,
            ],
            motor_validado_en: FieldValue.serverTimestamp(),
            actualizado_en: FieldValue.serverTimestamp(),
          });
          return;
        }

        const newConsumido = cons + diasConsumo;
        const newDisponible = disp - diasConsumo;

        tx.update(salRef, {
          [`bolsas.${match.bolsaId}.consumido`]: newConsumido,
          [`bolsas.${match.bolsaId}.disponible`]: newDisponible,
          [`bolsas.${match.bolsaId}.ultima_actualizacion`]: FieldValue.serverTimestamp(),
          "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
        });

        tx.update(solRef, {
          ...motorOkPayload,
          motor_descuento_aplicado: true,
          motor_bolsa_id: match.bolsaId,
          motor_dias_descontados: diasConsumo,
        });
        txCompletoRevisionJefe = true;
      });

      if (txCompletoRevisionJefe) {
        try {
          await emitirEventoYMdcLaoAltaOk(
            db,
            solId,
            { ...d, ...motorOkPayload },
            articuloId,
            autorizacion.grupo_trabajo_id_ancla,
          );
        } catch (postErr) {
          logger.warn("solicitud_lao_post_ok_emit", {
            solId,
            message: postErr instanceof Error ? postErr.message : String(postErr),
          });
        }
      }
    } catch (err) {
      logger.error("solicitud_lao_motor_tx_error", { solId, message: err instanceof Error ? err.message : String(err) });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: ["Error al aplicar descuento de saldo; reintentá o contactá a RRHH."],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
    }
  },
);

module.exports = {
  onSolicitudArticuloLaoMotorValidate,
  resolveDiasConsumoMotor,
  resolveDiasConsumoOperativo,
  resolverAutorizacionAltaLao,
};
