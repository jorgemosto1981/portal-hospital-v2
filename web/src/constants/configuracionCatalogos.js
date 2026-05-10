/**
 * Catálogos editables desde Configuración maestra (RRHH).
 * Para añadir una colección: agregar el ítem aquí y duplicar el `collectionName` en
 * `CFG_COLECCIONES_RRHH` en `functions/modules/shared/constants.js` (lista blanca servidor).
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
        key: "pais",
        etiqueta: "Países",
        collectionName: "cfg_pais",
        idPrefix: "CFG_PAIS_",
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
        key: "especialidad",
        etiqueta: "Especialidades",
        collectionName: "cfg_especialidad",
        idPrefix: "CFG_ESP_",
      },
      {
        key: "colegio",
        etiqueta: "Colegios",
        collectionName: "cfg_colegio",
        idPrefix: "CFG_COL_",
      },
      {
        key: "jurisdiccion_matricula",
        etiqueta: "Jurisdicciones de matrícula",
        collectionName: "cfg_jurisdiccion_matricula",
        idPrefix: "CFG_JUR_",
      },
      {
        key: "parentesco",
        etiqueta: "Parentesco (familiares)",
        collectionName: "cfg_parentesco",
        idPrefix: "CFG_PAR_",
      },
      {
        key: "estado_declaracion_ddjj",
        etiqueta: "Estado de declaración DDJJ",
        collectionName: "cfg_estado_declaracion_ddjj",
        idPrefix: "CFG_DDJJ_",
      },
      {
        key: "estado_perfil_datos",
        etiqueta: "Estado de perfil de datos",
        collectionName: "cfg_estado_perfil_datos",
        idPrefix: "CFG_EPD_",
      },
      {
        key: "motivo_baja_persona",
        etiqueta: "Motivos de baja de persona",
        collectionName: "cfg_motivo_baja_persona",
        idPrefix: "CFG_MOT_BAJA_",
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
        key: "regimen_horario",
        etiqueta: "Régimen horario",
        collectionName: "cfg_regimen_horario",
        idPrefix: "CFG_REG_HOR_",
      },
      {
        key: "centro_costo",
        etiqueta: "Centro de costo",
        collectionName: "cfg_centro_costo",
        idPrefix: "CFG_CEN_COST_",
      },
    ],
  },
  {
    id: "articulos",
    titulo: "Artículos (licencias)",
    items: [
      {
        key: "tipo_articulo",
        etiqueta: "Tipo de artículo",
        collectionName: "cfg_tipo_articulo",
        idPrefix: "CFG_TA_",
      },
      {
        key: "unidad_medida_articulo",
        etiqueta: "Unidad de medida",
        collectionName: "cfg_unidad_medida_articulo",
        idPrefix: "CFG_UM_",
      },
      {
        key: "origen_alta_solicitud",
        etiqueta: "Origen de alta (solicitud)",
        collectionName: "cfg_origen_alta_solicitud",
        idPrefix: "CFG_OAS_",
      },
      {
        key: "regla_split_remanente",
        etiqueta: "Regla split remanente",
        collectionName: "cfg_regla_split_remanente",
        idPrefix: "CFG_RSR_",
      },
      {
        key: "prioridad_normativa",
        etiqueta: "Prioridad normativa",
        collectionName: "cfg_prioridad_normativa",
        idPrefix: "CFG_PN_",
      },
      {
        key: "politica_superposicion",
        etiqueta: "Política de superposición",
        collectionName: "cfg_politica_superposicion",
        idPrefix: "CFG_PS_",
      },
      {
        key: "momento_entrega_documentacion",
        etiqueta: "Momento de entrega de documentación",
        collectionName: "cfg_momento_entrega_documentacion",
        idPrefix: "CFG_MED_",
      },
      {
        key: "tipo_computo_plazo",
        etiqueta: "Tipo de cómputo de plazo (documental)",
        collectionName: "cfg_tipo_computo_plazo",
        idPrefix: "CFG_TCP_",
      },
      {
        key: "accion_vencimiento",
        etiqueta: "Acción ante vencimiento (SLA / documental)",
        collectionName: "cfg_accion_vencimiento",
        idPrefix: "CFG_AV_",
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
        idPrefix: "gdt_",
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
      {
        key: "estado_cuenta_acceso",
        etiqueta: "Estado de cuenta de acceso",
        collectionName: "cfg_estado_cuenta_acceso",
        idPrefix: "CFG_ECA_",
      },
      {
        key: "tipo_evento",
        etiqueta: "Tipos de evento",
        collectionName: "cfg_tipo_evento",
        idPrefix: "CFG_TEV_",
      },
      {
        key: "estado_bandeja_rrhh",
        etiqueta: "Estado de bandeja RRHH",
        collectionName: "cfg_estado_bandeja_rrhh",
        idPrefix: "CFG_EBR_",
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
