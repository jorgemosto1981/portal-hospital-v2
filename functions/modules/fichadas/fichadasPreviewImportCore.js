"use strict";

const {
  parseTxtRelojBiometrico,
  detectarDuplicadosProbablesEnLote,
  CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE,
  CODIGO_ERROR_LINEA_INVALIDA,
  DEFAULT_UMBRAL_DUPLICADO_MINUTOS,
} = require("../shared/fichadasValidacionMarcas");

const CODIGO_AVISO_SIN_PERSONA = "MARCA_SIN_PERSONA";
const POLITICAS_DUPLICADOS = new Set(["EXCLUIR_SEGUNDA", "MANTENER_TODAS", "BLOQUEAR_APLICAR"]);

/**
 * @param {object} fila
 * @param {string} politica
 */
function incluirPorDefectoEnApply(fila, politica) {
  if (!fila.ok) return false;
  const esDup = (fila.advertencias || []).includes(CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE);
  if (politica === "MANTENER_TODAS") return true;
  if (politica === "EXCLUIR_SEGUNDA" && esDup) return false;
  if (politica === "BLOQUEAR_APLICAR") return !esDup;
  return true;
}

/**
 * Preview import TXT — solo memoria (§ Fase D).
 *
 * @param {object} params
 * @param {string} params.contenido_txt
 * @param {number} [params.umbral_duplicado_minutos]
 * @param {string} [params.politica_duplicados]
 * @param {Record<string, { persona_id?: string, persona_label?: string }>} [params.enrolamiento_por_tarjeta]
 * @param {string} [params.mascara_tokens]
 */
function previsualizarImportFichadasReloj(params) {
  const contenido_txt = typeof params.contenido_txt === "string" ? params.contenido_txt : "";
  const umbral =
    params.umbral_duplicado_minutos != null
      ? Number(params.umbral_duplicado_minutos)
      : DEFAULT_UMBRAL_DUPLICADO_MINUTOS;
  const politica = POLITICAS_DUPLICADOS.has(String(params.politica_duplicados || "").trim())
    ? String(params.politica_duplicados).trim()
    : "EXCLUIR_SEGUNDA";
  const enrolMap =
    params.enrolamiento_por_tarjeta && typeof params.enrolamiento_por_tarjeta === "object"
      ? params.enrolamiento_por_tarjeta
      : {};

  if (!contenido_txt.trim()) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "contenido_txt vacío." };
  }

  const mascara_tokens =
    typeof params.mascara_tokens === "string" ? params.mascara_tokens.trim() : "";
  const parseadas = parseTxtRelojBiometrico(contenido_txt, { mascara_tokens });
  const okLines = parseadas.filter((l) => l.ok);
  const conDup = detectarDuplicadosProbablesEnLote(okLines, { umbral_duplicado_minutos: umbral });

  /** @type {Map<number, object>} */
  const dupByLine = new Map();
  for (const m of conDup) {
    if (m.numero_linea != null) dupByLine.set(m.numero_linea, m);
  }

  let duplicadosDetectados = 0;
  const filas = parseadas.map((linea) => {
    if (!linea.ok) {
      return {
        numero_linea: linea.numero_linea,
        ok: false,
        linea_raw: linea.linea_raw,
        codigo_error: linea.codigo || CODIGO_ERROR_LINEA_INVALIDA,
        mensaje_error: linea.mensaje,
        advertencias: [],
        incluir_por_defecto: false,
      };
    }

    const enriched = dupByLine.get(linea.numero_linea) || linea;
    const advertencias = [...(enriched.advertencias || [])];
    const tarjeta = String(linea.numero_tarjeta || "").trim();
    const enrol = enrolMap[tarjeta];
    const persona_id =
      enrol && typeof enrol.persona_id === "string" && enrol.persona_id.trim()
        ? enrol.persona_id.trim()
        : null;
    if (!persona_id) {
      advertencias.push(CODIGO_AVISO_SIN_PERSONA);
    }
    if (advertencias.includes(CODIGO_AVISO_MARCA_DUPLICADA_PROBABLE)) {
      duplicadosDetectados += 1;
    }

    const persona_label =
      enrol && typeof enrol.persona_label === "string" && enrol.persona_label.trim()
        ? enrol.persona_label.trim()
        : persona_id
          ? persona_id
          : "Sin Persona";

    return {
      numero_linea: linea.numero_linea,
      ok: true,
      linea_raw: linea.linea_raw,
      numero_tarjeta: tarjeta,
      persona_id,
      persona_label,
      fecha_ymd: linea.fecha_ymd,
      hora_hm: linea.hora_hm,
      numero_reloj: linea.numero_reloj,
      codigo_dispositivo: linea.codigo_dispositivo,
      advertencias: [...new Set(advertencias)],
      incluir_por_defecto: incluirPorDefectoEnApply({ ...linea, advertencias }, politica),
    };
  });

  const lineas_validas = filas.filter((f) => f.ok).length;
  const lineas_invalidas = filas.length - lineas_validas;
  const bloquear_aplicar =
    politica === "BLOQUEAR_APLICAR" && duplicadosDetectados > 0;

  return {
    ok: true,
    politica_duplicados: politica,
    umbral_duplicado_minutos: umbral,
    resumen: {
      lineas_totales: filas.length,
      lineas_validas,
      lineas_invalidas,
      duplicados_probables: duplicadosDetectados,
      sin_persona: filas.filter((f) => f.ok && f.advertencias.includes(CODIGO_AVISO_SIN_PERSONA)).length,
      bloquear_aplicar,
    },
    filas,
  };
}

module.exports = {
  CODIGO_AVISO_SIN_PERSONA,
  POLITICAS_DUPLICADOS,
  previsualizarImportFichadasReloj,
  incluirPorDefectoEnApply,
};
