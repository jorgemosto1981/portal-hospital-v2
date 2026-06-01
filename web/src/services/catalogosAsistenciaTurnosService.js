/**
 * Lectura de catálogos cfg asistencia/turnos con validación Zod (T-02).
 */
import { callListarCatalogosAsistenciaTurnos } from "./callables.js";
import { parseListarCatalogosAsistenciaTurnosResponse } from "../schemas/cfgAsistenciaTurnos.schema.js";

/**
 * @returns {Promise<import("../schemas/cfgAsistenciaTurnos.schema.js").ListarCatalogosAsistenciaTurnosResponse>}
 */
export async function listarCatalogosAsistenciaTurnosValidado() {
  const res = await callListarCatalogosAsistenciaTurnos();
  const data = res?.data ?? res;
  return parseListarCatalogosAsistenciaTurnosResponse(data);
}
