import { paresCeldaDesdeOp } from "../../../../shared/utils/grillaMesNodos/index.js";
import { sanearMaterializacionDiaSiNecesario } from "../../services/grillaSanacionMaterializacionService.js";

/** Evita colgar el overlay si un callable de sanación no responde. */
const SANEAR_DIA_TIMEOUT_MS = 28_000;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("sanear-timeout")), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Tras batch de gestión de turno: fuerza recálculo analítica + presentación por tramo
 * en todos los días persona×fecha afectados (origen y destino en traslados).
 * @param {Record<string, unknown>} op
 */
export async function refrescarAnaliticaFichadaDiasTrasOp(op) {
  const pares = paresCeldaDesdeOp(op);
  const visto = new Set();
  /** @type {Promise<void>[]} */
  const tareas = [];
  for (const par of pares) {
    const k = `${par.persona_id}|${par.fecha_ymd}|${par.gdt}`;
    if (visto.has(k)) continue;
    visto.add(k);
    tareas.push(
      withTimeout(
        sanearMaterializacionDiaSiNecesario({
          persona_id: par.persona_id,
          fecha: par.fecha_ymd,
          grupo_trabajo_id: par.gdt,
          aplicar_si_desalineado: false,
          forzar_recalculo_fichada: true,
        }),
        SANEAR_DIA_TIMEOUT_MS,
      ).catch(() => {
        /* no bloquear parche si un día falla o excede tiempo */
      }),
    );
  }
  await Promise.all(tareas);
  return pares;
}
