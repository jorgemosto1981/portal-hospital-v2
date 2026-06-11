/**
 * Consola triple horizonte (jefe) — reglas puras M−1 / M / M+1.
 * Sin React; consumido por PlanTurnoServicioPage y tests Vitest.
 */

import { periodosVentanaJefe } from "../jefe/periodoJefe.js";

/** Índice de columna en `periodosVentanaJefe()`: [M−1, M, M+1]. */
export const HORIZONTE_CONSOLA_IDX = {
  MES_ANTERIOR_CIERRE: 0,
  MES_ACTUAL_OPERACION: 1,
  MES_PROXIMO_PLANIFICACION: 2,
};

export const HORIZONTE_CONSOLA_TITULOS = [
  "Mes anterior · Cierre",
  "Mes actual · Operación",
  "Mes próximo · Planificación",
];

/**
 * @param {string} periodoYm
 * @param {string[]} [ventanaTres]
 * @returns {0 | 1 | 2 | null}
 */
export function indiceHorizonteEnVentana(periodoYm, ventanaTres = null) {
  const ventana = ventanaTres ?? periodosVentanaJefe();
  const idx = ventana.indexOf(String(periodoYm || "").trim());
  if (idx < 0 || idx > 2) return null;
  return /** @type {0 | 1 | 2} */ (idx);
}

/**
 * @param {number | null | undefined} indiceHorizonte
 */
export function esHorizonteCierre(indiceHorizonte) {
  return indiceHorizonte === HORIZONTE_CONSOLA_IDX.MES_ANTERIOR_CIERRE;
}

/**
 * Sincroniza período de URL/foco con la ventana institucional (centro = índice 1).
 * @param {string | null | undefined} periodoQuery
 * @param {string[]} ventanaTres
 * @param {string} periodoCentro
 */
export function resolverPeriodoFocoEnVentana(periodoQuery, ventanaTres, periodoCentro) {
  const p = String(periodoQuery || "").trim();
  if (p && ventanaTres.includes(p)) return p;
  const centro = String(periodoCentro || ventanaTres[1] || "").trim();
  return ventanaTres.includes(centro) ? centro : ventanaTres[1];
}

/**
 * Mes anterior sin plan existente: no se puede crear (feedback en UI).
 * @param {number | null} indiceHorizonte
 * @param {{ estadoResumen: string; cantidadItems: number }} meta
 */
export function bloqueaCrearPlanHistorico(indiceHorizonte, meta) {
  if (!esHorizonteCierre(indiceHorizonte)) return false;
  const sinPlan = meta.estadoResumen === "SIN_PLAN" || meta.cantidadItems <= 0;
  return sinPlan;
}

/**
 * Decisión de alto nivel al elegir tarjeta (paridad con `seleccionarTarjetaPlan` previa a red).
 * @param {{
 *   indiceHorizonte: number | null;
 *   estadoResumen: string;
 *   cantidadItems: number;
 *   hayAgentesPlanificados: boolean | null;
 *   principalRechazado: boolean;
 *   incorporacionEditable: boolean;
 *   principalSoloLectura: boolean;
 * }} ctx
 * @returns {{ kind: string; mensajeFeedback?: string }}
 */
export function resolverIntencionTarjetaConsola(ctx) {
  const {
    indiceHorizonte,
    estadoResumen,
    cantidadItems,
    hayAgentesPlanificados,
    principalRechazado,
    incorporacionEditable,
    principalSoloLectura,
  } = ctx;

  if (bloqueaCrearPlanHistorico(indiceHorizonte, { estadoResumen, cantidadItems })) {
    return {
      kind: "FEEDBACK_HISTORICO_SIN_PLAN",
      mensajeFeedback: "Mes anterior en modo histórico: no se pueden crear planes.",
    };
  }

  if (estadoResumen === "SIN_PLAN" || cantidadItems <= 0) {
    if (hayAgentesPlanificados === false) {
      return { kind: "ABRIR_VISTA_EQUIPO" };
    }
    return { kind: "CREAR_PLAN_NUEVO" };
  }

  if (esHorizonteCierre(indiceHorizonte)) {
    if (principalRechazado) {
      return { kind: "MODAL_OPCIONES_RECHAZADO_HISTORICO" };
    }
    return { kind: "VER_DETALLE_HISTORICO" };
  }

  if (incorporacionEditable) {
    return { kind: "EDITAR_INCORPORACION" };
  }

  if (principalSoloLectura) {
    return { kind: "VER_DETALLE" };
  }

  return { kind: "MODAL_OPCIONES_PLAN" };
}

