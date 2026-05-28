/**
 * Etiqueta de celda para grilla de plan mensual (lectura): planificado + fijo/rotativo derivado.
 */
import {
  esRegimenDerivado,
  generarGrillaDesdeRegimen,
} from "../../pages/jefe/planes/planGrillaRegimenUtils.js";

function compactarHora(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  if (m[2] === "00") return m[1].padStart(2, "0");
  return s;
}

function horarioDesdeTurnoDef(turnoDef) {
  if (!turnoDef) return "";
  const ingreso = String(turnoDef.ingreso || turnoDef.hora_ingreso || "").trim();
  const egreso = String(turnoDef.egreso || turnoDef.hora_egreso || "").trim();
  if (ingreso && egreso) return `${compactarHora(ingreso)}-${compactarHora(egreso)}`;
  if (ingreso) return ingreso;
  if (egreso) return egreso;
  return "";
}

function turnoDefDesdeRegimen(regimen, turnoId) {
  if (!regimen || !turnoId) return null;
  const tid = String(turnoId).trim();
  return (regimen.turnos_disponibles || []).find(
    (t) => String(t?.turno_id || t?.id || "").trim() === tid,
  ) || null;
}

function celdaEfectiva({ celdaPlan, regimen, ymd, hlgMeta }) {
  if (!regimen || !ymd) return celdaPlan || null;
  if (esRegimenDerivado(regimen)) {
    const row = generarGrillaDesdeRegimen(regimen, [{ ymd }], hlgMeta || {});
    return row[ymd] || { tipo_dia: "franco", turno_id: null };
  }
  return celdaPlan || null;
}

/**
 * @returns {string} Texto para celda (ej. "M", "M 08-14", "F", "08-14")
 */
export function etiquetaCeldaPlanDisplay({ celdaPlan, regimen, ymd, hlgMeta }) {
  const cel = celdaEfectiva({ celdaPlan, regimen, ymd, hlgMeta });
  if (!cel) return "";
  const tipo = String(cel.tipo_dia || "").trim();
  if (tipo === "franco" || tipo === "no_laborable") return "F";
  const turnoId = String(cel.turno_id || "").trim();
  const turnoDef = turnoDefDesdeRegimen(regimen, turnoId);
  const horario = horarioDesdeTurnoDef(turnoDef);
  if (turnoId && horario) return `${turnoId} ${horario}`;
  if (turnoId) return turnoId;
  if (horario) return horario;
  return "";
}

export function claseCeldaPlanDisplay(celdaPlan, regimen, ymd, hlgMeta) {
  const cel = celdaEfectiva({ celdaPlan, regimen, ymd, hlgMeta });
  if (!cel) return "bg-white";
  if (cel.tipo_dia === "franco" || cel.tipo_dia === "no_laborable") return "bg-slate-100 text-slate-700";
  if (cel.turno_id) return "bg-emerald-50 text-emerald-900";
  return "bg-white";
}
