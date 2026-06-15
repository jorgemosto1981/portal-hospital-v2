"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * US-15 / Q9-3: presencia agregada y contradicción fichada ↔ teoría (sin I/O).
 * @typedef {'presente'|'ausente'} FichadaPresencia
 */

/** @param {unknown} raw */
function normalizarTipoDia(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "no_laborable" || t === "no-laborable" || t === "nolaborable") return "no_laborable";
  if (t === "franco") return "franco";
  if (t === "guardia") return "guardia";
  if (t === "laborable") return "laborable";
  return t || null;
}

/**
 * Extrae registros de fichada desde celda vis_* (capa 4).
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {Array<Record<string, unknown>>}
 */
function parseFichadasRealesCelda(celda) {
  if (!celda || typeof celda !== "object") return [];

  const candidatos = [
    celda.fichadas_reales,
    celda.fichadas,
    celda.capa_realidad && typeof celda.capa_realidad === "object"
      ? /** @type {Record<string, unknown>} */ (celda.capa_realidad).fichadas
      : null,
  ];

  for (const raw of candidatos) {
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const items = raw.filter((x) => x && typeof x === "object");
    if (items.length > 0) return items;
  }
  return [];
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 */
function celdaTieneRegistroFichada(celda) {
  return parseFichadasRealesCelda(celda).length > 0;
}

/**
 * Cuenta marcas de reloj (no filas del array): ingreso + egreso por ítem, o `hora` suelta.
 * @param {Array<Record<string, unknown>>} fichadas
 */
function contarMarcasFichadaReal(fichadas) {
  if (!Array.isArray(fichadas)) return 0;
  let n = 0;
  for (const f of fichadas) {
    if (!f || typeof f !== "object") continue;
    const ingreso = String(f.ingreso || f.hora_ingreso || "").trim();
    const egreso = String(f.egreso || f.hora_egreso || "").trim();
    const hora = String(f.hora || "").trim();
    if (ingreso) n += 1;
    if (egreso) n += 1;
    if (!ingreso && !egreso && hora) n += 1;
  }
  return n;
}

/**
 * Fichada con marcas insuficientes vs `fichadas_esperadas` (capa teórica).
 * @param {Record<string, unknown>|null|undefined} celda
 */
function celdaTieneFichadaImpar(celda) {
  if (!celda || typeof celda !== "object") return false;
  if (!celdaTieneCapaFichadaCargada(celda)) return false;
  if (!celdaEsperaFichada(celda)) return false;

  const fichadas = parseFichadasRealesCelda(celda);
  if (fichadas.length === 0) return false;

  const marcas = contarMarcasFichadaReal(fichadas);
  if (marcas === 0) return false;

  const esperadas = Number(celda.fichadas_esperadas);
  if (Number.isFinite(esperadas) && esperadas >= 1 && marcas < esperadas) {
    return true;
  }

  return false;
}

/**
 * True si la celda trae capa 4 materializada (aunque esté vacía).
 * Sin este indicador no inferimos ausente — capa 4 puede no existir aún en prod.
 * @param {Record<string, unknown>|null|undefined} celda
 */
function celdaTieneCapaFichadaCargada(celda) {
  if (!celda || typeof celda !== "object") return false;
  if ("fichadas_reales" in celda) return true;
  if ("fichadas" in celda) return true;
  if ("capa_realidad" in celda) return true;
  return false;
}

/**
 * Día con expectativa de fichada según capa 1.
 * @param {Record<string, unknown>|null|undefined} celda
 */
function celdaEsperaFichada(celda) {
  if (!celda || typeof celda !== "object") return false;

  const tipo = normalizarTipoDia(celda.tipo_dia);
  const esFranco = celda.es_franco === true || tipo === "franco";
  const esNoLaborable = tipo === "no_laborable";
  if (esFranco || esNoLaborable) return false;

  const fichadasEsp = Number(celda.fichadas_esperadas);
  if (Number.isFinite(fichadasEsp) && fichadasEsp >= 1) return true;

  const turnoId = String(celda.rda_turno_id || "").trim();
  const ing = String(celda.rda_ingreso || "").trim();
  const egr = String(celda.rda_egreso || "").trim();
  if (turnoId || ing || egr) return true;

  return tipo === "guardia" || tipo === "laborable";
}

/**
 * Presencia agregada para jefe (Q9-3): sin horarios.
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {FichadaPresencia|null}
 */
function resolverFichadaPresencia(celda) {
  if (!celda || typeof celda !== "object") return null;
  if (!celdaTieneCapaFichadaCargada(celda)) return null;

  const fichadas = parseFichadasRealesCelda(celda);
  const tieneFichada = fichadas.length > 0;
  const espera = celdaEsperaFichada(celda);

  if (tieneFichada) return "presente";
  if (espera) return "ausente";
  return null;
}

/**
 * Formatea horarios para modal RRHH (sin PII extra).
 * @param {Array<Record<string, unknown>>} fichadas
 * @returns {string[]}
 */
function lineasHorarioFichadaReal(fichadas) {
  if (!Array.isArray(fichadas) || fichadas.length === 0) return [];

  const lineas = [];
  for (const f of fichadas) {
    if (!f || typeof f !== "object") continue;
    const ingreso = String(f.ingreso || f.hora_ingreso || "").trim();
    const egreso = String(f.egreso || f.hora_egreso || "").trim();
    const hora = String(f.hora || "").trim();
    const tipo = String(f.tipo || "").trim().toLowerCase();

    if (ingreso && egreso) {
      lineas.push(`${ingreso} – ${egreso}`);
      continue;
    }
    if (hora) {
      lineas.push(tipo ? `${tipo}: ${hora}` : hora);
      continue;
    }
    if (ingreso) lineas.push(`ingreso: ${ingreso}`);
    else if (egreso) lineas.push(`egreso: ${egreso}`);
  }
  return lineas;
}

/**
 * Texto compacto para celda grilla (mismo estilo que horario teórico).
 * @param {Array<Record<string, unknown>>} fichadas
 * @returns {string}
 */
function textoHorarioFichadaReal(fichadas) {
  if (!Array.isArray(fichadas) || fichadas.length === 0) return "";

  const partes = [];
  for (const f of fichadas) {
    if (!f || typeof f !== "object") continue;
    const ingreso = String(f.ingreso || f.hora_ingreso || "").trim();
    const egreso = String(f.egreso || f.hora_egreso || "").trim();
    const hora = String(f.hora || "").trim();

    if (ingreso && egreso) {
      partes.push(`${ingreso}–${egreso}`);
      continue;
    }
    if (hora) {
      partes.push(hora);
      continue;
    }
    if (ingreso) partes.push(ingreso);
    else if (egreso) partes.push(egreso);
  }
  return partes.join(" · ");
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {string}
 */
function textoHorarioFichadaRealDesdeCelda(celda) {
  return textoHorarioFichadaReal(parseFichadasRealesCelda(celda));
}

/**
 * Q9-4 B: fichada contradice teoría vigente (con licencia en celda).
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {{ contradictorio: boolean; motivo?: string; tooltip?: string }}
 */
function evaluarContradiccionFichadaTeoria(celda) {
  if (!celda || typeof celda !== "object") {
    return { contradictorio: false };
  }
  if (!celdaTieneCapaFichadaCargada(celda)) {
    return { contradictorio: false };
  }

  const fichadas = parseFichadasRealesCelda(celda);
  const tieneFichada = fichadas.length > 0;
  const espera = celdaEsperaFichada(celda);

  if (tieneFichada && !espera) {
    return {
      contradictorio: true,
      motivo: "fichada_contradice_teoria",
      tooltip: "Fichada no coincide con turno teórico",
    };
  }

  if (!tieneFichada && espera) {
    return {
      contradictorio: true,
      motivo: "fichada_contradice_teoria",
      tooltip: "Fichada no coincide con turno teórico",
    };
  }

  return { contradictorio: false };
}

module.exports = { parseFichadasRealesCelda, celdaTieneRegistroFichada, contarMarcasFichadaReal, celdaTieneFichadaImpar, celdaTieneCapaFichadaCargada, celdaEsperaFichada, resolverFichadaPresencia, lineasHorarioFichadaReal, textoHorarioFichadaReal, textoHorarioFichadaRealDesdeCelda, evaluarContradiccionFichadaTeoria };
