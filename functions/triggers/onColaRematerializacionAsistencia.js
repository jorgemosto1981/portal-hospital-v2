"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { FieldValue } = require("firebase-admin/firestore");

const { materializarTurnoTeoricoDia } = require("../modules/asistencia/rdaTurnoTeoricoWorker");
const {
  COL_COLA,
  ejecutarRematerializacionDesdeCola,
} = require("../modules/asistencia/colaRematerializacionAsistenciaCore");

const onColaRematerializacionAsistencia = onDocumentWritten(
  { document: `${COL_COLA}/{docId}`, region: "southamerica-east1" },
  async (event) => {
    const docId = event.params.docId;
    const after = event.data?.after;
    if (!after?.exists) return;

    const data = after.data() || {};
    if (data.procesado === true) return;

    try {
      const r = await ejecutarRematerializacionDesdeCola(data, materializarTurnoTeoricoDia);
      if (!r.ok) {
        logger.warn("onColaRematerializacionAsistencia payload inválido", { docId, codigo: r.codigo });
        return;
      }
      if (r.omitido) return;

      await after.ref.delete();
      logger.info("onColaRematerializacionAsistencia OK", {
        docId,
        persona_id: data.persona_id,
        gdt_id: data.gdt_id,
        fecha_ymd: data.fecha_ymd,
        materializado: r.resultado?.ok,
      });
    } catch (e) {
      logger.error("onColaRematerializacionAsistencia ERROR", {
        docId,
        error: String(e),
      });
      await after.ref.set(
        {
          procesado: false,
          ultimo_error: String(e).slice(0, 500),
          intentos: FieldValue.increment(1),
        },
        { merge: true },
      );
    }
  },
);

module.exports = { onColaRematerializacionAsistencia };
