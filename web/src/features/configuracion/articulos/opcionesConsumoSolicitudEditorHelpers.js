import { ulid } from "ulid";

import { CFG_RCD_HABILES_COMPUESTO } from "../../../../../shared/utils/modoComputoCalendario.js";

export function newOpcionConsumoSolicitudRow(overrides = {}) {
  return {
    id: `oc_${ulid().toLowerCase()}`,
    etiqueta_ui: "",
    dias_por_evento: 1,
    codigo_sarh: "",
    regla_computo_id: CFG_RCD_HABILES_COMPUESTO,
    activo: true,
    ...overrides,
  };
}
