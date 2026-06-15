/**
 * Presentación de `analitica_cumplimiento` (v1) en grilla — sin horas crudas en copy jefe.
 */

/**
 * @param {Record<string, unknown> | null | undefined} celdaVis
 */
export function analiticaCumplimientoDesdeCelda(celdaVis) {
  const raw = celdaVis?.analitica_cumplimiento;
  if (!raw || typeof raw !== "object") return null;
  return /** @type {Record<string, unknown>} */ (raw);
}

/**
 * @param {number} minutos
 */
export function formatearMinutosJornada(minutos) {
  const m = Math.max(0, Math.trunc(Number(minutos) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

/**
 * Micro-copy para celda (▲ / ▼ / déficit).
 *
 * @param {Record<string, unknown> | null} analitica
 */
export function microBadgesAnalitica(analitica) {
  if (!analitica) {
    return { disciplina: null, debito: null, titleDisciplina: null, titleDebito: null };
  }
  const disciplina = analitica.disciplina && typeof analitica.disciplina === "object"
    ? analitica.disciplina
    : {};
  const debito = analitica.debito_tiempo && typeof analitica.debito_tiempo === "object"
    ? analitica.debito_tiempo
    : {};

  let disciplinaLabel = null;
  let titleDisciplina = null;
  if (disciplina.fuera_de_margen === true) {
    const tard = Number(disciplina.tardanza_minutos) || 0;
    const sal = Number(disciplina.salida_anticipada_minutos) || 0;
    if (tard > 0) {
      disciplinaLabel = `▲ ${tard}m`;
      titleDisciplina = `Tardanza respecto al horario nominal: ${tard} min`;
    } else if (sal > 0) {
      disciplinaLabel = `▼ ${sal}m`;
      titleDisciplina = `Salida anticipada respecto al margen: ${sal} min`;
    } else {
      disciplinaLabel = "!";
      titleDisciplina = "Ingreso o egreso fuera del margen horario";
    }
  }

  let debitoLabel = null;
  let titleDebito = null;
  if (debito.incumplimiento_carga_horaria === true) {
    const def = Number(debito.deficit_minutos) || 0;
    debitoLabel = def > 0 ? `-${def}m` : "⏳";
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    titleDebito = `Déficit contractual: ${def} min (supera tolerancia de cortesía de ${tol} min)`;
  }

  return { disciplina: disciplinaLabel, debito: debitoLabel, titleDisciplina, titleDebito };
}

/**
 * @param {Record<string, unknown> | null} analitica
 */
export function analiticaTieneContenidoVisible(analitica) {
  if (!analitica) return false;
  if (analitica.fichada_fuera_turno_teorico === true) return true;
  const { disciplina, debito } = microBadgesAnalitica(analitica);
  if (disciplina || debito) return true;
  if (analitica.ausencia_automatica === true) return true;
  const alertas = analitica.alertas_activas;
  return Array.isArray(alertas) && alertas.length > 0;
}

/**
 * Tarjetas en lenguaje administrativo (jefe / GSO).
 *
 * @param {Record<string, unknown> | null} analitica
 */
export function tarjetasAuditoriaCumplimientoJefe(analitica) {
  if (!analitica) return { disciplina: null, debito: null, ausencia: null, fueraTurno: null };

  if (analitica.fichada_fuera_turno_teorico === true) {
    const turno = String(analitica.fichada_fuera_turno_detalle?.turno_teorico_id || "").trim();
    const suf = turno ? ` (turno ${turno})` : "";
    return {
      disciplina: null,
      debito: null,
      ausencia: null,
      fueraTurno:
        `Fichada fuera del turno teórico asignado${suf}. Las marcas no coinciden con la jornada planificada; revisar plan u override antes de evaluar débito.`,
    };
  }

  const disciplina = analitica.disciplina && typeof analitica.disciplina === "object"
    ? analitica.disciplina
    : {};
  const debito = analitica.debito_tiempo && typeof analitica.debito_tiempo === "object"
    ? analitica.debito_tiempo
    : {};

  let tarjetaDisciplina = null;
  if (disciplina.fuera_de_margen === true) {
    const tard = Number(disciplina.tardanza_minutos) || 0;
    const sal = Number(disciplina.salida_anticipada_minutos) || 0;
    if (tard > 0) {
      tarjetaDisciplina =
        `Estado de ingreso/egreso: fuera del margen establecido. Tardanza registrada de ${tard} minutos respecto al horario nominal.`;
    } else if (sal > 0) {
      tarjetaDisciplina =
        `Estado de ingreso/egreso: fuera del margen establecido. Salida anticipada de ${sal} minutos respecto al límite con gracia.`;
    } else {
      tarjetaDisciplina =
        "Estado de ingreso/egreso: fuera del margen horario establecido para el turno.";
    }
  }

  let tarjetaDebito = null;
  if (debito.incumplimiento_carga_horaria === true) {
    const teor = formatearMinutosJornada(debito.carga_teorica_minutos);
    const real = formatearMinutosJornada(debito.carga_real_minutos);
    const def = Number(debito.deficit_minutos) || 0;
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    tarjetaDebito =
      `Cumplimiento del contrato: incumplimiento detectado. Carga teórica: ${teor} | Realizada: ${real}. Déficit neto: ${def} minutos (supera la tolerancia de cortesía de ${tol} min).`;
  }

  let ausencia = null;
  if (analitica.ausencia_automatica === true) {
    ausencia =
      "Ausencia automática: sin fichadas registradas y transcurrida la ventana institucional de espera.";
  }

  return { disciplina: tarjetaDisciplina, debito: tarjetaDebito, ausencia, fueraTurno: null };
}

/**
 * Líneas numéricas para RRHH (junto a marcas crudas).
 *
 * @param {Record<string, unknown> | null} analitica
 */
export function lineasAuditoriaCumplimientoRrhh(analitica, ctx = {}) {
  if (!analitica) return [];
  if (analitica.fichada_fuera_turno_teorico === true) {
    const turno = String(
      analitica.fichada_fuera_turno_detalle?.turno_teorico_id || ctx.turnoTeoricoId || "",
    ).trim();
    const horario = String(ctx.horarioTeorico || "").trim();
    const marcas = String(ctx.horarioFichada || "").trim();
    const partes = [
      "Fichada fuera del turno teórico",
      turno ? `turno ${turno}` : "",
      horario ? `teoría ${horario}` : "",
      marcas ? `marcas ${marcas}` : "",
    ].filter(Boolean);
    const solape = Number(analitica.fichada_fuera_turno_detalle?.solape_minutos);
    const det =
      Number.isFinite(solape) && solape >= 0
        ? ` Solape con ventana teórica: ${solape} min — débito/disciplina suspendidos.`
        : " Débito/disciplina suspendidos — revisar plan u override.";
    return [`${partes.join(" · ")}.${det}`];
  }
  const disciplina = analitica.disciplina && typeof analitica.disciplina === "object"
    ? analitica.disciplina
    : {};
  const debito = analitica.debito_tiempo && typeof analitica.debito_tiempo === "object"
    ? analitica.debito_tiempo
    : {};
  const out = [];
  if (disciplina.fuera_de_margen === true) {
    const tard = Number(disciplina.tardanza_minutos) || 0;
    const sal = Number(disciplina.salida_anticipada_minutos) || 0;
    if (tard > 0) out.push(`Disciplina: fuera de margen — tardanza ${tard} min (desde nominal).`);
    else if (sal > 0) out.push(`Disciplina: fuera de margen — salida anticipada ${sal} min.`);
    else out.push("Disciplina: fuera de margen horario.");
  }
  if (debito.incumplimiento_carga_horaria === true) {
    const def = Number(debito.deficit_minutos) || 0;
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    out.push(
      `Débito de tiempo: déficit ${def} min (teórica ${formatearMinutosJornada(debito.carga_teorica_minutos)}, real ${formatearMinutosJornada(debito.carga_real_minutos)}; tolerancia ${tol} min).`,
    );
  }
  if (analitica.ausencia_automatica === true) {
    out.push("Ausencia automática activa.");
  }
  return out;
}
