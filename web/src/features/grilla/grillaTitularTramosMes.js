import {
  hldHlgFechaFinYmd,
  hldHlgFechaInicioYmd,
} from "../../pages/datos-laborales/utils.js";
import { filaKeyAg } from "./grillaMesFilasUtils.js";

function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function rangoMes(anio, mes) {
  const y = Number(anio);
  const m = Number(mes);
  const ultimo = diasEnMes(y, m);
  const mm = String(m).padStart(2, "0");
  return {
    primerDia: `${y}-${mm}-01`,
    ultimoDia: `${y}-${mm}-${String(ultimo).padStart(2, "0")}`,
  };
}

function maxYmd(a, b) {
  return String(a || "").slice(0, 10) >= String(b || "").slice(0, 10)
    ? String(a).slice(0, 10)
    : String(b).slice(0, 10);
}

function minYmd(a, b) {
  return String(a || "").slice(0, 10) <= String(b || "").slice(0, 10)
    ? String(a).slice(0, 10)
    : String(b).slice(0, 10);
}

function hlgCuentaOperativa(row) {
  if (!row || typeof row !== "object") return false;
  if (row.eliminado === true) return false;
  if (String(row.estado || "").trim().toUpperCase() === "ANULADO") return false;
  return row.activo !== false;
}

function hlgSolapaMes(row, rango) {
  if (!hlgCuentaOperativa(row)) return false;
  const fi = hldHlgFechaInicioYmd(row) || String(row.fecha_inicio || "").slice(0, 10);
  const ff = hldHlgFechaFinYmd(row);
  if (fi && fi > rango.ultimoDia) return false;
  if (ff && ff < rango.primerDia) return false;
  return Boolean(fi);
}

/**
 * 1 tramo por HLg que solapa el mes (titular: calendario separado por tramo).
 * @param {Array<Record<string, unknown>>} hlgRows
 * @param {number} anio
 * @param {number} mes
 */
export function hlgSegmentosTitularMes(hlgRows, anio, mes) {
  const rango = rangoMes(anio, mes);
  const out = [];

  for (const row of hlgRows || []) {
    const hlgId = String(row.id || row.hlg_id || "").trim();
    const personaId = String(row.persona_id || "").trim();
    const gdt = String(row.grupo_de_trabajo_id || row.grupo_trabajo_id || "").trim();
    if (!hlgId || !personaId || !gdt) continue;
    if (!hlgSolapaMes(row, rango)) continue;

    const fi = hldHlgFechaInicioYmd(row) || String(row.fecha_inicio || "").slice(0, 10);
    const ffRaw = hldHlgFechaFinYmd(row);
    const ff = ffRaw || rango.ultimoDia;

    out.push({
      fila_id: filaKeyAg({ persona_id: personaId, hlg_id: hlgId }),
      calendario_id: filaKeyAg({ persona_id: personaId, hlg_id: hlgId }),
      hlg_id: hlgId,
      persona_id: personaId,
      grupo_de_trabajo_id: gdt,
      regimen_horario_id: row.regimen_horario_id || null,
      vigente_desde: maxYmd(fi, rango.primerDia),
      vigente_hasta: minYmd(ff, rango.ultimoDia),
    });
  }

  out.sort((a, b) => {
    const g = String(a.grupo_de_trabajo_id || "").localeCompare(String(b.grupo_de_trabajo_id || ""), "es");
    if (g !== 0) return g;
    return String(a.vigente_desde || "").localeCompare(String(b.vigente_desde || ""), "es");
  });

  return out;
}
