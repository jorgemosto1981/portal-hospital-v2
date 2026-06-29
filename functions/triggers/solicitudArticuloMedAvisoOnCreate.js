"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

const { db } = require("../modules/shared/context");
const { SCHEMA_MED_AVISO, ESTADO_PENDIENTE_CLASIFICACION } = require("../modules/shared/avisoMedicoCajaNegraCore");
const { proyectarAvisoMedicoEnGrillaAsync } = require("../modules/shared/avisoMedicoGrillaMdcCore");

const onSolicitudArticuloMedAvisoOnCreate = onDocumentCreated(
  { document: "solicitudes_articulo/{solId}", region: "southamerica-east1" },
  async (event) => {
    const solId = event.params.solId;
    const snap = event.data;
    if (!snap) return;

    const d = snap.data() || {};
    if (String(d.schema_version || "") !== SCHEMA_MED_AVISO) return;
    if (String(d.estado_solicitud_id || "") !== ESTADO_PENDIENTE_CLASIFICACION) return;

    try {
      proyectarAvisoMedicoEnGrillaAsync(db, solId, d);
    } catch (err) {
      logger.warn("solicitud_med_aviso_grilla_on_create", {
        solId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

module.exports = { onSolicitudArticuloMedAvisoOnCreate };
