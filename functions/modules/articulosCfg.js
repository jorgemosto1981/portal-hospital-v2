"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

/**
 * Punto de enganche para sincronización / read-models (triple capa).
 * El cliente escribe `schema_contract_version` alineado a `ARTICULO_SCHEMA_VERSION` en web.
 */
exports.onCfgArticuloVersionWritten = onDocumentWritten(
  {
    document: "cfg_articulos/{articuloId}/versiones/{versionId}",
    region: "southamerica-east1",
  },
  async (event) => {
    const change = event.data;
    if (!change) {
      return;
    }
    const beforeExists = change.before.exists;
    const afterSnap = change.after;
    if (!afterSnap.exists) {
      logger.info("articulo_version_deleted_or_missing", {
        articuloId: event.params.articuloId,
        versionId: event.params.versionId,
        hadBefore: beforeExists,
      });
      return;
    }
    const data = afterSnap.data() || {};
    logger.info("articulo_version_write", {
      articuloId: event.params.articuloId,
      versionId: event.params.versionId,
      isCreate: !beforeExists,
      schema_contract_version: data.schema_contract_version ?? null,
      estado_version_id: data.estado_version_id ?? null,
      version_semantica: data.version_semantica ?? null,
    });
  },
);
