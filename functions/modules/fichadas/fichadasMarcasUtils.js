"use strict";

const { instanteMarcaInstitucionalMs } = require("../shared/fichadasValidacionMarcas");

function marcasDesdeFichadasRealesExistentes(fichadas_reales, fecha_ymd) {
  if (!Array.isArray(fichadas_reales)) return [];
  const out = [];
  for (const row of fichadas_reales) {
    if (!row || typeof row !== "object") continue;
    const ing = row.ingreso ? String(row.ingreso).trim() : "";
    const egr = row.egreso ? String(row.egreso).trim() : "";
    const hm = row.hora_hm ? String(row.hora_hm).trim() : "";
    if (ing) {
      out.push({
        fecha_ymd,
        hora_hm: ing,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, ing),
      });
    }
    if (egr) {
      out.push({
        fecha_ymd,
        hora_hm: egr,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, egr),
      });
    }
    if (hm && !ing && !egr) {
      out.push({
        fecha_ymd,
        hora_hm: hm,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, hm),
      });
    }
  }
  return out.filter((m) => Number.isFinite(m.instante_ms));
}

function marcasDesdePayloadHoras(marcas, fecha_ymd) {
  if (!Array.isArray(marcas)) return [];
  return marcas
    .map((m) => {
      const hora_hm = String(m?.hora_hm || "").trim();
      if (!hora_hm) return null;
      return {
        fecha_ymd,
        hora_hm,
        instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, hora_hm),
      };
    })
    .filter(Boolean);
}

function unirMarcasSinDuplicarInstante(listas) {
  const seen = new Set();
  const out = [];
  for (const lista of listas) {
    for (const m of lista) {
      const k = String(m.instante_ms);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
  }
  return out;
}

function leerVersionCeldaFichada(celda) {
  const v = celda && celda.fichadas_reales_version;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {object} celdaAntes
 * @param {number|null|undefined} versionEsperada
 */
function validarVersionCeldaFichada(celdaAntes, versionEsperada) {
  if (versionEsperada == null || versionEsperada === "") return;
  const actual = leerVersionCeldaFichada(celdaAntes);
  const esperada = Number(versionEsperada);
  if (!Number.isFinite(esperada)) return;
  if (actual !== esperada) {
    const err = new Error("El día fue modificado; recargá y reintentá.");
    err.code = "failed-precondition";
    err.codigo = "CONCURRENCIA_VERSION";
    throw err;
  }
}

module.exports = {
  marcasDesdeFichadasRealesExistentes,
  marcasDesdePayloadHoras,
  unirMarcasSinDuplicarInstante,
  leerVersionCeldaFichada,
  validarVersionCeldaFichada,
};
