/**
 * Presentación de `analitica_cumplimiento` (v1) en grilla — sin horas crudas en copy jefe.
 */

import { disciplinaHorariaIncumplimientoDesdeAnalitica } from "../../../../shared/utils/calcularDeltasCumplimiento.js";
import { isoToHhmmInstitucional } from "../../../../shared/utils/horarioInstitucionalDisplay.js";

/**
 * @param {string|null|undefined} iso
 */
function hmDesdeIsoAnalitica(iso) {
  return isoToHhmmInstitucional(iso) || "—";
}

/**
 * @param {string|null|undefined} isoA
 * @param {string|null|undefined} isoB
 */
function diffMinutosEntreIso(isoA, isoB) {
  const a = new Date(String(isoA || "")).getTime();
  const b = new Date(String(isoB || "")).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(Math.abs(b - a) / 60_000);
}

/**
 * Márgenes de tolerancia materializados (turno + régimen) persistidos en analítica.
 *
 * @param {Record<string, unknown> | null | undefined} analitica
 */
export function lineasMargenToleranciaRegimenDesdeAnalitica(analitica) {
  const d = analitica?.disciplina;
  const deb = analitica?.debito_tiempo;
  if (!d || typeof d !== "object") return [];

  const lines = [];

  const tolIn = diffMinutosEntreIso(d.ingreso_nominal_iso, d.ingreso_limite_con_gracia_iso);
  const nomIn = hmDesdeIsoAnalitica(d.ingreso_nominal_iso);
  const limIn = hmDesdeIsoAnalitica(d.ingreso_limite_con_gracia_iso);
  if (d.ingreso_nominal_iso || d.ingreso_limite_con_gracia_iso) {
    if (tolIn != null && tolIn > 0) {
      lines.push(
        `Ingreso: margen de cortesía ${tolIn} min (válido hasta ${limIn}; nominal ${nomIn}).`,
      );
    } else {
      lines.push(`Ingreso: nominal ${nomIn} (sin margen posterior en régimen/turno).`);
    }
  }

  const tolOut = diffMinutosEntreIso(d.egreso_limite_con_gracia_iso, d.egreso_nominal_iso);
  const nomOut = hmDesdeIsoAnalitica(d.egreso_nominal_iso);
  const limOut = hmDesdeIsoAnalitica(d.egreso_limite_con_gracia_iso);
  if (d.egreso_nominal_iso || d.egreso_limite_con_gracia_iso) {
    if (tolOut != null && tolOut > 0) {
      lines.push(
        `Egreso: margen de cortesía ${tolOut} min (válido desde ${limOut}; nominal ${nomOut}).`,
      );
    } else {
      lines.push(`Egreso: nominal ${nomOut} (sin margen anterior en régimen/turno).`);
    }
  }

  if (deb && Number.isFinite(Number(deb.tolerancia_debitohorario_minutos))) {
    lines.push(
      `Carga horaria: tolerancia de débito del régimen ${deb.tolerancia_debitohorario_minutos} min.`,
    );
  }

  return lines;
}

/** @deprecated alias — usar lineasMargenToleranciaRegimenDesdeAnalitica */
export function toleranciasTextoDesdeAnalitica(analitica) {
  return lineasMargenToleranciaRegimenDesdeAnalitica(analitica);
}

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
 * Minutos de horas extra ya autorizadas (pedido aprobado) persistidos en celda.
 * Hasta que el flujo de trámite escriba el campo, devuelve 0.
 *
 * @param {Record<string, unknown> | null | undefined} celdaVis
 */
