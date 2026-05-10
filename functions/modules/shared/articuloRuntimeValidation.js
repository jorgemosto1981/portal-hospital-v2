"use strict";

const { calcularAntiguedad } = require("./antiguedadCalculator");

/**
 * @typedef {{ codigo: string, mensaje: string, severidad?: 'bloqueo'|'informacion' }} ArticuloIssue
 */

function mesesDesdeDesglose(amd) {
  if (!amd || typeof amd !== "object") return 0;
  const a = Number(amd.años) || 0;
  const m = Number(amd.meses) || 0;
  const d = Number(amd.dias) || 0;
  return a * 12 + m + Math.floor(d / 30);
}

function parseFechaCorteOrToday() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveExternosDesdePersona(persona) {
  if (!persona || typeof persona !== "object") return 0;
  const recArrayCandidates = [
    persona.antiguedad_reconocimientos,
    persona.antiguedad_externa_reconocimientos,
    persona.reconocimientos_antiguedad,
  ];
  for (const candidate of recArrayCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  const daysCandidates = [
    persona.antiguedad_reconocida_dias,
    persona.antiguedad_externa_dias,
    persona.dias_antiguedad_reconocida,
  ];
  for (const candidate of daysCandidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function normalizarHlcParaAntiguedad(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    fecha_inicio: row.fecha_inicio || row.fecha_desde || null,
    fecha_fin: row.fecha_fin || row.fecha_hasta || null,
    computa_antiguedad_licencias: row.computa_antiguedad_licencias === false ? false : true,
  }));
}

function elegirHlcActual(hlcRows, fechaRefIso) {
  const rows = Array.isArray(hlcRows) ? hlcRows : [];
  const activos = rows.filter((r) => {
    const fin = r.fecha_fin || r.fecha_hasta || null;
    if (!fin) return true;
    return String(fin) >= String(fechaRefIso).slice(0, 10);
  });
  activos.sort((a, b) => {
    const ia = String(a.fecha_inicio || a.fecha_desde || "");
    const ib = String(b.fecha_inicio || b.fecha_desde || "");
    return ib.localeCompare(ia);
  });
  return activos[0] || null;
}

function idsNonEmpty(arr) {
  return Array.isArray(arr) && arr.some((x) => typeof x === "string" && x.trim());
}

/**
 * Validaciones runtime cfg_articulos × persona/HLC (MVP motor solicitud).
 *
 * @param {{
 *   articulo: Record<string, unknown>,
 *   persona: Record<string, unknown>,
 *   hlcRows: Record<string, unknown>[],
 *   solicitudesContexto?: Array<{ articulo_id?: string }>,
 * }} p
 * @returns {ArticuloIssue[]}
 */
