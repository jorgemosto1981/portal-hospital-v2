/**
 * Catálogo dedicado: tipo de **fuente normativa** citada como referencia principal del artículo
 * (`norma_principal_tipo_id` → `cfg_tipo_norma_principal_articulo`).
 * Solo clasificación bibliográfica; el detalle sigue en `norma_principal_referencia` / inciso.
 *
 * Compartido por `seed-cfg.mjs` y `seed-articulos-norma-principal-catalogo.mjs`.
 *
 * @see docs/v2/DICCIONARIO_CFG_ARTICULOS_V2.md
 */

import { Timestamp } from "firebase-admin/firestore";

const t0 = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));

const base = () => ({
  activo: true,
  vigente_desde: t0,
  vigente_hasta: null,
  seed_version: 1,
  seed_fase: "F-norma-principal-art-2026-05",
});

function cfgRow(id, codigo_interno, nombre, orden = 10, extra = {}) {
  return {
    id,
    data: {
      ...base(),
      codigo_interno,
      nombre,
      titulo_ui: nombre,
      orden,
      ...extra,
    },
  };
}

/** Filas MVP — orden estable para selects. */
export function cfgTipoNormaPrincipalArticulo() {
  return [
    cfgRow("CFG_TNPA_LEY", "LEY", "Ley", 10, {
      descripcion_ui: "Norma de rango legal (nacional o provincial); número/año en referencia.",
    }),
    cfgRow("CFG_TNPA_DECRETO", "DECRETO", "Decreto", 20),
    cfgRow("CFG_TNPA_RESOLUCION", "RESOLUCION", "Resolución", 30),
    cfgRow("CFG_TNPA_DISPOSICION", "DISPOSICION", "Disposición / acto administrativo", 40),
    cfgRow("CFG_TNPA_CIRCULAR", "CIRCULAR", "Circular / instructivo institucional", 50),
    cfgRow("CFG_TNPA_CONVENIO", "CONVENIO_COLECTIVO", "Convenio colectivo / paritario", 60),
    cfgRow("CFG_TNPA_OTRO", "OTRO", "Otro", 90, {
      descripcion_ui: "Usar cuando ningún tipo anterior encaja; precisar en referencia normativa.",
    }),
  ];
}
