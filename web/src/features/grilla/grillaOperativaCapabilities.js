import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";

/** Identificador de shell (ruta / menú), no del claim JWT. */
export const GRILLA_OPERATIVA_SHELL = {
  RRHH: "rrhh",
  JEFE: "jefe",
};

/**
 * Capacidades fijadas por la página contenedora (shell). El panel compartido no infiere
 * permisos sensibles solo desde `claims` (evita jefe+RRHH viendo liquidación en ruta jefe).
 *
 * @typedef {Object} GrillaOperativaCapabilities
 * @property {"rrhh"|"jefe"} shell
 * @property {"catalogo"|"hlg_vigente"} origenGrupos — fuente del SelectorFocoGdt / tarjetas sector
 * @property {boolean} preferModoSector — modo inicial en `useGrillaMesVista` (SECTOR vs EQUIPO)
 * @property {boolean} muestraTarjetaTitular — tarjeta «Titular (mi caso)» en landing de períodos
 * @property {boolean} puedeAccionesPeriodoLiquidacion — cierre/reapertura período (solo shell RRHH)
 * @property {boolean} puedeVerFichadasReales — capa 4 / modo fichada RRHH en celda y modal
 * @property {boolean} syncFocoEnUrl — T-05: persistir `?grupo_id=&periodo=` (RRHH primero)
 * @property {string} rutaFocoBase — base para deep link del foco GDT
 */

/** @type {GrillaOperativaCapabilities} */
const RRHH_CAPABILITIES = {
  shell: GRILLA_OPERATIVA_SHELL.RRHH,
  origenGrupos: "catalogo",
  preferModoSector: true,
  muestraTarjetaTitular: false,
  puedeAccionesPeriodoLiquidacion: true,
  puedeVerFichadasReales: true,
  syncFocoEnUrl: true,
  rutaFocoBase: "/portal/rrhh/grilla-operativa",
};

/** @type {GrillaOperativaCapabilities} */
const JEFE_CAPABILITIES = {
  shell: GRILLA_OPERATIVA_SHELL.JEFE,
  origenGrupos: "hlg_vigente",
  preferModoSector: false,
  muestraTarjetaTitular: true,
  puedeAccionesPeriodoLiquidacion: false,
  puedeVerFichadasReales: false,
  syncFocoEnUrl: true,
  rutaFocoBase: "/portal/jefe/grilla-operativa",
};

/**
 * @param {string} shell — `GRILLA_OPERATIVA_SHELL.RRHH` | `GRILLA_OPERATIVA_SHELL.JEFE`
 * @returns {GrillaOperativaCapabilities}
 */
export function resolveGrillaOperativaCapabilities(shell) {
  if (shell === GRILLA_OPERATIVA_SHELL.RRHH) {
    return { ...RRHH_CAPABILITIES };
  }
  if (shell === GRILLA_OPERATIVA_SHELL.JEFE) {
    return { ...JEFE_CAPABILITIES };
  }
  throw new Error(`Shell grilla operativa desconocido: ${shell}`);
}

/**
 * Puente legacy `variant` del panel → capabilities (preferir pasar `capabilities` desde la shell).
 * @param {"default"|"rrhh"} [variant]
 * @returns {GrillaOperativaCapabilities}
 */
export function resolveGrillaOperativaCapabilitiesFromVariant(variant = "default") {
  return resolveGrillaOperativaCapabilities(
    variant === "rrhh" ? GRILLA_OPERATIVA_SHELL.RRHH : GRILLA_OPERATIVA_SHELL.JEFE,
  );
}

/**
 * @param {GrillaOperativaCapabilities} cap
 * @returns {boolean}
 */
export function grillaUsaCatalogoSector(cap) {
  return cap.origenGrupos === "catalogo";
}

/**
 * Modo GSO por defecto al abrir la shell (no reemplaza Titular dentro del modal jefe).
 * @param {GrillaOperativaCapabilities} cap
 * @returns {string}
 */
export function modoGrillaInicialDesdeCapabilities(cap) {
  return cap.preferModoSector ? GRILLA_MES_MODO.SECTOR : GRILLA_MES_MODO.EQUIPO;
}
