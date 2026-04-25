/**
 * Catálogos editables desde Configuración maestra (RRHH).
 * Para añadir una colección: agregar el ítem aquí y duplicar el `collectionName` en
 * `CFG_COLECCIONES_RRHH` de `functions/index.js` (lista blanca servidor).
 */

/** @typedef {{ key: string; etiqueta: string; collectionName: string; idPrefix: string }} ItemCatalogoCfg */
/** @typedef {{ id: string; titulo: string; items: ItemCatalogoCfg[] }} SeccionCatalogoCfg */

/** @type {SeccionCatalogoCfg[]} */
export const SECCIONES_CATALOGO_RRHH = [
  {
    id: "identidad",
    titulo: "Identidad",
    items: [
      {
        key: "estado_civil",
        etiqueta: "Estado Civil",
        collectionName: "cfg_estado_civil",
        idPrefix: "CFG_EST_CIVIL_",
      },
      {
        key: "sexo_genero",
        etiqueta: "Género",
        collectionName: "cfg_sexo_genero",
        idPrefix: "CFG_GEN_",
      },
    ],
  },
  {
    id: "laboral",
    titulo: "Laboral",
    items: [
      {
        key: "escalafon",
        etiqueta: "Escalafones",
        collectionName: "cfg_escalafon",
        idPrefix: "CFG_ESC_",
      },
      {
        key: "agrupamiento",
        etiqueta: "Agrupamientos",
        collectionName: "cfg_agrupamiento",
        idPrefix: "CFG_AGR_",
      },
      {
        key: "tipo_vinculo",
        etiqueta: "Tipos de Vínculo",
        collectionName: "cfg_tipo_vinculo_laboral",
        idPrefix: "CFG_VIN_",
      },
      {
        key: "cargo_funcional",
        etiqueta: "Cargos Funcionales",
        collectionName: "cfg_cargo_funcional",
        idPrefix: "CFG_CF_",
      },
    ],
  },
  {
    id: "estructura",
    titulo: "Estructura",
    items: [
      {
        key: "grupo_trabajo",
        etiqueta: "Grupos de Trabajo",
        collectionName: "grupos_de_trabajo",
        idPrefix: "GT_",
      },
      {
        key: "efector",
        etiqueta: "Efectores",
        collectionName: "efectores",
        idPrefix: "EFE_",
      },
    ],
  },
];

/** Mapa rápido `key` → ítem (primera coincidencia). */
export const ITEM_CATALOGO_POR_KEY = SECCIONES_CATALOGO_RRHH.flatMap((s) => s.items).reduce(
  (acc, it) => {
    acc[it.key] = it;
    return acc;
  },
  /** @type {Record<string, ItemCatalogoCfg>} */ ({}),
);

/** Primera categoría por defecto. */
export const ITEM_CATALOGO_DEFAULT = SECCIONES_CATALOGO_RRHH[0].items[0];
