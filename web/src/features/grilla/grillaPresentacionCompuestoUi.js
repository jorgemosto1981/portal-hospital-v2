import {
  filasPresentacionCompuestoDesdeCelda,
  filtrarFilasPresentacionAlTeoricoOperativo,
  leerPresentacionCompuestoDesdeCelda,
} from "../../../../shared/utils/visCeldaFusionLectura.js";
import {
  badgesDisciplinaDesdeSegmentoAnalitica,
  disciplinaHorariaIncumplimientoDesdeAnalitica,
  labelBadgeDisciplinaMinutosCelda,
} from "../../../../shared/utils/calcularDeltasCumplimiento.js";
import { parseFichadasRealesCelda, marcasHhmmDesdeItemFichada } from "../../../../shared/utils/grillaFichadaPresencia.js";
import {
  analiticaCumplimientoDesdeCelda,
  badgeIncumplimientoHorarioRrhh,
} from "./grillaAnaliticaCumplimientoUi.js";

/**
 * UI para presentación de turnos compuestos (pisos M/T/N materializados).
 *
 * Filosofía de empareje: el worker materializa `presentacion_compuesto.filas`.
 * La UI confía en esa estructura, estados y orden. Repartir marcas crudas es fallback;
 * preferir datos ya procesados en backend. Si hay que repartir manualmente, usar
 * propiedades estructurales (`orden`, `length`) en lugar de IDs literales de segmento.
 */

export { filasPresentacionCompuestoDesdeCelda, leerPresentacionCompuestoDesdeCelda };

/** @param {Array<Record<string, unknown>>|null|undefined} filas */
export function esMatrizPresentacionCompuesta(filas) {
  return Array.isArray(filas) && filas.length >= 2;
}

/** Celda con al menos un piso M/T/N (compuesto o turno simple). */
export function esPresentacionPorPisos(filas) {
  return Array.isArray(filas) && filas.length >= 1;
}

/** @param {Record<string, unknown>} fila */
export function esPisoPresentacionAusente(fila) {
  return filaTramoAusente(fila);
}

/** @param {Record<string, unknown>} fila */
function filaTramoAusente(fila) {
  const estado = String(fila.estado_tramo || "").trim();
  const badge = String(fila.badge_label || "").trim();
  const badgeTipo = String(fila.badge_tipo || "").trim();
  return estado === "ausente" || badge === "AUSENTE" || badgeTipo === "ausente_tramo";
}

/** @param {Record<string, unknown>} fila */
function filaTramoActivo(fila) {
  return !filaTramoAusente(fila);
}

/** @param {Record<string, unknown>} item @param {string[]} marcas */
function fichadaItemCruzaMedianoche(item, marcas) {
  const fy = String(item.fecha_ymd || item.fecha || "").trim();
  const fe = String(item.fecha_egreso_ymd || "").trim();
  if (fe && fy && fe > fy) return true;
  if (marcas.length >= 2) {
    const ingR = minutosDesdeHhmmInstitucional(marcas[0]);
    const egrR = minutosDesdeHhmmInstitucional(marcas[marcas.length - 1]);
    if (Number.isFinite(ingR) && Number.isFinite(egrR) && egrR < ingR) return true;
  }
  return false;
}

/** @param {Array<Record<string, unknown>>} filas */
function esMatrizMtnOrdenada(filas) {
  if (!Array.isArray(filas) || filas.length !== 3) return false;
  const ids = filas.map((f) => String(f.segmento_id || "").trim().toUpperCase());
  return ids[0] === "M" && ids[1] === "T" && ids[2] === "N";
}

/**
 * Empareja cada fichada con M, T o N por hora de ingreso (no por orden en `fichadas_reales`).
 * @param {Array<Record<string, unknown>>} fichadas
 * @returns {Map<string, number>}
 */
