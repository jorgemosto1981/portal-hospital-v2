/**
 * Utilidades de grilla mensual según tipo_patron del régimen.
 * Plan mensual (planificado): el jefe arma la grilla manualmente.
 * Fijo / rotativo: turnos derivados del régimen — solo lectura en el editor mensual.
 */

function isoWeekdayFromYmd(ymd) {
  const date = new Date(ymd + "T12:00:00");
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function celdaDesdeRegimenFijo(regimen, ymd) {
  const isoWeekday = isoWeekdayFromYmd(ymd);
  const diaConf = (regimen.dias || []).find((d) => d.dia_semana === isoWeekday);
  if (!diaConf || (diaConf.tipo_dia !== "laborable" && diaConf.tipo_dia !== "guardia")) {
    return { tipo_dia: "franco", turno_id: null };
  }
  const turno = diaConf.turno || {};
  return {
    tipo_dia: diaConf.tipo_dia || "laborable",
    turno_id: turno.turno_id || null,
  };
}

function celdaDesdeRegimenRotativo(regimen, ymd, fechaAncla) {
  if (!fechaAncla || !regimen?.ciclo?.length) {
    return { tipo_dia: "franco", turno_id: null };
  }
  const ancla = new Date(fechaAncla + "T12:00:00");
  const fecha = new Date(ymd + "T12:00:00");
  const diff = Math.round((fecha.getTime() - ancla.getTime()) / 86400000);
  const cicloTotal = regimen.ciclo_total || regimen.ciclo.length;
  const posRaw = ((diff % cicloTotal) + cicloTotal) % cicloTotal;
  const posicion = posRaw + 1;
  const posConf = regimen.ciclo.find((p) => p.posicion === posicion);
  if (!posConf || (posConf.tipo_dia !== "laborable" && posConf.tipo_dia !== "guardia")) {
    return { tipo_dia: "franco", turno_id: null };
  }
  const turno = posConf.turno || {};
  return {
    tipo_dia: posConf.tipo_dia || "laborable",
    turno_id: turno.turno_id || null,
  };
}

/**
 * @param {object} regimen - cfg_regimen_horario
 * @param {Array<{ ymd: string }>} dias
 * @param {{ regimen_fecha_ancla?: string|null }} hlgMeta
 */
export function generarGrillaDesdeRegimen(regimen, dias, hlgMeta = {}) {
  const row = {};
  const tipo = regimen?.tipo_patron || "";
  for (const dia of dias) {
    if (tipo === "fijo") {
      row[dia.ymd] = celdaDesdeRegimenFijo(regimen, dia.ymd);
    } else if (tipo === "rotativo") {
      row[dia.ymd] = celdaDesdeRegimenRotativo(regimen, dia.ymd, hlgMeta.regimen_fecha_ancla);
    } else {
      row[dia.ymd] = { tipo_dia: "franco", turno_id: null };
    }
  }
  return row;
}

export function esRegimenPlanificado(regimen) {
  return regimen?.tipo_patron === "planificado";
}

export function esRegimenDerivado(regimen) {
  const t = regimen?.tipo_patron;
  return t === "fijo" || t === "rotativo";
}

export function labelTipoRegimen(regimen) {
  if (regimen?.tipo_patron === "fijo") return "Fijo";
  if (regimen?.tipo_patron === "rotativo") return "Rotativo";
  if (regimen?.tipo_patron === "planificado") return "Planificado";
  return regimen?.tipo_patron || "—";
}
