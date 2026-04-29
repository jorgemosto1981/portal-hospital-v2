import { callListarReadModelLaboralOperativoTemporal } from "./callables.js";

export async function listarReadModelLaboralOperativo(filtros = {}) {
  const r = await callListarReadModelLaboralOperativoTemporal(filtros);
  const data = r && r.data && typeof r.data === "object" ? r.data : {};
  return {
    items: Array.isArray(data.items) ? data.items : [],
    resumen: data.resumen && typeof data.resumen === "object" ? data.resumen : {},
    meta: data.meta && typeof data.meta === "object" ? data.meta : {},
  };
}