function mapSegmentoMtnAIndiceFichada(fichadas) {
  /** @type {Map<string, number>} */
  const out = new Map();
  const used = new Set();

  const items = fichadas.map((item, index) => {
    const marcas = marcasHhmmDesdeItemFichada(item);
    const cruza = fichadaItemCruzaMedianoche(item, marcas);
    const ingMin = minutosDesdeHhmmInstitucional(marcas[0]);
    let franja = "T";
    if (cruza) franja = "N";
    else if (Number.isFinite(ingMin)) {
      if (ingMin < 14 * 60) franja = "M";
      else if (ingMin < 20 * 60) franja = "T";
      else franja = "N";
    }
    return { index, cruza, franja };
  });

  const take = (seg, pred) => {
    if (out.has(seg)) return;
    const hit = items.find((x) => !used.has(x.index) && pred(x));
    if (!hit) return;
    out.set(seg, hit.index);
    used.add(hit.index);
  };

  take("N", (x) => x.cruza);
  take("M", (x) => x.franja === "M");
  take("T", (x) => x.franja === "T");
  take("N", (x) => x.franja === "N");
  for (const x of items) {
    if (used.has(x.index)) continue;
    if (!out.has("T")) {
      out.set("T", x.index);
      used.add(x.index);
    } else if (!out.has("N")) {
      out.set("N", x.index);
      used.add(x.index);
    } else if (!out.has("M")) {
      out.set("M", x.index);
      used.add(x.index);
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {Record<string, unknown>} fila
 * @param {Array<Record<string, unknown>>} todasFilas
 */
export function marcasHhmmPorTramoDesdeCelda(celda, fila, todasFilas) {
  const fichadas = parseFichadasRealesCelda(celda);
  const seg = String(fila.segmento_id || "").trim();
  const total = todasFilas.length;
  const orden = Number.isFinite(Number(fila.orden)) ? Number(fila.orden) : 0;

  if (
    fichadas.length === 3
    && total === 3
    && esMatrizMtnOrdenada(todasFilas)
  ) {
    const map = mapSegmentoMtnAIndiceFichada(fichadas);
    const idx = map.get(seg.toUpperCase());
    if (idx != null && fichadas[idx]) {
      return marcasHhmmDesdeItemFichada(fichadas[idx]);
    }
    return [];
  }

  if (fichadas.length === total && total >= 2 && fichadas[orden]) {
    return marcasHhmmDesdeItemFichada(fichadas[orden]);
  }

  if (filaTramoAusente(fila)) {
    if (!fichadas.length) {
      const { ingreso, egreso } = parseRangoHhmmLabel(fila.fichada_label);
      return [ingreso, egreso].filter(Boolean);
    }
    return [];
  }

  if (!fichadas.length) {
    const { ingreso, egreso } = parseRangoHhmmLabel(fila.fichada_label);
    return [ingreso, egreso].filter(Boolean);
  }

  const primero = orden === 0;
  const ultimo = orden >= total - 1;

  if (total === 1) {
    if (fichadas.length >= 2) {
      const flat = [];
      for (const item of fichadas) flat.push(...marcasHhmmDesdeItemFichada(item));
      return [...new Set(flat.filter(Boolean))];
    }
    return marcasHhmmDesdeItemFichada(fichadas[0]);
  }

  if (fichadas.length === 2 && total === 3) {
    if (primero) return marcasHhmmDesdeItemFichada(fichadas[0]);
    if (ultimo) return marcasHhmmDesdeItemFichada(fichadas[1]);
    return [];
  }

  if (fichadas.length === 2 && total === 2) {
    const activos = todasFilas.filter(filaTramoActivo);
    const idx = activos.findIndex((f) => String(f.segmento_id || "").trim() === seg);
    if (idx >= 0 && fichadas[idx]) return marcasHhmmDesdeItemFichada(fichadas[idx]);
  }

  if (fichadas.length === 1 && total >= 2) {
    const f0 = fichadas[0];
    const marcas = marcasHhmmDesdeItemFichada(f0);
    if (!marcas.length) return [];
    const cruzaNoche = fichadaItemCruzaMedianoche(f0, marcas);
    const { ingreso: ingTeo, egreso: egrTeo } = parseRangoHhmmLabel(fila.fichada_label);
    if (
      !cruzaNoche
      && !filaTramoAusente(fila)
      && ingTeo
      && egrTeo
      && marcas.length >= 2
    ) {
      const ingReal = marcas[0];
      const egrReal = marcas[marcas.length - 1];
      const ingR = minutosDesdeHhmmInstitucional(ingReal);
      const egrR = minutosDesdeHhmmInstitucional(egrReal);
      const ingT = minutosDesdeHhmmInstitucional(ingTeo);
      const egrT = minutosDesdeHhmmInstitucional(egrTeo);
      if (
        Number.isFinite(ingR)
        && Number.isFinite(egrR)
        && Number.isFinite(ingT)
        && Number.isFinite(egrT)
        && ingR >= ingT
        && egrR <= egrT
      ) {
        return marcas
          .map((m) => horaCompactaDisplay(m) || m)
          .filter(Boolean);
      }
    }
    if (cruzaNoche) {
      if (filaTramoAusente(fila)) return [];
      if (total >= 3) {
        const ing = marcas[0];
        const egr = marcas[marcas.length - 1];
        if (primero && ing) return [horaCompactaDisplay(ing) || ing];
        if (ultimo && egr) return [horaCompactaDisplay(egr) || egr];
        return [];
      }
      if (total === 2 && (seg === "N" || ultimo)) {
        return marcas.map((m) => horaCompactaDisplay(m) || m).filter(Boolean);
      }
      if (primero) {
        const ing = marcas[0];
        const ingR = minutosDesdeHhmmInstitucional(ing);
        if (ing && Number.isFinite(ingR) && ingR < 15 * 60) {
          return [horaCompactaDisplay(ing) || ing];
        }
      }
      return [];
    }
    const ing = marcas[0];
    const egr = marcas.length > 1 ? marcas[marcas.length - 1] : "";
    const ultimaFila = todasFilas[total - 1];
    const primeraFila = todasFilas[0];
    if (
      primero
      && ing
      && egr
      && !cruzaNoche
      && filaTramoAusente(ultimaFila)
      && !filaTramoAusente(primeraFila)
      && seg === String(primeraFila.segmento_id || "").trim()
    ) {
      return [
        horaCompactaDisplay(ing) || ing,
        horaCompactaDisplay(egr) || egr,
      ];
    }
    const out = [];
    if (primero && ing) out.push(horaCompactaDisplay(ing) || ing);
    if (ultimo && egr) out.push(horaCompactaDisplay(egr) || egr);
    return [...new Set(out.filter(Boolean))];
  }

  const activos = todasFilas.filter(filaTramoActivo);
  const idxActivo = activos.findIndex((f) => String(f.segmento_id || "").trim() === seg);
  if (fichadas.length === activos.length && idxActivo >= 0) {
    return marcasHhmmDesdeItemFichada(fichadas[idxActivo]);
  }

  if (idxActivo >= 0 && fichadas[idxActivo]) {
    return marcasHhmmDesdeItemFichada(fichadas[idxActivo]);
  }

  const { ingreso, egreso } = parseRangoHhmmLabel(fila.fichada_label);
  return [ingreso, egreso].filter(Boolean);
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {Array<Record<string, unknown>>} filas
 */
export function enriquecerFilasPresentacionMarcas(celda, filas) {
  if (!Array.isArray(filas) || !filas.length) return [];
  return filas.map((fila) => ({
    ...fila,
    marcas_hm: marcasHhmmPorTramoDesdeCelda(celda, fila, filas),
  }));
}

/** Piso extra en grilla: fichada real sin empareje en tramo teórico (M/T/N). */
export const SEGMENTO_PISO_FICHADA_FUERA_TRAMO = "·";

/** @param {string} hhmm */
function marcaHhmmNormalizada(hhmm) {
  return horaCompactaDisplay(String(hhmm || "").trim()) || String(hhmm || "").trim();
}

/** @param {Record<string, unknown>} fila @param {Record<string, unknown>} item */
function filaPresentacionConsumeFichadaItem(fila, item) {
  const marcasItem = marcasHhmmDesdeItemFichada(item).map(marcaHhmmNormalizada).filter(Boolean);
  if (!marcasItem.length) return false;

  const marcasFila = marcasCompactasDesdeFila(fila).map(marcaHhmmNormalizada).filter(Boolean);
  if (marcasFila.length) {
    return marcasFila.some((m) => marcasItem.includes(m));
  }

  const { ingreso, egreso } = parseRangoHhmmLabel(fila.fichada_label);
  const desdeLabel = [ingreso, egreso].map(marcaHhmmNormalizada).filter(Boolean);
  if (desdeLabel.length && desdeLabel.some((m) => marcasItem.includes(m))) {
    return true;
  }

  return false;
}

/**
 * Filas sintéticas al pie de la celda: marcas reales no mostradas en ningún tramo teórico.
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {Array<Record<string, unknown>>} filasTramo
 */
export function filasFichadaRealFueraTramoDesdeCelda(celda, filasTramo) {
  const fichadas = parseFichadasRealesCelda(celda);
  if (!fichadas.length || !Array.isArray(filasTramo) || !filasTramo.length) return [];

  const baseOrden = filasTramo.reduce(
    (max, f) => Math.max(max, Number.isFinite(Number(f.orden)) ? Number(f.orden) : 0),
    -1,
  );

  /** @type {Array<Record<string, unknown>>} */
  const extras = [];
  fichadas.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const consumida = filasTramo.some((fila) => filaPresentacionConsumeFichadaItem(fila, item));
    if (consumida) return;

    const marcas_hm = marcasHhmmDesdeItemFichada(item)
      .map((m) => horaCompactaDisplay(m) || m)
      .filter(Boolean);
    if (!marcas_hm.length) return;

    const ing = String(item.ingreso || item.hora_ingreso || "").trim();
    const egr = String(item.egreso || item.hora_egreso || "").trim();
    const hora = String(item.hora || "").trim();
    const fichada_label =
      ing && egr ? `${ing}–${egr}` : ing && !egr ? ing : hora || ing || egr || null;

    extras.push({
      segmento_id: SEGMENTO_PISO_FICHADA_FUERA_TRAMO,
      orden: baseOrden + 1 + extras.length,
      fichada_fuera_tramo: true,
      teoria_label: null,
      fichada_label,
      marcas_hm,
      estado_tramo: "parcial",
      badge_label: "FUERA",
      badge_tipo: "fuera_tramo",
      badges: [{ label: "FUERA", tipo: "fuera_tramo" }],
    });
  });
  return extras;
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {Array<Record<string, unknown>>} filas
 */
export function anexarFilasFichadaRealFueraTramo(celda, filas) {
  if (!Array.isArray(filas) || !filas.length) return filas;
  const extras = filasFichadaRealFueraTramoDesdeCelda(celda, filas);
  if (!extras.length) return filas;
  return [...filas, ...extras];
}

/** `segmento_id` de turno simple (no compuesto); IDs opacos (MA, TN, cfg_reg_turno_*). */
export function segmentoTurnoSimpleDesdeCelda(celda) {
  const tid = String(celda?.rda_turno_id || "").trim();
  if (tid.includes("+")) return "";

  const anal = analiticaCumplimientoDesdeCelda(celda);
  const sc = anal?.segmentos_cumplimiento;
  if (Array.isArray(sc) && sc.length === 1) {
    const sid = String(sc[0]?.segmento_id || "").trim();
    if (sid) return sid.toUpperCase();
  }

  const capa = celda?.capa_teorica;
  if (capa && typeof capa === "object") {
    const segs = Array.isArray(capa.segmentos) ? capa.segmentos : [];
    if (segs.length === 1) {
      const sid = String(segs[0]?.segmento_id || segs[0]?.codigo_interno || segs[0]?.codigo || "").trim();
      if (sid) return sid.toUpperCase();
    }
  }

  if (/^[MTN]$/i.test(tid)) return tid.toUpperCase();
  const fromCfg = tid.match(/_turno_([mtn])$/i) || tid.match(/_([mtn])$/i);
  if (fromCfg) return fromCfg[1].toUpperCase();

  if (tid) return tid.toUpperCase();
  return "";
}

/**
 * Una fila sintética para turno simple M/T/N — misma forma que `presentacion_compuesto.filas[]`.
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function filaPresentacionSimpleDesdeCelda(celda) {
  if (!celda || typeof celda !== "object") return null;
  const segmento_id = segmentoTurnoSimpleDesdeCelda(celda);
  if (!segmento_id) return null;

  const fichadas = parseFichadasRealesCelda(celda);
  const analitica = analiticaCumplimientoDesdeCelda(celda);
  const incBadge = badgeIncumplimientoHorarioRrhh(
    analitica?.disciplina_horaria,
    analitica?.debito_tiempo,
  );
  const inc = analitica ? disciplinaHorariaIncumplimientoDesdeAnalitica(analitica) : null;
  const semaforo = String(celda.validacion_fichada_dia?.estado_semaforo || "").trim();

  if (!fichadas.length) {
    if (semaforo === "ROJO" || semaforo === "AMARILLO") {
      return {
        segmento_id,
        orden: 0,
        teoria_label: null,
        fichada_label: null,
        estado_tramo: "ausente",
        badge_label: "AUSENTE",
        badge_tipo: "ausente_tramo",
      };
    }
    return null;
  }

  const f = fichadas[0];
  const ing = String(f.ingreso || f.hora_ingreso || "").trim();
  const egr = String(f.egreso || f.hora_egreso || "").trim();
  const hora = String(f.hora || "").trim();
  const fichada_label =
    ing && egr ? `${ing}–${egr}` : ing && egr === "" ? ing : hora || ing || egr || null;

  let badge_label = incBadge?.label || null;
  let badge_tipo = null;
  /** @type {Array<{ label: string; tipo: string }>} */
  let badges = [];
  const segsAnal = analitica?.segmentos_cumplimiento;
  if (Array.isArray(segsAnal) && segsAnal.length) {
    const hit =
      segsAnal.find((s) => String(s?.segmento_id || "").trim() === segmento_id) || segsAnal[0];
    if (hit) {
      badges = badgesDisciplinaDesdeSegmentoAnalitica(hit, {
        tolerancia_ingreso_min: Number(analitica?.disciplina_horaria?.tolerancia_ingreso_dia_min) || 0,
        tolerancia_egreso_min: Number(analitica?.disciplina_horaria?.tolerancia_egreso_dia_min) || 0,
      });
      if (badges.length) {
        badge_label = badges[0].label;
        badge_tipo = badges[0].tipo;
      }
    }
  }
  if (!badges.length && analitica) {
    badges = badgesDisciplinaDesdeAnaliticaDia(analitica);
    if (badges.length) {
      badge_label = badges[0].label;
      badge_tipo = badges[0].tipo;
    }
  }
  if (!badges.length && badge_label) {
    badge_tipo =
      inc && inc.salida_anticipada_punitiva_min > 0
        ? "salida"
        : inc && inc.tardanza_punitiva_min > 0
          ? "tardanza"
          : "salida";
  }

  let estado_tramo = "presente";
  if (badge_label === "AUSENTE") estado_tramo = "ausente";
  else if (badges.length || badge_label || semaforo === "AMARILLO" || semaforo === "ROJO") estado_tramo = "parcial";

  return {
    segmento_id,
    orden: 0,
    teoria_label: null,
    fichada_label,
    estado_tramo,
    badge_label,
    badge_tipo,
    ...(badges.length ? { badges } : {}),
  };
}

/**
 * `presente` / `parcial` / `ausente` desde `segmentos_cumplimiento` materializado (dim A).
 * @param {Record<string, unknown>|null|undefined} seg
 * @returns {"presente"|"parcial"|"ausente"|null}
 */
function estadoTramoDesdeSegmentoAnaliticaMaterializado(seg) {
  if (!seg || typeof seg !== "object") return null;
  if (seg.cubierto !== true) return "ausente";
  if (segmentoTieneIncumplimientoDisciplina(seg)) return "parcial";
  return "presente";
}

/** @param {Record<string, unknown>} fila */
export function badgesDisciplinaDesdeFilaPresentacion(fila) {
  if (Array.isArray(fila.badges) && fila.badges.length) {
    return fila.badges
      .map((b) => ({
        label: String(b?.label || "").trim(),
        tipo: String(b?.tipo || "").trim(),
      }))
      .filter((b) => b.label);
  }
  const badge = String(fila.badge_label || "").trim();
  if (!badge) return [];
  return [{ label: badge, tipo: String(fila.badge_tipo || "").trim() || "salida" }];
}

/** Minutos desde medianoche para comparar HH:mm / H:mm. */
function minutosDesdeHhmmInstitucional(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const m2 = s.match(/^(\d{1,2})$/);
  if (m2) return Number(m2[1]) * 60;
  return Number.NaN;
}

/** Badges ▼ desde incumplimiento horario del día (turno simple sin dual en segmento). */
function badgesDisciplinaDesdeAnaliticaDia(anal) {
  if (!anal || typeof anal !== "object") return [];
  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica(anal);
  /** @type {Array<{ label: string; tipo: string }>} */
  const badges = [];
  if (inc.tardanza_punitiva_min > 0) {
    const label = labelBadgeDisciplinaMinutosCelda(inc.tardanza_punitiva_min);
    if (label) badges.push({ label, tipo: "tardanza" });
  }
  if (inc.salida_anticipada_punitiva_min > 0) {
    const label = labelBadgeDisciplinaMinutosCelda(inc.salida_anticipada_punitiva_min);
    if (label) badges.push({ label, tipo: "salida" });
  }
  return badges;
}

function aplicarBadgesYEstadoTramo(fila, badges) {
  const estado =
    badges.some((b) => b.tipo === "ausente_tramo")
      ? "ausente"
      : badges.some((b) => b.tipo === "tardanza" || b.tipo === "salida")
        ? "parcial"
        : fila.estado_tramo || "presente";
  return {
    ...fila,
    estado_tramo: estado,
    badges,
    badge_label: badges[0]?.label ?? fila.badge_label ?? null,
    badge_tipo: badges[0]?.tipo ?? fila.badge_tipo ?? null,
  };
}

/**
 * Sincroniza badges/estado desde analítica materializada (sin recalcular motor).
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {Array<Record<string, unknown>>} filas
 */
export function reconciliarFilasPresentacionDesdeAnalitica(celda, filas) {
  const anal = analiticaCumplimientoDesdeCelda(celda);
  const segs = anal?.segmentos_cumplimiento;
  if (!Array.isArray(segs) || !segs.length || !Array.isArray(filas) || !filas.length) {
    return filas;
  }
  const disc = anal?.disciplina_horaria || anal?.disciplina || {};
  const capa = celda?.capa_teorica_limites || {};
  const tolIn = Number(disc.tolerancia_ingreso_dia_min ?? capa.tolerancia_ingreso_dia_min) || 0;
  const tolOut = Number(disc.tolerancia_egreso_dia_min ?? capa.tolerancia_egreso_dia_min) || 0;
  const tolOpts = { tolerancia_ingreso_min: tolIn, tolerancia_egreso_min: tolOut };
  return filas.map((fila) => {
    const segId = String(fila.segmento_id || "").trim();
    let hit = segs.find((s) => String(s?.segmento_id || "").trim() === segId);
    if (!hit && filas.length === 1) {
      const fallbackId = segId || segmentoTurnoSimpleDesdeCelda(celda);
      if (fallbackId) {
        hit = segs.find((s) => String(s?.segmento_id || "").trim() === fallbackId);
      }
      if (!hit) hit = segs[0];
    }
    if (!hit) return fila;
    let badges = badgesDisciplinaDesdeSegmentoAnalitica(hit, tolOpts);
    if (!badges.length && filas.length === 1) {
      badges = badgesDisciplinaDesdeAnaliticaDia(anal);
    }
    if (!badges.length && hit.cubierto !== true) {
      return aplicarBadgesYEstadoTramo(fila, [{ label: "AUSENTE", tipo: "ausente_tramo" }]);
    }
    if (!badges.length) {
      return {
        ...fila,
        estado_tramo: hit.cubierto === true ? "presente" : "ausente",
        badges: [],
        badge_label: null,
        badge_tipo: null,
      };
    }
    return aplicarBadgesYEstadoTramo(fila, badges);
  });
}

/**
 * Filas para UI por pisos sin reconciliar analítica en cliente (RFC F §7).
 * Usar en hot path de grilla; tests/diagnóstico siguen con `filasPresentacionOperativaDesdeCelda`.
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function filasPresentacionMaterializadaDesdeCelda(celda) {
  const comp = filasPresentacionCompuestoDesdeCelda(celda);
  if (esMatrizPresentacionCompuesta(comp)) return comp;
  if (esPresentacionPorPisos(comp)) return comp;
  const simple = filaPresentacionSimpleDesdeCelda(celda);
  return simple ? [simple] : [];
}

/**
 * Hot path grilla: materializado + reparto de marcas desde `fichadas_reales`.
 * Sin reconciliar `estado_tramo` desde analítica (RFC F §7).
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function filasPresentacionGrillaDesdeCelda(celda) {
  let filas = filasPresentacionMaterializadaDesdeCelda(celda);
  filas = filtrarFilasPresentacionAlTeoricoOperativo(celda, filas);
  if (analiticaCumplimientoDesdeCelda(celda)) {
    filas = reconciliarFilasPresentacionDesdeAnalitica(celda, filas);
  }
  filas = enriquecerFilasPresentacionMarcas(celda, filas);
  return anexarFilasFichadaRealFueraTramo(celda, filas);
}

/**
 * Filas para UI por pisos: compuesto materializado o turno simple M/T/N.
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function filasPresentacionOperativaDesdeCelda(celda) {
  const comp = filasPresentacionCompuestoDesdeCelda(celda);
  let filas = [];
  if (esMatrizPresentacionCompuesta(comp)) filas = comp;
  else {
    const simple = filaPresentacionSimpleDesdeCelda(celda);
    if (simple) filas = [simple];
  }
  filas = filtrarFilasPresentacionAlTeoricoOperativo(celda, filas);
  filas = reconciliarFilasPresentacionDesdeAnalitica(celda, filas);
  filas = enriquecerFilasPresentacionMarcas(celda, filas);
  return anexarFilasFichadaRealFueraTramo(celda, filas);
}

/** Alturas grilla equipo — estándar operativa (planificado / fijo / rotativo). */
export const ALTURA_FILA_GRILLA_SIMPLE = "h-[4.25rem]";
export const ALTURA_FILA_GRILLA_COMPUESTO = "h-[5.75rem]";
export const ALTURA_CHIP_GRILLA_SIMPLE = "h-[3.25rem]";
export const ALTURA_CHIP_GRILLA_COMPUESTO = "h-[5.5rem]";
/** Altura fija de fila y chip en `GrillaMesEquipoTabla` (todas las filas). */
export const ALTURAS_FILA_GRILLA_EQUIPO_ESTANDAR = {
  alturaFila: ALTURA_FILA_GRILLA_COMPUESTO,
  alturaChip: ALTURA_CHIP_GRILLA_COMPUESTO,
  uniformarChipPlanificado: true,
};
/** Para override de CHIP_BASE (h-12) en filas compuestas. */
export const CLASE_CHIP_IMPORTANTE_COMPUESTO = "!h-[5.5rem]";
/** Columna día con fichadas M/T/N (más ancha que w-14). */
export const ANCHO_MIN_COL_DIA_FICHADA = "min-w-[7rem]";
/** Marco visual: separa el chip del borde de la grilla. */
export const CLASE_CHIP_MARCO_CELDA_DIA = "!rounded-md !shadow-sm";
/** Chip ancho completo en columnas fichada (F, licencia, turno simple). */
export const CLASE_CHIP_ANCHO_CELDA_DIA = "!mx-0 !w-full !max-w-none !min-w-0";
export const CLASE_CHIP_ANCHO_FICHADA =
  "!mx-0 !w-full !max-w-none !min-w-0 !rounded-md !shadow-sm !flex-col !items-stretch !justify-stretch !px-0";
/** TD con margen interno — la celda día flota dentro de la columna. */
export const CLASE_TD_DIA_FICHADA = "p-1 align-middle";

/**
 * ¿La grilla del mes necesita columnas anchas para fichadas por tramo?
 * @param {Array<Record<string, unknown>>} filas
 * @param {"rrhh"|"jefe"|null|undefined} modoFichada
 */
export function tablaNecesitaColumnasFichadaAnchas(filas, modoFichada = null) {
  if (modoFichada) return true;
  return (filas || []).some((fila) => filaGrillaTieneTurnoCompuesto(fila));
}

/** Texto de marcas para celda: todas las fichadas en una línea. */
export function textoMarcasPisoCelda(fila) {
  if (filaTramoAusente(fila)) return "AUSENTE";
  const marcas = marcasCompactasDesdeFila(fila);
  if (marcas.length) return marcas.join(" · ");
  const dato = etiquetaFichadaPisoCelda(fila, 3);
  return dato || "";
}

/** Marcas HH:mm listas para pintar (compactas). */
export function marcasCompactasDesdeFila(fila) {
  const raw = Array.isArray(fila.marcas_hm) ? fila.marcas_hm : [];
  if (raw.length) {
    return raw
      .map((m) => horaCompactaDisplay(String(m || "").trim()) || String(m || "").trim())
      .filter(Boolean);
  }
  const dato = etiquetaFichadaPisoCelda(fila, 3);
  if (!dato || dato === "—") return [];
  return dato.split(/\s*·\s*/).filter(Boolean);
}

/**
 * ¿La fila agente tiene al menos un día con matriz compuesta o turno M+N/M+T+N?
 * @param {Record<string, unknown>|null|undefined} fila
 */
export function filaGrillaTieneTurnoCompuesto(fila) {
  const dias = fila?.dias && typeof fila.dias === "object" ? fila.dias : {};
  for (const cell of Object.values(dias)) {
    if (!cell || typeof cell !== "object") continue;
    if (esMatrizPresentacionCompuesta(filasPresentacionCompuestoDesdeCelda(cell))) {
      return true;
    }
    const tid = String(cell.rda_turno_id || "").trim();
    if (tid.includes("+")) return true;
  }
  return false;
}

/** ¿Algún día de la fila usa presentación por pisos (típico régimen planificado)? */
export function filaGrillaTienePresentacionPorPisos(fila) {
  const dias = fila?.dias && typeof fila.dias === "object" ? fila.dias : {};
  for (const cell of Object.values(dias)) {
    if (!cell || typeof cell !== "object") continue;
    if (esPresentacionPorPisos(filasPresentacionGrillaDesdeCelda(cell))) return true;
  }
  return false;
}

/**
 * Altura estándar de grilla equipo (siempre alta — mejor lectura en celda día).
 * @param {Array<Record<string, unknown>>} [_filas]
 */
export function grillaEquipoTablaUsaAlturaFilaPlanificada(_filas) {
  return true;
}

/** @param {Array<Record<string, unknown>>} [_filas] */
export function alturasFilaGrillaEquipoTabla(_filas) {
  return ALTURAS_FILA_GRILLA_EQUIPO_ESTANDAR;
}

/**
 * Líneas legibles para modal / listas (sin recalcular; solo labels persistidos).
 * @param {Array<Record<string, unknown>>} filas
 * @param {{ modoRrhh?: boolean }} [opts]
 */
export function lineasDesdePresentacionCompuesto(filas, opts = {}) {
  void opts;
  if (!esPresentacionPorPisos(filas)) return [];
  return filas.map((fila) => {
    const seg = String(fila.segmento_id || "").trim();
    if (filaTramoAusente(fila)) {
      return seg ? `${seg} · AUSENTE` : "AUSENTE";
    }
    const dato = etiquetaFichadaPisoCelda(fila, filas.length);
    const badges = badgesDisciplinaDesdeFilaPresentacion(fila);
    const partes = [];
    if (seg) partes.push(seg);
    if (dato) partes.push(dato);
    for (const b of badges) partes.push(b.label);
    return partes.join(" · ");
  });
}

/** Copy modal / tooltip: solo fichada operativa (sin teoría). */
export function copyFichadaOperativaPiso(fila, totalFilas = 2) {
  const seg = String(fila.segmento_id || "").trim();
  if (fila.fichada_fuera_tramo === true) {
    const marcas = marcasCompactasDesdeFila(fila);
    const horas = marcas.length ? marcas.join(" · ") : String(fila.fichada_label || "").trim();
    return horas ? `Fichada ${horas}` : "Fichada fuera de turno teórico";
  }
  if (filaTramoAusente(fila)) {
    return seg ? `${seg} · AUSENTE` : "AUSENTE";
  }
  const dato = etiquetaFichadaPisoCelda(fila, totalFilas);
  const badges = badgesDisciplinaDesdeFilaPresentacion(fila);
  const partes = [];
  if (seg) partes.push(seg);
  if (dato) partes.push(dato);
  for (const b of badges) partes.push(b.label);
  return partes.join(" · ");
}

/** @param {Record<string, unknown>} fila */
export function titleFilaPresentacionCompuesto(fila) {
  const fichada = String(fila.fichada_label || "").trim();
  const badge = String(fila.badge_label || "").trim();
  const estado = String(fila.estado_tramo || "").trim();
  const seg = String(fila.segmento_id || "").trim();
  const teoria = String(fila.teoria_label || "").trim();
  const partes = [];
  if (seg) partes.push(`Tramo ${seg}`);
  const operativo = copyFichadaOperativaPiso(fila, 3);
  if (operativo) partes.push(operativo);
  else if (fichada) partes.push(`Fichada ${fichada}`);
  else if (estado === "ausente") partes.push("Sin fichada en tramo");
  if (badge && !operativo.includes(badge)) partes.push(badge);
  if (teoria) partes.push(`Plan ${teoria}`);
  return partes.join(" · ") || "Tramo";
}

/**
 * Tooltip en celda: solo fichada real compacta + badge.
 * @param {Record<string, unknown>} fila
 * @param {number} [totalFilas]
 */
export function titlePisoCompuestoCelda(fila, totalFilas = 2) {
  return copyFichadaOperativaPiso(fila, totalFilas) || titleFilaPresentacionCompuesto(fila);
}

/**
 * Parsea rango HH:mm persistido en `fichada_label` (sin recalcular).
 * Soporta atajo institucional `06-14` (horas en punto) y `06:38-14:00`.
 * @param {string|null|undefined} label
 * @returns {{ ingreso: string, egreso: string, esHorasEnteras: boolean }}
 */
export function parseRangoHhmmLabel(label) {
  const s = String(label || "").trim();
  if (!s) return { ingreso: "", egreso: "", esHorasEnteras: false };

  const conMinutos = s.match(/^(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/);
  if (conMinutos) {
    return {
      ingreso: conMinutos[1],
      egreso: conMinutos[2],
      esHorasEnteras: conMinutos[1].endsWith(":00") && conMinutos[2].endsWith(":00"),
    };
  }

  const horasSolas = s.match(/^(\d{1,2})\s*[–—-]\s*(\d{1,2})$/);
  if (horasSolas) {
    return {
      ingreso: `${horasSolas[1]}:00`,
      egreso: `${horasSolas[2]}:00`,
      esHorasEnteras: true,
    };
  }

  const parts = s.split(/\s*[–—-]\s*/);
  return {
    ingreso: (parts[0] || "").trim(),
    egreso: (parts[1] || "").trim(),
    esHorasEnteras: false,
  };
}

/** Hora compacta para celda: `7:00`, `5:44` (sin cero a la izquierda en hora). */
export function horaCompactaDisplay(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  return `${Number(m[1])}:${m[2]}`;
}

/**
 * Dato operativo compacto para celda: hora real (ingreso/egreso), no rango teórico.
 * Lee solo `fichada_label` + `estado_tramo` + `badge_*` materializados.
 *
 * @param {Record<string, unknown>} fila
 * @param {number} [totalFilas]
 */
export function etiquetaFichadaPisoCelda(fila, totalFilas = 2) {
  void totalFilas;
  if (filaTramoAusente(fila)) return "";

  const marcas = Array.isArray(fila.marcas_hm) ? fila.marcas_hm : [];
  if (marcas.length) {
    return marcas
      .map((m) => horaCompactaDisplay(String(m || "").trim()) || String(m || "").trim())
      .filter(Boolean)
      .join(" · ");
  }

  const estado = String(fila.estado_tramo || "").trim();
  const badge = String(fila.badge_label || "").trim();
  const badgeTipo = String(fila.badge_tipo || "").trim();
  const fichada = String(fila.fichada_label || "").trim();
  const orden = Number.isFinite(Number(fila.orden)) ? Number(fila.orden) : 0;
  const ultimo = orden >= totalFilas - 1;
  const primero = orden === 0;

  if (!fichada) return "";

  const { ingreso, egreso, esHorasEnteras } = parseRangoHhmmLabel(fichada);
  const ingresoC = horaCompactaDisplay(ingreso);
  const egresoC = horaCompactaDisplay(egreso);

  const cumpleSinDesvio =
    estado === "presente" &&
    !badge &&
    (esHorasEnteras || (ingreso.endsWith(":00") && egreso.endsWith(":00")));

  if (cumpleSinDesvio) return "";

  if (badge) {
    if (badgeTipo === "tardanza" || primero) return ingresoC || "";
    if (badgeTipo === "salida" || ultimo) return egresoC || ingresoC || "";
    return estado === "parcial" ? egresoC || ingresoC || "" : ingresoC || "";
  }

  if (estado === "presente") {
    if (primero && !esHorasEnteras && ingreso && !ingreso.endsWith(":00")) {
      return ingresoC;
    }
    return "";
  }

  if (estado === "parcial") {
    if (ultimo && egresoC) return egresoC;
    if (primero && ingresoC) return ingresoC;
    return egresoC || ingresoC || "";
  }
  return ingresoC || "";
}

/**
 * Fondo y texto del piso — dimensión A (disciplina): badge ▲/▼, no déficit de cobertura.
 * @param {Record<string, unknown>} fila
 */
export function claseVisualPisoCompuesto(fila) {
  const estado = String(fila.estado_tramo || "").trim();
  const badges = badgesDisciplinaDesdeFilaPresentacion(fila);

  if (fila.fichada_fuera_tramo === true || badges.some((b) => b.tipo === "fuera_tramo")) {
    return {
      piso: "bg-violet-200 text-violet-950",
      seg: "font-bold",
      dato: "font-mono font-semibold",
      badge: "font-bold uppercase tracking-tight text-[8px]",
    };
  }

  const esAusente =
    estado === "ausente" || badges.some((b) => b.tipo === "ausente_tramo" || b.label === "AUSENTE");
  const esParcial = estado === "parcial";
  const esAlerta =
    !esAusente &&
    (esParcial ||
      badges.some((b) => b.tipo === "tardanza" || b.tipo === "salida" || Boolean(b.label)));

  if (esAusente) {
    return {
      piso: "bg-rose-200 text-rose-950",
      seg: "font-bold",
      dato: "font-semibold",
      badge: "font-bold uppercase tracking-tight",
    };
  }
  if (esAlerta) {
    return {
      piso: "bg-amber-200 text-amber-950",
      seg: "font-bold",
      dato: "font-mono font-semibold",
      badge: "font-bold",
    };
  }
  if (estado === "presente") {
    return {
      piso: "bg-emerald-200 text-emerald-950",
      seg: "font-bold",
      dato: "font-mono font-semibold",
      badge: "font-bold",
    };
  }
  return {
    piso: "bg-slate-100 text-slate-600",
    seg: "font-bold",
    dato: "font-mono font-semibold",
    badge: "font-bold",
  };
}
