"use strict";

const RX_GDT = /^gdt_/i;

/**
 * Facade de lectura: capa teórica materializada por bounded context (gdt).
 * @param {Record<string, unknown>|null|undefined} asiData Documento asi_* o sub-objeto
 * @param {string} grupoTrabajoId gdt_*
 * @returns {Record<string, unknown>|null}
 */
function resolverCapaTeoricaGrupo(asiData, grupoTrabajoId) {
  const gdt = String(grupoTrabajoId || "").trim();
  if (!RX_GDT.test(gdt)) return null;

  const map = asiData?.capa_teorica_por_grupo;
  if (!map || typeof map !== "object" || Array.isArray(map)) return null;

  const capa = map[gdt];
  if (!capa || typeof capa !== "object" || Array.isArray(capa)) return null;
  return capa;
}

module.exports = {
  resolverCapaTeoricaGrupo,
};