export function minutosHorasExtrasAutorizadasDesdeCelda(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return 0;
  const raw =
    celdaVis.horas_extra_autorizadas_min ??
    celdaVis.horas_extras_autorizadas_min ??
    celdaVis.minutos_horas_extra_autorizadas;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * Badge de celda para incumplimiento horario (tardanza o salida anticipada punitiva).
 * @param {number} minutos
 */
export function labelBadgeIncumplimientoDisciplina(minutos) {
  const m = Math.trunc(Number(minutos) || 0);
  if (m <= 0) return null;
  return `▼ ${m}m`;
}

/**
 * Badges ▼ por tramo teórico (M+N, etc.): un resultado por segmento, sin sumar en celda.
 *
 * @param {Record<string, unknown> | null | undefined} analitica
 * @returns {Array<{ label: string, title: string }> | null}
 */
export function listaBadgesIncumplimientoPorSegmentoCelda(analitica) {
  if (!analitica || analitica.calculo_por_segmentos !== true) return null;
  const segs = analitica.segmentos_cumplimiento;
  if (!Array.isArray(segs) || segs.length < 2) return null;
  /** @type {Array<{ label: string, title: string }>} */
  const items = [];
  for (const seg of segs) {
    if (!seg || typeof seg !== "object") continue;
    const m = Math.trunc(Number(seg.incumplimiento_celda_minutos) || 0);
    if (m <= 0) continue;
    const label = labelBadgeIncumplimientoDisciplina(m);
    if (!label) continue;
    const id = String(seg.segmento_id || "").trim();
    const pref = id ? `Tramo ${id}` : "Tramo teórico";
    const tipo = String(seg.incumplimiento_celda_tipo || "");
    let title = `${pref}: incumplimiento ${m} min`;
    if (tipo === "ausente_tramo") title = `${pref}: sin fichada (${m} min de jornada teórica)`;
    else if (tipo === "tardanza") title = `${pref}: ingreso tardío ${m} min`;
    else if (tipo === "salida") title = `${pref}: salida anticipada ${m} min`;
    items.push({ label, title });
  }
  return items.length ? items : null;
}

/**
 * Incumplimiento horario prioritario para celda RRHH (no incluye ingreso anticipado).
 *
 * @param {Record<string, unknown>} disciplina
 */
export function badgeIncumplimientoHorarioRrhh(disciplina, debito) {
  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica({
    disciplina,
    debito_tiempo: debito,
  });
  const tard = inc.tardanza_punitiva_min;
  const sal = inc.salida_anticipada_punitiva_min;

  if (sal > 0) {
    return {
      label: labelBadgeIncumplimientoDisciplina(sal),
      title: `Salida anticipada: ${sal} min respecto al horario teórico de egreso`,
    };
  }
  if (tard > 0) {
    return {
      label: labelBadgeIncumplimientoDisciplina(tard),
      title: `Ingreso tardío: ${tard} min respecto al horario teórico de ingreso`,
    };
  }
  return { label: null, title: null };
}

/**
 * Micro-copy celda RRHH: incumplimiento (▼ / déficit) y, si hay trámite, horas extra (+).
 *
 * @param {Record<string, unknown> | null} analitica
 * @param {Record<string, unknown> | null | undefined} [celdaVis]
 */
export function microBadgesAnaliticaRrhh(analitica, celdaVis) {
  const vacio = {
    disciplina: null,
    disciplinaLista: null,
    debito: null,
    extras: null,
    titleDisciplina: null,
    titleDebito: null,
    titleExtras: null,
  };
  if (!analitica) return vacio;

  if (analitica.fichada_fuera_turno_teorico === true) {
    return {
      ...vacio,
      disciplina: "!",
      titleDisciplina: "Fichada fuera del turno teórico — revisar antes de liquidar",
    };
  }

  const porSegmento = listaBadgesIncumplimientoPorSegmentoCelda(analitica);
  if (porSegmento?.length) {
    const minExtras = minutosHorasExtrasAutorizadasDesdeCelda(celdaVis);
    let extrasLabel = null;
    let titleExtras = null;
    if (minExtras > 0) {
      extrasLabel = `+${minExtras}m`;
      titleExtras = `Horas extra autorizadas: ${minExtras} min`;
    }
    return {
      disciplina: null,
      disciplinaLista: porSegmento,
      debito: null,
      extras: extrasLabel,
      titleDisciplina: null,
      titleDebito: null,
      titleExtras,
    };
  }

  const disciplina =
    analitica.disciplina && typeof analitica.disciplina === "object" ? analitica.disciplina : {};
  const debito =
    analitica.debito_tiempo && typeof analitica.debito_tiempo === "object" ? analitica.debito_tiempo : {};

  const incDisc = disciplinaHorariaIncumplimientoDesdeAnalitica(analitica);
  const inc = badgeIncumplimientoHorarioRrhh(disciplina, debito);

  let debitoLabel = null;
  let titleDebito = null;
  if (debito.incumplimiento_carga_horaria === true && !incDisc.hay_incumplimiento) {
    const def = Number(debito.deficit_minutos) || 0;
    debitoLabel = def > 0 ? `-${def}m` : "⏳";
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    titleDebito = `Déficit de carga horaria: ${def} min (supera tolerancia de ${tol} min)`;
  }

  const minExtras = minutosHorasExtrasAutorizadasDesdeCelda(celdaVis);
  let extrasLabel = null;
  let titleExtras = null;
  if (minExtras > 0) {
    extrasLabel = `+${minExtras}m`;
    titleExtras = `Horas extra autorizadas: ${minExtras} min`;
  }

  if (analitica.ausencia_automatica === true && !inc.label && !debitoLabel) {
    return {
      ...vacio,
      disciplina: "A",
      titleDisciplina: "Ausencia automática sin marcas",
    };
  }

  return {
    disciplina: inc.label,
    disciplinaLista: null,
    debito: debitoLabel,
    extras: extrasLabel,
    titleDisciplina: inc.title,
    titleDebito,
    titleExtras,
  };
}

/**
 * Micro-copy para celda (▼ incumplimiento / déficit).
 *
 * @param {Record<string, unknown> | null} analitica
 * @param {{ modoRrhh?: boolean; celdaVis?: Record<string, unknown> | null }} [opts]
 */
export function microBadgesAnalitica(analitica, opts = {}) {
  if (opts.modoRrhh) {
    return microBadgesAnaliticaRrhh(analitica, opts.celdaVis);
  }
  if (!analitica) {
    return { disciplina: null, disciplinaLista: null, debito: null, titleDisciplina: null, titleDebito: null };
  }
  const porSegmento = listaBadgesIncumplimientoPorSegmentoCelda(analitica);
  if (porSegmento?.length) {
    return {
      disciplina: null,
      disciplinaLista: porSegmento,
      debito: null,
      titleDisciplina: null,
      titleDebito: null,
    };
  }
  const disciplina = analitica.disciplina && typeof analitica.disciplina === "object"
    ? analitica.disciplina
    : {};
  const debito = analitica.debito_tiempo && typeof analitica.debito_tiempo === "object"
    ? analitica.debito_tiempo
    : {};

  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica(analitica);
  let disciplinaLabel = null;
  let titleDisciplina = null;
  if (inc.salida_anticipada_punitiva_min > 0) {
    disciplinaLabel = labelBadgeIncumplimientoDisciplina(inc.salida_anticipada_punitiva_min);
    titleDisciplina = `Salida anticipada respecto al horario nominal: ${inc.salida_anticipada_punitiva_min} min`;
  } else if (inc.tardanza_punitiva_min > 0) {
    disciplinaLabel = labelBadgeIncumplimientoDisciplina(inc.tardanza_punitiva_min);
    titleDisciplina = `Tardanza respecto al horario nominal: ${inc.tardanza_punitiva_min} min`;
  }

  let debitoLabel = null;
  let titleDebito = null;
  if (debito.incumplimiento_carga_horaria === true && !inc.hay_incumplimiento) {
    const def = Number(debito.deficit_minutos) || 0;
    debitoLabel = def > 0 ? `-${def}m` : "⏳";
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    titleDebito = `Déficit contractual: ${def} min (supera tolerancia de cortesía de ${tol} min)`;
  }

  return { disciplina: disciplinaLabel, disciplinaLista: null, debito: debitoLabel, titleDisciplina, titleDebito };
}

/**
 * @param {Record<string, unknown> | null} analitica
 */
export function analiticaTieneContenidoVisible(analitica) {
  if (!analitica) return false;
  if (analitica.fichada_fuera_turno_teorico === true) return true;
  const { disciplina, debito } = microBadgesAnalitica(analitica);
  if (disciplina || debito) return true;
  if (listaBadgesIncumplimientoPorSegmentoCelda(analitica)?.length) return true;
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

  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica(analitica);
  let tarjetaDisciplina = null;
  if (inc.tardanza_punitiva_min > 0) {
    tarjetaDisciplina =
      `Estado de ingreso/egreso: fuera del margen establecido. Tardanza registrada de ${inc.tardanza_punitiva_min} minutos respecto al horario nominal.`;
  } else if (inc.salida_anticipada_punitiva_min > 0) {
    tarjetaDisciplina =
      `Estado de ingreso/egreso: fuera del margen establecido. Salida anticipada de ${inc.salida_anticipada_punitiva_min} minutos respecto al horario nominal.`;
  }

  let tarjetaDebito = null;
  if (debito.incumplimiento_carga_horaria === true) {
    const teor = formatearMinutosJornada(debito.carga_teorica_minutos);
    const real = formatearMinutosJornada(debito.carga_real_minutos);
    const def = formatearMinutosJornada(debito.deficit_minutos);
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    tarjetaDebito =
      `Cumplimiento del contrato: incumplimiento detectado. Carga teórica: ${teor} | Realizada: ${real}. Déficit neto: ${def} (supera la tolerancia de cortesía de ${tol} min).`;
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
  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica(analitica);
  if (inc.tardanza_punitiva_min > 0) {
    out.push(`Disciplina: fuera de margen — tardanza ${inc.tardanza_punitiva_min} min (desde nominal).`);
  }
  if (inc.salida_anticipada_punitiva_min > 0) {
    out.push(
      `Disciplina: fuera de margen — salida anticipada ${inc.salida_anticipada_punitiva_min} min (desde nominal).`,
    );
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

/**
 * Resumen disciplina RRHH: comparación explícita teoría vs real (ingreso / egreso).
 *
 * @param {Record<string, unknown> | null} analitica
 * @param {{ presencia?: 'presente'|'ausente'|null; celdaVis?: Record<string, unknown> | null }} [ctx]
 */
export function lineasDisciplinaTeoriaVsRealRrhh(analitica, ctx = {}) {
  const presencia = ctx.presencia;
  const minExtras = minutosHorasExtrasAutorizadasDesdeCelda(ctx.celdaVis);

  if (!analitica || typeof analitica !== "object") {
    if (presencia === "ausente") {
      return ["Ausente: sin fichadas de ingreso/egreso registradas en el día."];
    }
    return ["Sin evaluación de cumplimiento persistida para este día."];
  }

  if (analitica.fichada_fuera_turno_teorico === true) {
    return [
      "Las marcas no coinciden con la ventana del turno teórico; no se comparan ingreso/egreso hasta alinear plan u override.",
    ];
  }

  const disciplina =
    analitica.disciplina && typeof analitica.disciplina === "object" ? analitica.disciplina : {};
  const debito =
    analitica.debito_tiempo && typeof analitica.debito_tiempo === "object" ? analitica.debito_tiempo : {};

  /** @type {string[]} */
  const out = [];

  const ingAnt = Number(disciplina.ingreso_anticipado_minutos) || 0;
  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica(analitica);

  // RRHH prioriza "salida anticipada" si aplica, evitando duplicar el mismo desvío con el débito/carga horaria.
  if (inc.salida_anticipada_punitiva_min > 0) {
    out.push(
      `Salida anticipada: ${inc.salida_anticipada_punitiva_min} min (horario teórico de egreso vs fichada real).`,
    );
  } else if (inc.tardanza_punitiva_min > 0) {
    out.push(
      `Ingreso tardío: ${inc.tardanza_punitiva_min} min (horario teórico de ingreso vs fichada real).`,
    );
  }

  const hayIncumplimientoDisciplinarioPunitivo =
    inc.salida_anticipada_punitiva_min > 0 || inc.tardanza_punitiva_min > 0;

  if (Array.isArray(analitica.segmentos_cumplimiento)) {
    for (const seg of analitica.segmentos_cumplimiento) {
      if (!seg || seg.cubierto === true) continue;
      const carga = Number(seg.carga_teorica_minutos) || 0;
      const id = String(seg.segmento_id || "").trim();
      const etiqueta = id ? `tramo ${id}` : "tramo teórico";
      out.push(
        carga > 0
          ? `Sin fichada en ${etiqueta} (${carga} min de jornada teórica sin cubrir).`
          : `Sin fichada en ${etiqueta}.`,
      );
    }
  }

  if (ingAnt > 0 && minExtras > 0) {
    const cubierto = Math.min(ingAnt, minExtras);
    out.push(
      `Horas extra autorizadas: ${minExtras} min (cubre ${cubierto} min de ingreso anticipado).`,
    );
  } else if (ingAnt > 0 && minExtras === 0) {
    /* Ingreso anticipado sin trámite: no es incumplimiento visible en RRHH */
  }

  if (analitica.ausencia_automatica === true) {
    out.push("Ausencia automática: sin marcas tras la ventana institucional de espera.");
  } else if (presencia === "ausente" && out.length === 0) {
    out.push("Ausente: sin fichadas de ingreso/egreso registradas en el día.");
  }

  if (
    debito.incumplimiento_carga_horaria === true
    && (!hayIncumplimientoDisciplinarioPunitivo || analitica.calculo_por_segmentos === true)
  ) {
    const def = Number(debito.deficit_minutos) || 0;
    const tol = Number(debito.tolerancia_debitohorario_minutos) || 0;
    const horas = Math.floor(def / 60);
    const resto = def % 60;
    const legible =
      horas > 0 && resto > 0
        ? `${def} min (${horas} h ${resto} min)`
        : horas > 0
          ? `${def} min (${horas} h)`
          : `${def} min`;
    out.push(
      `Carga horaria: déficit de ${legible} respecto a la jornada teórica (tolerancia de débito ${tol} min).`,
    );
  }

  if (out.length === 0) {
    if (minExtras > 0) {
      out.push(`Horas extra autorizadas: ${minExtras} min.`);
    } else {
      out.push("Sin incumplimiento de horario ni déficit de carga registrado.");
    }
  } else if (minExtras > 0 && ingAnt === 0) {
    out.push(`Horas extra autorizadas: ${minExtras} min.`);
  }

  return out;
}

/**
 * @param {boolean} mostrarFichada
 * @param {Record<string, unknown> | null | undefined} celdaVis
 * @param {{ capa_teorica?: Record<string, unknown> } | null} [turnoTeorico]
 */
export function debeMostrarAuditoriaCumplimientoRrhh(mostrarFichada, celdaVis, turnoTeorico) {
  if (!mostrarFichada) return false;
  if (celdaVis && typeof celdaVis === "object") return true;
  return Boolean(turnoTeorico?.capa_teorica || turnoTeorico?.rda_turno_id);
}
