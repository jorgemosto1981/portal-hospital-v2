/**
 * Estilo único de grillas de turnos (alto contraste ON del editor mensual).
 * Solo presentación: sin lecturas/escrituras ni reglas de negocio.
 */

import {
  resolverHorarioCelda,
  isoToHhmmInstitucional,
} from "../../../../shared/utils/horarioInstitucionalDisplay.js";

export const FRANCO_STYLE = { bg: "bg-slate-400 hover:bg-slate-500", text: "text-slate-900" };
export const NO_LABORABLE_STYLE = { bg: "bg-slate-200 hover:bg-slate-300", text: "text-slate-700" };
export const BLOQUEADO_STYLE = { bg: "bg-slate-100", text: "text-slate-300" };
export const NO_ASIGNADO_STYLE = { bg: "bg-slate-400 hover:bg-slate-500", text: "text-slate-900" };
export const LICENCIA_STYLE = { bg: "bg-fuchsia-300", text: "text-fuchsia-950" };
export const INSTITUCIONAL_STYLE = { bg: "bg-amber-300", text: "text-amber-950" };
export const LABORABLE_STYLE = { bg: "bg-green-300", text: "text-green-950", hover: "hover:bg-green-400" };
export const FICHADA_REAL_STYLE = { bg: "bg-sky-100", text: "text-sky-950", hover: "hover:bg-sky-200" };

export const CHIP_BASE =
  "mx-auto flex h-12 w-14 items-center justify-center rounded border border-slate-400 px-0.5 font-semibold leading-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]";

/** Chip a ancho/alto de la celda (semáforo jefe). */
export const CLASE_CHIP_RELLENO_CELDA =
  "mx-0 flex h-12 w-full min-w-0 max-w-none items-center justify-center rounded-none border-0 px-0.5 font-semibold leading-tight shadow-none";

const VARIANTES_CHIP = {
  franco: FRANCO_STYLE,
  noLaborable: NO_LABORABLE_STYLE,
  laborable: LABORABLE_STYLE,
  fichadaReal: FICHADA_REAL_STYLE,
  licencia: LICENCIA_STYLE,
  institucional: INSTITUCIONAL_STYLE,
  bloqueado: BLOQUEADO_STYLE,
  noAsignado: NO_ASIGNADO_STYLE,
  vacio: { bg: "bg-white", text: "text-slate-400" },
  incompletoPlan: {
    bg: "bg-rose-100 hover:bg-rose-200 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(244,63,94,0.15)_3px,rgba(244,63,94,0.15)_6px)]",
    text: "text-rose-950",
  },
  futuroGris: { bg: "bg-slate-100 hover:bg-slate-200", text: "text-slate-700" },
  teoriaPendiente: { bg: "bg-slate-200 hover:bg-slate-300", text: "text-slate-800" },
  semaforoVerde: { bg: "bg-emerald-300", text: "text-emerald-950", hover: "hover:bg-emerald-400" },
  semaforoAmarillo: { bg: "bg-amber-300", text: "text-amber-950", hover: "hover:bg-amber-400" },
  semaforoRojo: { bg: "bg-rose-300", text: "text-rose-950", hover: "hover:bg-rose-400" },
};

/** @param {keyof typeof VARIANTES_CHIP} variant */
export function claseChipVariante(variant, extra = "") {
  const s = VARIANTES_CHIP[variant] || VARIANTES_CHIP.vacio;
  const hover = s.hover ? ` ${s.hover}` : "";
  return `${CHIP_BASE} ${s.bg}${hover} ${s.text} ${extra}`.trim();
}

/**
 * Chip en grilla operativa equipo (opción relleno total de celda).
 * @param {keyof typeof VARIANTES_CHIP} variant
 * @param {{ relleno?: boolean, extra?: string }} [opts]
 */
export function claseChipEquipoOperativa(variant, opts = {}) {
  const { relleno = false, extra = "" } = opts;
  const s = VARIANTES_CHIP[variant] || VARIANTES_CHIP.vacio;
  const hover = s.hover ? ` ${s.hover}` : "";
  if (relleno) {
    return `${CLASE_CHIP_RELLENO_CELDA} ${s.bg}${hover} ${s.text} ${extra}`.trim();
  }
  return claseChipVariante(variant, extra);
}

