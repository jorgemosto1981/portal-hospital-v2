"use strict";

/**
 * @param {unknown} v
 * @param {number} [max]
 */
function textoCampo(v, max = 2000) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * DTO plano de `ingreso_medico` + fechas estimadas del aviso para bandeja auditoría.
 * Sin adjuntos (ya viajan en `certificado_adjuntos`).
 *
 * @param {Record<string, unknown>} sol
 */
function mapearFichaIngresoAgenteBandejaAuditor(sol) {
  const ing = sol.ingreso_medico && typeof sol.ingreso_medico === "object" ? sol.ingreso_medico : {};
  const contacto =
    ing.declaracion_contacto && typeof ing.declaracion_contacto === "object"
      ? ing.declaracion_contacto
      : {};
  const clinica =
    ing.declaracion_clinica && typeof ing.declaracion_clinica === "object"
      ? ing.declaracion_clinica
      : {};
  const familiar =
    ing.familiar_atendido && typeof ing.familiar_atendido === "object"
      ? ing.familiar_atendido
      : null;

  const desde = String(sol.fecha_inicio_reposo_estimada || "").slice(0, 10);
  const hasta = String(sol.fecha_fin_reposo_estimada || "").slice(0, 10);

  return {
    tipo_ingreso_id: textoCampo(ing.tipo_ingreso_id, 64),
    comentario_agente: textoCampo(ing.comentario_agente, 2000),
    telefono_celular: textoCampo(contacto.telefono_celular, 32),
    telefono_fijo: textoCampo(contacto.telefono_fijo, 32),
    email: textoCampo(contacto.email, 256),
    domicilio_declarado: textoCampo(contacto.domicilio_declarado, 512),
    permanece_en_domicilio: contacto.permanece_en_domicilio === true,
    usar_datos_perfil: contacto.usar_datos_perfil === true,
    sintomas: textoCampo(clinica.sintomas, 2000),
    enfermedad: textoCampo(clinica.enfermedad, 500),
    codigo_cie_clinica: textoCampo(clinica.codigo_cie, 16),
    detalle_clinico: textoCampo(clinica.detalle, 2000),
    familiar_nombre: familiar ? textoCampo(familiar.nombre, 120) : null,
    familiar_apellido: familiar ? textoCampo(familiar.apellido, 120) : null,
    familiar_dni: familiar ? textoCampo(familiar.dni, 16) : null,
    familiar_parentesco_id: familiar ? textoCampo(familiar.parentesco_id, 64) : null,
    fecha_estimada_desde: /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : null,
    fecha_estimada_hasta: /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : null,
  };
}

module.exports = {
  mapearFichaIngresoAgenteBandejaAuditor,
};
