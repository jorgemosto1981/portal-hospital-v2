import { columnasDesdeGrillaAprobada } from "./planGrillaAprobadaDisplay.js";

export const DIAS_SEMANA_CORTO = ["D", "L", "M", "X", "J", "V", "S"];

function diaNumeroDesdeClave(diaKey) {
  const m = /^(\d{4}-\d{2})-(\d{2})$/.exec(String(diaKey || ""));
  if (m) return Number(m[2]);
  const solo = Number(String(diaKey || "").replace(/\D/g, ""));
  return Number.isFinite(solo) ? solo : 0;
}

function ymdDesdeClave(diaKey, periodo) {
  const s = String(diaKey || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}$/.test(s) && periodo) {
    return `${periodo}-${s.padStart(2, "0")}`;
  }
  return s;
}

function celdaDiaAgente(ag, diaKey) {
  const dias = ag?.dias && typeof ag.dias === "object" ? ag.dias : {};
  if (dias[diaKey]) return dias[diaKey];
  const num = String(diaNumeroDesdeClave(diaKey)).padStart(2, "0");
  return dias[num] || null;
}

/**
 * @param {object|null|undefined} grillaAprobada
 * @returns {Array<{ diaKey: string, num: number, letra: string, esFinde: boolean, esFeriadoCol: boolean }>}
 */
export function columnasMetadataGrilla(grillaAprobada) {
  const periodo = grillaAprobada?.periodo || null;
  const diaKeys = columnasDesdeGrillaAprobada(grillaAprobada);

  return diaKeys.map((diaKey) => {
    const ymd = ymdDesdeClave(diaKey, periodo);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    const num = m ? Number(m[3]) : diaNumeroDesdeClave(diaKey);
    let letra = "—";
    let esFinde = false;
    if (m) {
      const ds = new Date(Number(m[1]), Number(m[2]) - 1, num).getDay();
      letra = DIAS_SEMANA_CORTO[ds] ?? "—";
      esFinde = ds === 0 || ds === 6;
    }
    let esFeriadoCol = false;
    for (const ag of grillaAprobada?.agentes || []) {
      const cel = celdaDiaAgente(ag, diaKey);
      if (cel?.es_feriado === true || cel?.tipo_evento_institucional === "feriado" || cel?.tipo_evento_institucional === "asueto") {
        esFeriadoCol = true;
        break;
      }
    }
    return { diaKey, num, letra, esFinde, esFeriadoCol };
  });
}
