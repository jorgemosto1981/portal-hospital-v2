"use strict";

const CFG_NOD_EXCLUSIVO = "cfg_nod_exclusivo";
const CFG_NOD_INFORMATIVO = "cfg_nod_informativo";

/**
 * Conflicto real en celda: más de un evento y al menos uno no es solo informativo.
 * Un único evento (aunque exclusivo) no marca conflicto.
 *
 * @param {unknown[]} eventos
 */
function calcularTieneConflictoDia(eventos) {
  const list = Array.isArray(eventos) ? eventos : [];
  if (list.length <= 1) return false;

  const todosInformativos = list.every(
    (e) => String(e?.nivel_ocupacion_dia_id || "").trim() === CFG_NOD_INFORMATIVO,
  );
  if (todosInformativos) return false;

  const hayExclusivo = list.some((e) => {
    const n = String(e?.nivel_ocupacion_dia_id || "").trim();
    return !n || n === CFG_NOD_EXCLUSIVO;
  });
  if (hayExclusivo) return true;

  return list.length > 1;
}

module.exports = { calcularTieneConflictoDia, CFG_NOD_EXCLUSIVO, CFG_NOD_INFORMATIVO };
