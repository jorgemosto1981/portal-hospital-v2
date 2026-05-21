"use strict";

/**
 * Códigos Oleada A — autorización jerárquica y toma de conocimiento.
 * @see docs/v2/RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md
 */

const CODIGO_ELEG_SIN_HLG = "ELEG_SIN_HLG";
const CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS = "PERMISOS_JERARQUICOS_CAMBIADOS";
const CODIGO_ORGANIGRAMA_CICLICO = "ORGANIGRAMA_CICLICO";
const CODIGO_GRUPO_ANCLA_INVALIDO = "GRUPO_ANCLA_INVALIDO";
const CODIGO_FECHA_REF_INVALIDA = "FECHA_REF_INVALIDA";
const CODIGO_TITULAR_INVALIDO = "TITULAR_INVALIDO";

const MENSAJES = {
  [CODIGO_ELEG_SIN_HLG]:
    "No tenés un cargo vigente en el grupo de trabajo elegido para la fecha del permiso.",
  [CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS]:
    "Los permisos jerárquicos cambiaron; ya no podés autorizar esta solicitud.",
  [CODIGO_ORGANIGRAMA_CICLICO]:
    "El organigrama de grupos tiene un ciclo; no se pudo resolver el autorizador.",
  [CODIGO_GRUPO_ANCLA_INVALIDO]: "El grupo de trabajo ancla no es válido.",
  [CODIGO_FECHA_REF_INVALIDA]: "La fecha de referencia debe ser YYYY-MM-DD.",
  [CODIGO_TITULAR_INVALIDO]: "El titular de la solicitud no es válido.",
};

/**
 * @param {string} codigo
 * @returns {string}
 */
function mensajeParaCodigoAutorizacion(codigo) {
  const c = String(codigo || "").trim();
  return MENSAJES[c] || "No se pudo resolver la autorización jerárquica.";
}

module.exports = {
  CODIGO_ELEG_SIN_HLG,
  CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS,
  CODIGO_ORGANIGRAMA_CICLICO,
  CODIGO_GRUPO_ANCLA_INVALIDO,
  CODIGO_FECHA_REF_INVALIDA,
  CODIGO_TITULAR_INVALIDO,
  MENSAJES,
  mensajeParaCodigoAutorizacion,
};
