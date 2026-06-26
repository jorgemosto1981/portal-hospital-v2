/**
 * Escrituras mínimas en `solicitudes_articulo` (V2).
 * @see web/src/services/firebase.js — dbV2
 */
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ulid } from "ulid";

import {
  ESTADO_SOLICITUD_ARTICULO_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_ARTICULO_RECHAZADA,
} from "../constants/solicitudesArticuloV2.js";
import {
  buildSolicitudPatronBBorradorDocument,
  buildSolicitudPatronCBorradorDocument,
} from "../schemas/solicitudArticuloCreate.schema.js";
import { dbV2 } from "./firebase.js";

const SOL_ULID_RE = /^sol_[0-9A-HJKMNP-TV-Z]{26}$/i;

/**
 * Crea solicitud LAO en estado BORRADOR (el trigger del backend valida y cambia estado).
 * @param {{
 *   personaId: string,
 *   actorAltaId?: string,
 *   articuloId: string,
 *   versionAplicadaId: string,
 *   fechaDesde: string,
 *   fechaHasta?: string,
 *   diasSolicitados?: number,
 *   anioOrigenBolsa: number,
 *   grupoTrabajoIdAncla?: string,
 *   resumenComputo?: Record<string, unknown> | null,
 * }} params
 * @returns {Promise<{ solicitud_id: string }>}
 */
