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
    id: "datos_personales",
    titulo: "Personales (ficha, domicilio, formación, grupo familiar)",
    items: [
      {
        key: "nacionalidad",
        etiqueta: "Nacionalidades",
        collectionName: "cfg_nacionalidad",
        idPrefix: "CFG_NAC_",
      },
      {
        key: "provincia",
        etiqueta: "Provincias",
        collectionName: "cfg_provincia",
        idPrefix: "CFG_PROV_",
      },
      {
        key: "localidad",
        etiqueta: "Localidades",
        collectionName: "cfg_localidad",
        idPrefix: "CFG_LOC_",
      },
      {
        key: "nivel_estudios",
        etiqueta: "Nivel de estudios",
        collectionName: "cfg_nivel_estudios",
        idPrefix: "CFG_EST_",
      },
      {
        key: "parentesco",
        etiqueta: "Parentesco (familiares)",
        collectionName: "cfg_parentesco",
        idPrefix: "CFG_PAR_",
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
    id: "laboral_avanzado",
    titulo: "Laboral avanzado",
    items: [
      {
        key: "modalidad_jornada",
        etiqueta: "Modalidad de jornada",
        collectionName: "cfg_modalidad_jornada",
        idPrefix: "CFG_MOD_",
      },
      {
        key: "estado_asignacion_laboral",
        etiqueta: "Estado de asignación laboral",
        collectionName: "cfg_estado_asignacion_laboral",
        idPrefix: "CFG_EST_LAB_",
      },
      {
        key: "causal_fin_asignacion_laboral",
        etiqueta: "Causal de fin de asignación",
        collectionName: "cfg_causal_fin_asignacion_laboral",
        idPrefix: "CFG_CAU_FIN_",
      },
      {
        key: "tipo_acto_designacion",
        etiqueta: "Tipo de acto de designación",
        collectionName: "cfg_tipo_acto_designacion",
        idPrefix: "CFG_ACT_",
      },
      {
        key: "tipo_grupo",
        etiqueta: "Tipo de grupo de trabajo",
        collectionName: "cfg_tipo_grupo",
        idPrefix: "CFG_TGR_",
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
        collectionName: "cfg_efectores",
        idPrefix: "CFG_EFE_",
      },
    ],
  },
  {
    id: "acceso",
    titulo: "Acceso e identidad digital",
    items: [
      {
        key: "rol",
        etiqueta: "Roles de aplicación",
        collectionName: "cfg_rol",
        idPrefix: "CFG_",
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