/** @param {{ esFinde?: boolean, esFeriado?: boolean }} p */
export function claseHeaderColumna({ esFinde, esFeriado }) {
  const base = "border-b border-slate-400 px-0.5 py-1 text-center text-[10px] font-semibold";
  if (esFeriado) return `${base} bg-amber-300 text-amber-950`;
  if (esFinde) return `${base} bg-rose-50 text-rose-700`;
  return `${base} text-slate-700`;
}

/** @param {{ esFinde?: boolean, esFeriado?: boolean }} p */
export function claseTdColumna({ esFinde, esFeriado }) {
  const base = "border border-slate-300 px-0.5 py-0.5 align-middle";
  if (esFeriado) return `${base} bg-amber-200`;
  if (esFinde) return `${base} bg-rose-100`;
  return base;
}

/**
 * Fondos calendario titular / grilla equipo.
 * Activo = verde claro · Inactivo (franco) = slate · Feriado = ámbar claro · NL / sin HLg = vacío (UI).
 * @param {{
 *   sinAsignacionGrupo?: boolean;
 *   esFinde?: boolean;
 *   esFeriado?: boolean;
 *   esFranco?: boolean;
 *   esNoLaborable?: boolean;
 *   esLaborable?: boolean;
 * }} p
 */
export function claseFondoCeldaCalendarioTitular({
  sinAsignacionGrupo = false,
  esFinde = false,
  esFeriado = false,
  esFranco = false,
  esNoLaborable = false,
  esLaborable = false,
}) {
  const base = "border border-slate-300";
  if (sinAsignacionGrupo) return `${base} bg-slate-200`;
  if (esFeriado) return `${base} bg-amber-100`;
  if (esFranco) return `${base} bg-slate-300`;
  if (esLaborable) return `${base} bg-emerald-100`;
  if (esNoLaborable) return `${base} bg-slate-400`;
  if (esFinde) return `${base} bg-rose-100`;
  return `${base} bg-white`;
}

export function claseHeaderAgenteSticky() {
  return "sticky left-0 z-20 min-w-[5.5rem] border-b border-r border-slate-400 bg-slate-200 px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-800 md:min-w-[9.25rem]";
}

/** Encabezado de grilla operativa: fija fila al hacer scroll vertical (contenedor con overflow-auto). */
export function claseHeaderGrillaStickyTop(fila = 0) {
  const top = fila === 0 ? "top-0" : "top-9";
  return `sticky ${top} z-50 shadow-[0_1px_0_rgba(15,23,42,0.12)]`;
}

export function claseHeaderGrillaStickyEsquina(fila = 0) {
  const top = fila === 0 ? "top-0" : "top-9";
  return `sticky left-0 ${top} z-[60] min-w-[5.5rem] border-b border-r border-slate-400 bg-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.12)] md:min-w-[9.25rem]`;
}

/** Marco celda con gestión de turno pendiente en outbox (RFC F4 amendment). */
export const CLASE_MARCO_CELDA_OUTBOX_PENDIENTE =
  "ring-[3px] ring-amber-600 ring-offset-1 shadow-md outline outline-1 outline-amber-500/60";

export function claseCeldaAgenteSticky() {
  return "sticky left-0 z-10 min-w-[5.5rem] border-b border-r border-slate-400 bg-white px-1.5 py-0.5 align-middle md:min-w-[9.25rem]";
}

export function claseBordeTablaResumen() {
  return "border-b border-slate-400 text-slate-800";
}

export function clasesTextoCelda(valor) {
  const len = String(valor || "").trim().length;
  if (len <= 5) return "text-[10px]";
  if (len <= 9) return "text-[9px]";
  if (len <= 13) return "text-[8px]";
  return "text-[7px]";
}

/** Texto principal en celda con preview outbox (más legible que teórico denso). */
export function clasesTextoCeldaOutboxPendiente(valor) {
  const len = String(valor || "").trim().length;
  if (len <= 5) return "text-xs font-semibold";
  if (len <= 9) return "text-[11px] font-semibold";
  if (len <= 13) return "text-[10px] font-semibold";
  return "text-[9px] font-semibold";
}

/** @param {object|null|undefined} celda */
export function horarioVisibleEnCelda(celda) {
  if (!celda || typeof celda !== "object") return { ingreso: null, egreso: null };
  const base = resolverHorarioCelda(celda);
  if (base.ingreso || base.egreso) return base;
  const segs = celda.segmentos;
  if (!Array.isArray(segs) || segs.length === 0) return base;
  return {
    ingreso: isoToHhmmInstitucional(segs[0]?.ingreso_iso),
    egreso: isoToHhmmInstitucional(segs[segs.length - 1]?.egreso_iso),
  };
}

