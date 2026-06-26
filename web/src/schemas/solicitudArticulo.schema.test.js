import { describe, expect, it } from "vitest";

import {
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../constants/solicitudesArticuloV2.js";
import {
  buildSolicitudMedAvisoDocument,
  parseSolicitudArticuloCreateDocument,
  solicitudArticuloCreateShapeMedAvisoSchema,
} from "./solicitudArticulo.schema.js";

const TS = { creado_en: {}, actualizado_en: {} };

describe("solicitudArticuloCreateShapeMedAvisoSchema", () => {
  it("exige articulo_id y version_id_aplicada null", () => {
    const doc = buildSolicitudMedAvisoDocument(
      {
        personaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        tipoIngresoId: TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
        grupoTrabajoIdAncla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
        fechaInicioReposoEstimada: "2026-06-10",
        adjuntos: [{ storage_path: "avisos-med/2026/cert.pdf" }],
        comentarioAgente: "Certificado adjunto",
      },
      TS,
    );
    expect(doc.articulo_id).toBeNull();
    expect(doc.version_id_aplicada).toBeNull();
    expect(doc.estado_solicitud_id).toBe("cfg_esa_pendiente_clasificacion_medica");
    expect(doc.schema_version).toBe("SOL_MED_AVISO_V1");
    expect(solicitudArticuloCreateShapeMedAvisoSchema.safeParse(doc).success).toBe(true);
  });

  it("rechaza articulo_id art_* en aviso", () => {
    const base = buildSolicitudMedAvisoDocument(
      {
        personaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        tipoIngresoId: TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
        grupoTrabajoIdAncla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
        adjuntos: [{ storage_path: "x" }],
      },
      TS,
    );
    const r = solicitudArticuloCreateShapeMedAvisoSchema.safeParse({
      ...base,
      articulo_id: "art_01KRNK10V10CH7W5M2W6V558GS",
    });
    expect(r.success).toBe(false);
  });

  it("entra en union de create por schema_version", () => {
    const doc = buildSolicitudMedAvisoDocument(
      {
        personaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        tipoIngresoId: TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
        grupoTrabajoIdAncla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
        adjuntos: [{ storage_path: "avisos-med/a.pdf" }],
      },
      TS,
    );
    expect(parseSolicitudArticuloCreateDocument(doc).schema_version).toBe("SOL_MED_AVISO_V1");
  });
});
