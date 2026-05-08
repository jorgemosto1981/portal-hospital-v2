import { isoToDateInput, normalizeCargaRowsFromRecord } from "./utils.js";

export function buildFormDataFromRecord({ record, idxHld, prevFormData }) {
  if (!record || typeof record !== "object") return null;
  const datoRef = idxHld.get(String(record.dato_laboral_id || ""));
  const nextFormData = {
    ...prevFormData,
    persona_id: String(record.persona_id || ""),
    grupo_de_trabajo_id: String(record.grupo_de_trabajo_id || ""),
    efector_designacion_id: String(record.efector_designacion_id || ""),
    efector_cumplimiento_id: String(record.efector_cumplimiento_id || ""),
    estado_asignacion_id: String(record.estado_asignacion_id || ""),
    carga_horaria_total: record.carga_horaria_total == null ? "" : String(record.carga_horaria_total),
    fecha_desde: isoToDateInput(
      String(record.fecha_desde || record.fecha_inicio || (datoRef && datoRef.fecha_inicio) || ""),
    ),
    fecha_hasta: isoToDateInput(
      String(record.fecha_hasta || record.fecha_fin || (datoRef && datoRef.fecha_fin) || ""),
    ),
    cargo_id: String(record.cargo_id || (datoRef && datoRef.cargo_id) || ""),
    cargo_funcional_id: String(record.cargo_funcional_id || ""),
    tipo_vinculo_id: String(record.tipo_vinculo_id || ""),
    modalidad_jornada_id: String(record.modalidad_jornada_id || ""),
    causal_fin_asignacion_id: String(record.causal_fin_asignacion_id || ""),
    computa_antiguedad_licencias:
      record.computa_antiguedad_licencias === false ? "no" : "si",
    referencia_tipo_acto_id: String(
      (Array.isArray(record.referencias_normativa_designacion) &&
        record.referencias_normativa_designacion[0] &&
        record.referencias_normativa_designacion[0].tipo_acto_id) ||
        "",
    ),
    referencia_numero: String(
      (Array.isArray(record.referencias_normativa_designacion) &&
        record.referencias_normativa_designacion[0] &&
        record.referencias_normativa_designacion[0].numero) ||
        "",
    ),
    referencia_fecha: isoToDateInput(
      String(
        (Array.isArray(record.referencias_normativa_designacion) &&
          record.referencias_normativa_designacion[0] &&
          record.referencias_normativa_designacion[0].fecha) ||
          "",
      ),
    ),
    referencia_detalle: String(
      (Array.isArray(record.referencias_normativa_designacion) &&
        record.referencias_normativa_designacion[0] &&
        record.referencias_normativa_designacion[0].detalle) ||
        "",
    ),
    categoria_id: String(record.categoria_id || ""),
    rol_id: String(record.rol_id || (datoRef && datoRef.rol_id) || ""),
    regimen_horario_id: String(record.regimen_horario_id || (datoRef && datoRef.regimen_horario_id) || ""),
    centro_costo_id: String(record.centro_costo_id || (datoRef && datoRef.centro_costo_id) || ""),
    escalafon_id: String(record.escalafon_id || ""),
    agrupamiento_id: String(record.agrupamiento_id || ""),
    funcion_real_id: String(record.funcion_real_id || (datoRef && datoRef.funcion_real_id) || ""),
    nivel_jerarquico: record.nivel_jerarquico == null ? "" : String(record.nivel_jerarquico),
    dato_laboral_id: String(record.dato_laboral_id || ""),
    carga_por_dia_semana: Array.isArray(record.carga_por_dia_semana)
      ? record.carga_por_dia_semana.join(",")
      : "",
  };
  return {
    formData: nextFormData,
    cargaPorDiaRows: normalizeCargaRowsFromRecord(record.carga_por_dia_semana),
  };
}

export function requiredFieldsByTipo(tipoAlta) {
  if (tipoAlta === "historial_laboral_cargos") {
    return [
      "persona_id",
      "rol_id",
      "efector_designacion_id",
      "efector_cumplimiento_id",
      "estado_asignacion_id",
      "escalafon_id",
      "agrupamiento_id",
      "tipo_vinculo_id",
      "categoria_id",
      "cargo_funcional_id",
      "modalidad_jornada_id",
      "carga_horaria_total",
      "fecha_desde",
    ];
  }
  return [
    "persona_id",
    "cargo_id",
    "grupo_de_trabajo_id",
    "funcion_real_id",
    "nivel_jerarquico",
    "fecha_desde",
  ];
}