export async function crearSolicitudArticuloLaoBorrador(params) {
  const personaId = String(params.personaId || "").trim();
  const actorAltaId = String(params.actorAltaId || params.personaId || "").trim();
  const articuloId = String(params.articuloId || "").trim();
  const versionAplicadaId = String(params.versionAplicadaId || "").trim();
  const fechaDesde = String(params.fechaDesde || "").trim().slice(0, 10);
  const fechaHasta = String(params.fechaHasta || params.fechaDesde || "").trim().slice(0, 10);
  const diasSolicitadosRaw = params.diasSolicitados;
  const anioOrigenBolsa = Number(params.anioOrigenBolsa);
  const resumenComputo =
    params.resumenComputo && typeof params.resumenComputo === "object" ? params.resumenComputo : null;

  if (!/^per_/i.test(personaId)) {
    throw new Error("persona_id inválido.");
  }
  if (!/^per_/i.test(actorAltaId)) {
    throw new Error("actor_alta_persona_id inválido.");
  }
  if (!/^art_/i.test(articuloId)) {
    throw new Error("articulo_id inválido.");
  }
  if (!/^ver_/i.test(versionAplicadaId)) {
    throw new Error("version_aplicada inválida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
    throw new Error("fecha_desde inválida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    throw new Error("fecha_hasta inválida.");
  }
  if (fechaHasta < fechaDesde) {
    throw new Error("fecha_hasta no puede ser anterior a fecha_desde.");
  }
  if (!Number.isInteger(anioOrigenBolsa) || anioOrigenBolsa < 1900) {
    throw new Error("anio_origen_bolsa inválido.");
  }

  const grupoTrabajoIdAncla = String(params.grupoTrabajoIdAncla || "").trim();
  if (grupoTrabajoIdAncla && !/^gdt_/i.test(grupoTrabajoIdAncla)) {
    throw new Error("grupo_trabajo_id_ancla inválido.");
  }

  const solicitud_id = `sol_${ulid()}`;
  if (!SOL_ULID_RE.test(solicitud_id)) {
    throw new Error("No se pudo generar solicitud_id.");
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    articulo_id: articuloId,
    titular_persona_id: personaId,
    actor_alta_persona_id: actorAltaId,
    version_aplicada: versionAplicadaId,
    fecha_desde: fechaDesde,
    anio_origen_bolsa: anioOrigenBolsa,
    estado_solicitud_id: "cfg_esa_borrador",
    schema_version: 1,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  };

  if (fechaHasta !== fechaDesde || params.fechaHasta != null) {
    payload.fecha_hasta = fechaHasta;
  }

  const dias = Number(diasSolicitadosRaw);
  if (Number.isInteger(dias) && dias >= 1) {
    payload.dias_solicitados = dias;
  }

  if (resumenComputo) {
    payload.resumen_computo_snapshot = resumenComputo;
  }

  if (grupoTrabajoIdAncla) {
    payload.grupo_trabajo_id_ancla = grupoTrabajoIdAncla;
  }

  const ref = doc(dbV2, "solicitudes_articulo", solicitud_id);
  await setDoc(ref, payload);

  return { solicitud_id };
}

/**
 * Crea solicitud Patrón B (64-A MVP) en BORRADOR; trigger valida y descuenta saldo.
 * @param {{
 *   personaId: string,
 *   articuloId: string,
 *   versionIdAplicada: string,
 *   fechaDesde: string,
 *   diasSolicitados?: number,
 *   grupoTrabajoIdAncla: string,
 * }} params
 */
export async function crearSolicitudArticuloPatronBBorrador(params) {
  const payload = buildSolicitudPatronBBorradorDocument(
    {
      personaId: params.personaId,
      articuloId: params.articuloId,
      versionIdAplicada: params.versionIdAplicada,
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      diasSolicitados: Number(params.diasSolicitados ?? 1),
      grupoTrabajoIdAncla: params.grupoTrabajoIdAncla,
      opcionConsumoId: params.opcionConsumoId,
    },
    { creado_en: serverTimestamp(), actualizado_en: serverTimestamp() },
  );

  const solicitud_id = `sol_${ulid()}`;
  if (!SOL_ULID_RE.test(solicitud_id)) {
    throw new Error("No se pudo generar solicitud_id.");
  }

  const ref = doc(dbV2, "solicitudes_articulo", solicitud_id);
  await setDoc(ref, payload);

  return { solicitud_id };
}

const ESTADOS_MOTOR_FINAL = new Set([
  ESTADO_SOLICITUD_ARTICULO_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_ARTICULO_RECHAZADA,
]);

/**
 * Espera a que el trigger Patrón B actualice el estado (sale de borrador).
 * @param {string} solicitudId
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 */
export async function esperarValidacionMotorPatronB(solicitudId, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const intervalMs = opts.intervalMs ?? 800;
  const ref = doc(dbV2, "solicitudes_articulo", solicitudId);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() || {};
      const estado = String(d.estado_solicitud_id || "").trim();
      if (ESTADOS_MOTOR_FINAL.has(estado)) {
        if (estado === ESTADO_SOLICITUD_ARTICULO_RECHAZADA) {
          const msgs = Array.isArray(d.motor_mensajes) ? d.motor_mensajes.filter(Boolean) : [];
          throw new Error(msgs[0] || "La solicitud fue rechazada por el validador.");
        }
        return { estado_solicitud_id: estado, solicitud: d };
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("El validador no respondió a tiempo. Revisá el estado de la solicitud más tarde.");
}

// ---------------------------------------------------------------------------
// Patrón C — Cuenta corriente continua (horas, saldo global)
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   personaId: string,
 *   articuloId: string,
 *   versionIdAplicada: string,
 *   fechaDesde: string,
 *   fechaHasta: string,
 *   horasSolicitadas: number,
 *   grupoTrabajoIdAncla: string,
 * }} params
 */
export async function crearSolicitudArticuloPatronCBorrador(params) {
  const payload = buildSolicitudPatronCBorradorDocument(
    {
      personaId: params.personaId,
      articuloId: params.articuloId,
      versionIdAplicada: params.versionIdAplicada,
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      horasSolicitadas: params.horasSolicitadas,
      grupoTrabajoIdAncla: params.grupoTrabajoIdAncla,
    },
    { creado_en: serverTimestamp(), actualizado_en: serverTimestamp() },
  );

  const solicitud_id = `sol_${ulid()}`;
  if (!SOL_ULID_RE.test(solicitud_id)) {
    throw new Error("No se pudo generar solicitud_id.");
  }

  const ref = doc(dbV2, "solicitudes_articulo", solicitud_id);
  await setDoc(ref, payload);

  return { solicitud_id };
}

/**
 * Espera a que el trigger Patrón C actualice el estado.
 * Reutiliza la misma lógica de polling que Patrón B.
 */
export { esperarValidacionMotorPatronB as esperarValidacionMotorPatronC };