/**
 * Ops outbox que no pertenecen al foco GDT+período actual (riesgo de preview cruzado).
 * @param {Array<Record<string, unknown>>} ops
 * @param {{ grupoId: string; periodo: string }} foco
 */
export function opsOutboxFueraDeFoco(ops, foco) {
  const gid = String(foco.grupoId || "").trim();
  const per = String(foco.periodo || "").trim();
  if (!gid || !per) return [];
  return (ops || []).filter((op) => {
    const og = String(op.grupoId || op.grupo_id || "").trim();
    const opPer = String(op.periodo || "").trim();
    return og !== gid || opPer !== per;
  });
}

/**
 * @param {Array<Record<string, unknown>>} ops
 * @param {string[]} ventanaTres
 */
export function validarOutboxCoherenteVentana(ops, ventanaTres) {
  const ventana = new Set(ventanaTres.map((p) => String(p).trim()));
  const periodosInvalidos = new Set();
  for (const op of ops || []) {
    const opPer = String(op.periodo || "").trim();
    if (opPer && !ventana.has(opPer)) {
      periodosInvalidos.add(opPer);
    }
  }
  return {
    ok: periodosInvalidos.size === 0,
    periodosInvalidos: [...periodosInvalidos],
  };
}

/**
 * Cambio de foco con ops pendientes en el contexto anterior (evita race visual).
 * @param {Array<Record<string, unknown>>} opsPendientes
 * @param {{ grupoId: string; periodo: string }} focoOrigen
 * @param {{ grupoId: string; periodo: string }} focoDestino
 */
export const COPY_CONFIRMAR_DESCARTE_OUTBOX_AL_CAMBIAR_FOCO =
  "Tenés cambios pendientes de aplicación en la grilla. Si cambiás de período o sector (o volvés a la consola), perdés las modificaciones locales. ¿Descartar los cambios y continuar?";

/**
 * @param {Array<Record<string, unknown>>} ops
 * @returns {{ grupoId: string; periodo: string }}
 */
export function inferirFocoDesdeOpsOutbox(ops) {
  const op = (ops || [])[0];
  if (!op) return { grupoId: "", periodo: "" };
  return {
    grupoId: String(op.grupoId || op.grupo_id || "").trim(),
    periodo: String(op.periodo || "").trim(),
  };
}

/**
 * @param {{ grupoId?: string; periodo?: string }} focoExplicito
 * @param {Array<Record<string, unknown>>} ops
 */
export function resolverFocoOrigenOutbox(focoExplicito, ops) {
  const g = String(focoExplicito?.grupoId || "").trim();
  const p = String(focoExplicito?.periodo || "").trim();
  if (g && p) return { grupoId: g, periodo: p };
  return inferirFocoDesdeOpsOutbox(ops);
}

export function debeAdvertirCambioFocoConOutbox(opsPendientes, focoOrigen, focoDestino) {
  const ops = opsPendientes || [];
  if (!ops.length) return false;
  const oG = String(focoOrigen.grupoId || "").trim();
  const oP = String(focoOrigen.periodo || "").trim();
  const dG = String(focoDestino.grupoId || "").trim();
  const dP = String(focoDestino.periodo || "").trim();
  if (oG === dG && oP === dP) return false;
  const enOrigen = ops.filter((op) => {
    const og = String(op.grupoId || op.grupo_id || "").trim();
    const opPer = String(op.periodo || "").trim();
    return og === oG && opPer === oP;
  });
  return enOrigen.length > 0;
}