export function validateLaboralForm({ tipoAlta, formData, cargaPorDiaRows, idxHlc }) {
  const faltantes = requiredFieldsByTipo(tipoAlta).filter((k) => !String(formData[k] || "").trim());
  if (faltantes.length > 0) return `Completá los campos obligatorios: ${faltantes.join(", ")}`;
  if (formData.persona_id && !/^per_/i.test(formData.persona_id.trim())) {
    return "persona_id debe comenzar con per_.";
  }
  if (formData.carga_horaria_total) {
    const n = Number(formData.carga_horaria_total);
    if (!Number.isFinite(n) || n < 0 || n > 168) {
      return "carga_horaria_total debe ser un número entre 0 y 168.";
    }
  }
  if (formData.nivel_jerarquico) {
    const n = Number(formData.nivel_jerarquico);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      return "nivel_jerarquico debe ser un entero entre 1 y 99.";
    }
  }
  if (formData.fecha_desde && formData.fecha_hasta && formData.fecha_desde > formData.fecha_hasta) {
    return "fecha_hasta no puede ser menor que fecha_desde.";
  }
  if (
    tipoAlta === "historial_laboral_cargos" &&
    formData.fecha_hasta &&
    !String(formData.causal_fin_asignacion_id || "").trim()
  ) {
    return "Si informás fecha_hasta en HLc, causal_fin_asignacion_id es obligatorio.";
  }
  if (tipoAlta === "historial_laboral_cargos") {
    if (!String(formData.referencia_tipo_acto_id || "").trim()) {
      return "En HLc, referencia normativa requiere tipo_acto_id.";
    }
    if (!String(formData.referencia_numero || "").trim()) {
      return "En HLc, referencia normativa requiere número.";
    }
    if (!String(formData.referencia_fecha || "").trim()) {
      return "En HLc, referencia normativa requiere fecha.";
    }
  }
  if (tipoAlta === "historial_laboral_grupos") {
    const cargoRef = idxHlc && formData.cargo_id ? idxHlc.get(String(formData.cargo_id || "")) : null;
    if (cargoRef) {
      const cargoDesde = String(cargoRef.fecha_desde || "").trim();
      const cargoHasta = String(cargoRef.fecha_hasta || "").trim();
      const fechaDesde = String(formData.fecha_desde || "").trim();
      const fechaHasta = String(formData.fecha_hasta || "").trim();
      if (cargoDesde && fechaDesde && fechaDesde < cargoDesde) {
        return "La fecha de inicio del detalle/asignacion no puede ser anterior al inicio del cargo.";
      }
      if (cargoHasta && !fechaHasta) {
        return "El cargo seleccionado esta cerrado; debés informar fecha de fin en el detalle/asignación.";
      }
      if (cargoHasta && fechaHasta && fechaHasta > cargoHasta) {
        return "La fecha de fin del detalle/asignación no puede superar la fecha de fin del cargo.";
      }
    }
    const rowsValidas = (cargaPorDiaRows || [])
      .map((row) => ({
        dia_semana_id: String(row.dia_semana_id || "").trim(),
        horas: String(row.horas || "").trim(),
      }))
      .filter((row) => row.dia_semana_id || row.horas);
    if (rowsValidas.length === 0) {
      return "Completá al menos una fila de carga_por_dia_semana (día + horas).";
    }
    const seen = new Set();
    for (const row of rowsValidas) {
      if (!row.dia_semana_id) return "Cada fila de carga_por_dia_semana requiere dia_semana_id.";
      if (seen.has(row.dia_semana_id)) {
        return `dia_semana_id duplicado en carga_por_dia_semana: ${row.dia_semana_id}.`;
      }
      seen.add(row.dia_semana_id);
      if (!Number.isFinite(Number(row.horas)) || Number(row.horas) < 0 || Number(row.horas) > 24) {
        return `Horas inválidas para ${row.dia_semana_id}. Debe estar entre 0 y 24.`;
      }
    }
  }
  return "";
}