function validarReglasArticuloRuntime(p) {
  const issues = [];
  const articulo = p.articulo && typeof p.articulo === "object" ? p.articulo : {};
  const persona = p.persona && typeof p.persona === "object" ? p.persona : {};
  const hlcRows = Array.isArray(p.hlcRows) ? p.hlcRows : [];
  const solicitudesCtx = Array.isArray(p.solicitudesContexto) ? p.solicitudesContexto : [];

  const fechaCorte = parseFechaCorteOrToday();
  const hlcNorm = normalizarHlcParaAntiguedad(hlcRows);
  let amdResultado = null;
  try {
    amdResultado = calcularAntiguedad(hlcNorm, fechaCorte, resolveExternosDesdePersona(persona));
  } catch {
    amdResultado = null;
  }

  const filtros =
    articulo.filtros_elegibilidad != null && typeof articulo.filtros_elegibilidad === "object"
      ? articulo.filtros_elegibilidad
      : {};
  const hlcActual = elegirHlcActual(hlcNorm, fechaCorte);

  function fallaFiltroLista(campoPersonaOHLc, idsKey, etiqueta) {
    const ids = filtros[idsKey];
    if (!Array.isArray(ids) || ids.length === 0) return;
    const val =
      campoPersonaOHLc != null && typeof campoPersonaOHLc === "string"
        ? campoPersonaOHLc.trim()
        : "";
    if (!val || !ids.includes(val)) {
      issues.push({
        codigo: `FILTRO_${idsKey.toUpperCase()}`,
        mensaje: `No cumple filtro de ${etiqueta} para este artículo.`,
        severidad: "bloqueo",
      });
    }
  }

  fallaFiltroLista(persona.sexo_genero_id, "genero_ids", "género");

  if (hlcActual) {
    fallaFiltroLista(hlcActual.escalafon_id || hlcActual.escalafon, "escalafon_ids", "escalafón");
    fallaFiltroLista(hlcActual.agrupamiento_id || hlcActual.agrupamiento, "agrupamiento_ids", "agrupamiento");
    fallaFiltroLista(
      hlcActual.cargo_funcional_id,
      "cargo_funcional_ids",
      "cargo funcional",
    );
    fallaFiltroLista(
      hlcActual.tipo_vinculo_id || hlcActual.tipo_vinculo,
      "tipo_vinculo_ids",
      "tipo de vínculo",
    );
    fallaFiltroLista(hlcActual.efector_cumplimiento_id || hlcActual.efector_id, "efector_ids", "efector");
    fallaFiltroLista(hlcActual.grupo_trabajo_id, "grupo_trabajo_ids", "grupo de trabajo");
  } else if (
    idsNonEmpty(filtros.escalafon_ids) ||
    idsNonEmpty(filtros.agrupamiento_ids) ||
    idsNonEmpty(filtros.cargo_funcional_ids) ||
    idsNonEmpty(filtros.tipo_vinculo_ids) ||
    idsNonEmpty(filtros.efector_ids) ||
    idsNonEmpty(filtros.grupo_trabajo_ids)
  ) {
    issues.push({
      codigo: "SIN_HLC_ACTIVO",
      mensaje: "No hay asignación laboral activa para evaluar filtros de elegibilidad.",
      severidad: "bloqueo",
    });
  }

  const rea =
    articulo.reglas_elegibilidad_ampliada != null &&
    typeof articulo.reglas_elegibilidad_ampliada === "object"
      ? articulo.reglas_elegibilidad_ampliada
      : {};

  const minMeses = rea.antiguedad_minima_meses;
  if (typeof minMeses === "number" && minMeses > 0 && amdResultado) {
    const mesesPersona = mesesDesdeDesglose(amdResultado);
    if (mesesPersona < minMeses) {
      issues.push({
        codigo: "ANTIGUEDAD_INSUFICIENTE",
        mensaje: `Antigüedad reconocida insuficiente (mínimo ${minMeses} meses).`,
        severidad: "bloqueo",
      });
    }
  }

  if (idsNonEmpty(rea.situacion_revista_ids)) {
    const situacionId =
      (hlcActual && (hlcActual.situacion_revista_id || hlcActual.situacion_revista)) || null;
    if (typeof situacionId !== "string" || !rea.situacion_revista_ids.includes(situacionId)) {
      issues.push({
        codigo: "SITUACION_REVISTA",
        mensaje:
          "No coincide situación de revista configurable o falta dato en HLC (alinear legajo y cfg).",
        severidad: "informacion",
      });
    }
  }

  const inc =
    Array.isArray(articulo.articulos_incompatibles_ids) ? articulo.articulos_incompatibles_ids : [];
  const otrosArticulos = solicitudesCtx
    .map((s) => (s && typeof s.articulo_id === "string" ? s.articulo_id : null))
    .filter(Boolean);
  for (const otro of otrosArticulos) {
    if (inc.includes(otro)) {
      issues.push({
        codigo: "INCOMPATIBLE_ACTIVO",
        mensaje: `Existe solicitud activa de un artículo incompatible (${otro}).`,
        severidad: "bloqueo",
      });
      break;
    }
  }

  return issues;
}

module.exports = {
  validarReglasArticuloRuntime,
  mesesDesdeDesglose,
};
