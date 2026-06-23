"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { db } = require("../modules/shared/context");
const {
  COL_GRILLA_SYNC_GRUPO_MES,
  debeDispararReconciliacionSyncGrilla,
  ejecutarReconciliacionGrillaSyncGrupoMes,
} = require("../modules/shared/grillaSyncGrupoMesCore");

const onGrillaSyncGrupoMesWritten = onDocumentWritten(
  { document: `${COL_GRILLA_SYNC_GRUPO_MES}/{docId}`, region: "southamerica-east1", timeoutSeconds: 540, memory: "1GiB" },
  async (event) => {
    const docId = event.params.docId;
    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;
    if (!after) return;

    if (!debeDispararReconciliacionSyncGrilla(before, after)) {
      return;
    }

    const gdt = String(after.gdt || "").trim();
    const anio = Number(after.anio);
    const mes = Number(after.mes);
    if (!/^gdt_/i.test(gdt) || !Number.isFinite(anio) || !Number.isFinite(mes)) {
      logger.warn("onGrillaSyncGrupoMesWritten payload inválido", { docId });
      return;
    }

    try {
      const r = await ejecutarReconciliacionGrillaSyncGrupoMes(db, {
        grupoTrabajoId: gdt,
        anio,
        mes,
      });
      logger.info("onGrillaSyncGrupoMesWritten OK", { docId, resultado: r?.ok, omitido: r?.omitido });
    } catch (e) {
      logger.error("onGrillaSyncGrupoMesWritten ERROR", { docId, error: String(e) });
    }
  },
);

module.exports = { onGrillaSyncGrupoMesWritten };
