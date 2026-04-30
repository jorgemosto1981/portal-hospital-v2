function toNull(value) {
  return value || null;
}

export function buildHlcPayload({ formData, modoEdicion, registroEditId }) {
  const payload = {
    persona_id: formData.persona_id,
    grupo_de_trabajo_id: toNull(formData.grupo_de_trabajo_id),
    rol_id: toNull(formData.rol_id),
    efector_designacion_id: formData.efector_designacion_id,
    efector_cumplimiento_id: formData.efector_cumplimiento_id,
    estado_asignacion_id: toNull(formData.estado_asignacion_id),
    escalafon_id: toNull(formData.escalafon_id),
    agrupamiento_id: toNull(formData.agrupamiento_id),
    cargo_funcional_id: toNull(formData.cargo_funcional_id),
    tipo_vinculo_id: toNull(formData.tipo_vinculo_id),
    modalidad_jornada_id: toNull(formData.modalidad_jornada_id),
    causal_fin_asignacion_id: toNull(formData.causal_fin_asignacion_id),
    referencias_normativa_designacion: [
      {
        tipo_acto_id: toNull(formData.referencia_tipo_acto_id),
        numero: toNull(formData.referencia_numero),
        fecha: toNull(formData.referencia_fecha),
        detalle: toNull(formData.referencia_detalle),
      },
    ],
    categoria_id: toNull(formData.categoria_id),
    carga_horaria_total: toNull(formData.carga_horaria_total),
    fecha_desde: toNull(formData.fecha_desde),
    fecha_hasta: toNull(formData.fecha_hasta),
  };
  if (modoEdicion && registroEditId) payload.id = registroEditId;
  return payload;
}

export function buildHldPayload({ formData, modoEdicion, registroEditId }) {
  const payload = {
    persona_id: formData.persona_id,
    cargo_id: formData.cargo_id,
    regimen_horario_id: toNull(formData.regimen_horario_id),
    centro_costo_id: toNull(formData.centro_costo_id),
    funcion_real_id: toNull(formData.funcion_real_id),
    nivel_jerarquico: toNull(formData.nivel_jerarquico),
    fecha_inicio: toNull(formData.fecha_desde),
    fecha_fin: toNull(formData.fecha_hasta),
  };
  if (modoEdicion && registroEditId && formData.dato_laboral_id) {
    payload.id = formData.dato_laboral_id;
  }
  return payload;
}

export function buildHlgPayload({ formData, hldId, cargaPorDiaRows, modoEdicion, registroEditId }) {
  const payload = {
    persona_id: formData.persona_id,
    dato_laboral_id: hldId,
    grupo_de_trabajo_id: formData.grupo_de_trabajo_id,
    nivel_jerarquico: toNull(formData.nivel_jerarquico),
    carga_por_dia_semana: (cargaPorDiaRows || [])
      .map((row) => ({
        dia_semana_id: String(row.dia_semana_id || "").trim() || null,
        horas: row.horas === "" ? null : Number(row.horas),
      }))
      .filter((row) => row.dia_semana_id && Number.isFinite(row.horas)),
    fecha_inicio: toNull(formData.fecha_desde),
    fecha_fin: toNull(formData.fecha_hasta),
  };
  if (modoEdicion && registroEditId) payload.id = registroEditId;
  return payload;
}
