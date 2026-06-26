import { describe, expect, it } from "vitest";

import { TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA } from "../constants/solicitudesArticuloV2.js";
import { buildSolicitudMedAvisoDocument } from "../schemas/solicitudArticulo.schema.js";

const TS = { creado_en: {}, actualizado_en: {} };

describe("crearAvisoMedicoCajaNegra — payload Firestore", () => {
  it("arma documento pendiente clasificación con articulo_id null", () => {
    const doc = buildSolicitudMedAvisoDocument(
      {
        personaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        tipoIngresoId: TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
        grupoTrabajoIdAncla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
        adjuntos: [{ storage_path: "avisos-med/piloto/cert.pdf" }],
      },
      TS,
    );
    expect(doc.schema_version).toBe("SOL_MED_AVISO_V1");
    expect(doc.articulo_id).toBeNull();
    expect(doc.estado_solicitud_id).toBe("cfg_esa_pendiente_clasificacion_medica");
    expect(doc.ingreso_medico.tipo_ingreso_id).toBe("cfg_tig_enfermedad_propia");
    expect(doc.ingreso_medico.es_licencia_incompleta).toBe(false);
  });

  it("arma aviso incompleto con vencimiento", () => {
    const venc = { seconds: 99 };
    const doc = buildSolicitudMedAvisoDocument(
      {
        personaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        tipoIngresoId: TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
        grupoTrabajoIdAncla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
        esLicenciaIncompleta: true,
      },
      { ...TS, vencimiento_plazo_certificado: venc },
    );
    expect(doc.ingreso_medico.es_licencia_incompleta).toBe(true);
    expect(doc.vencimiento_plazo_certificado).toBe(venc);
  });
});