/** @param {object|null|undefined} celda */
export function celdaTieneJornadaLaboral(celda) {
  if (!celda || typeof celda !== "object") return false;
  const tipo = String(celda.tipo_dia || "").trim().toLowerCase();
  if (tipo === "franco" || tipo === "no_laborable" || celda.es_franco === true) return false;
  if (celda.turno_id || celda.turno_compuesto_id) return true;
  if (tipo === "laborable" || tipo === "guardia") return true;
  const { ingreso, egreso } = horarioVisibleEnCelda(celda);
  return Boolean(ingreso || egreso);
}

/** @param {keyof typeof VARIANTES_CHIP} variant */
export function estiloChipDesdeVariante(variant) {
  return VARIANTES_CHIP[variant] || VARIANTES_CHIP.vacio;
}

/** @param {object|null|undefined} celda */
export function varianteCeldaAprobada(celda) {
  if (!celda || typeof celda !== "object") return "vacio";
  if (celda.tipo_dia === "no_laborable") return "noLaborable";
  if (celda.es_franco || celda.tipo_dia === "franco") return "franco";
  const esInst =
    celda.es_feriado === true ||
    celda.tipo_evento_institucional === "feriado" ||
    celda.tipo_evento_institucional === "asueto";
  if (esInst && !celdaTieneJornadaLaboral(celda)) return "institucional";
  if (celdaTieneJornadaLaboral(celda)) return "laborable";
  return "vacio";
}

/**
 * Variante visual en editor mensual (fijo/rotativo/planificado).
 * @param {{
 *   esFranco?: boolean;
 *   esNoLaborable?: boolean;
 *   horarioText?: string;
 *   turnoId?: string;
 *   estado?: string;
 *   tieneLicencia?: boolean;
 * }} p
 */
export function varianteCeldaMensual({
  esFranco,
  esNoLaborable,
  horarioText,
  turnoId,
  estado,
  tieneLicencia,
}) {
  if (tieneLicencia) return "licencia";
  if (esNoLaborable) return "noLaborable";
  if (esFranco) {
    if (estado === "no_asignado") return "noAsignado";
    return "franco";
  }
  if (horarioText || turnoId) return "laborable";
  if (estado === "bloqueado") return "bloqueado";
  return "vacio";
}

/**
 * @param {"VERDE"|"AMARILLO"|"ROJO"|string|null|undefined} estado
 * @returns {keyof typeof VARIANTES_CHIP|null}
 */
export function varianteChipDesdeSemaforoFichada(estado) {
  const e = String(estado || "").trim();
  if (e === "VERDE") return "semaforoVerde";
  if (e === "AMARILLO") return "semaforoAmarillo";
  if (e === "ROJO") return "semaforoRojo";
  return null;
}

/**
 * Fondo de `<td>` en grilla jefe cuando el semáforo pinta la celda entera (sin licencia).
 * @param {"VERDE"|"AMARILLO"|"ROJO"|string|null|undefined} estado
 */
export function claseFondoTdJefeSemaforo(estado) {
  const v = varianteChipDesdeSemaforoFichada(estado);
  if (!v) return null;
  const s = VARIANTES_CHIP[v];
  return `border border-slate-300 p-0 align-middle ${s.bg}`;
}

/**
 * @param {{
 *   tieneLicencia?: boolean;
 *   esNoLaborable?: boolean;
 *   esFranco?: boolean;
 *   tieneTurno?: boolean;
 *   esIncompletoPlan?: boolean;
 *   teoriaPendienteLazy?: boolean;
 *   soloInstitucional?: boolean;
 *   esFuturoGris?: boolean;
 *   estadoSemaforoFichada?: string|null;
 * }} p
 */
export function varianteCeldaOperativa({
  tieneLicencia,
  esNoLaborable,
  esFranco,
  tieneTurno,
  esIncompletoPlan,
  teoriaPendienteLazy,
  esFuturoGris,
  estadoSemaforoFichada,
}) {
  if (teoriaPendienteLazy && tieneLicencia) return "teoriaPendiente";
  if (tieneLicencia) return "licencia";
  if (esFuturoGris) return "futuroGris";
  if (esIncompletoPlan) return "incompletoPlan";
  const vSem = varianteChipDesdeSemaforoFichada(estadoSemaforoFichada);
  if (vSem) return vSem;
  if (tieneTurno) return "laborable";
  if (esNoLaborable) return "noLaborable";
  if (esFranco) return "franco";
  return "vacio";
}
