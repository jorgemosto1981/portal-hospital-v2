"use strict";

const { listarGruposTrabajoVigentesEnFecha } = require("../shared/solicitudGrupoTrabajoAncla");

/**
 * @param {string | null | undefined} grupo_trabajo_id_cfg
 */
function relojEsUniversalPorGrupoCfg(grupo_trabajo_id_cfg) {
  return !/^gdt_/i.test(String(grupo_trabajo_id_cfg || "").trim());
}

/**
 * @param {{ persona_id?: string, grupo_trabajo_id?: string | null, multi_cargo_universal?: boolean }} enrol
 * @param {boolean} relojUniversal
 */
function enrolamientoEsMultiCargoUniversal(enrol, relojUniversal) {
  if (!enrol?.persona_id) return false;
  if (relojUniversal) return true;
  return enrol.multi_cargo_universal === true;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} persona_id
 * @param {string} fecha_ymd
 * @param {Map<string, string[]>} [cache]
 */
async function idsGdtsVigentesPersonaEnFecha(db, persona_id, fecha_ymd, cache) {
  const fecha = String(fecha_ymd || "").slice(0, 10);
  const key = `${persona_id}|${fecha}`;
  if (cache && cache.has(key)) return cache.get(key);
  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, persona_id, fecha);
  const ids = vigentes
    .map((g) => String(g.grupo_de_trabajo_id || "").trim())
    .filter((id) => /^gdt_/i.test(id));
  if (cache) cache.set(key, ids);
  return ids;
}

/**
 * Expande líneas de import (o huérfanas) a un vis_* por cada GDT con HLG vigente en la fecha de la marca.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   marcas: Array<object & { numero_tarjeta?: string, fecha_ymd?: string }>,
 *   enrolMap: Map<string, { persona_id: string, grupo_trabajo_id?: string | null, multi_cargo_universal?: boolean }>,
 *   relojUniversal: boolean,
 * }} opts
 */
async function expandirMarcasPorEnrolamientoYMultiCargo(db, { marcas, enrolMap, relojUniversal }) {
  const conPersona = [];
  const huerfanas = [];
  const cache = new Map();

  for (const linea of marcas) {
    const tarjeta = String(linea.numero_tarjeta || "").trim();
    const enrol = enrolMap.get(tarjeta);
    if (!enrol?.persona_id) {
      huerfanas.push(linea);
      continue;
    }

    if (enrolamientoEsMultiCargoUniversal(enrol, relojUniversal)) {
      const gdts = await idsGdtsVigentesPersonaEnFecha(db, enrol.persona_id, linea.fecha_ymd, cache);
      if (gdts.length === 0) {
        huerfanas.push(linea);
        continue;
      }
      for (const grupo_trabajo_id of gdts) {
        conPersona.push({
          ...linea,
          persona_id: enrol.persona_id,
          grupo_trabajo_id,
        });
      }
      continue;
    }

    const gdt = String(enrol.grupo_trabajo_id || "").trim();
    if (!/^gdt_/i.test(gdt)) {
      huerfanas.push(linea);
      continue;
    }
    conPersona.push({
      ...linea,
      persona_id: enrol.persona_id,
      grupo_trabajo_id: gdt,
    });
  }

  return { conPersona, huerfanas };
}

module.exports = {
  relojEsUniversalPorGrupoCfg,
  enrolamientoEsMultiCargoUniversal,
  idsGdtsVigentesPersonaEnFecha,
  expandirMarcasPorEnrolamientoYMultiCargo,
};
