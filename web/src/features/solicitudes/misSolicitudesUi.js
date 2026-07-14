/**
 * Helpers puros — Mis solicitudes (agente): buckets, labels, histórico 3 meses.
 */

import {
  ARTICULO_64A_ID,
  ARTICULO_64B_ID,
  SCHEMA_SOLICITUD_MED_AVISO,
} from "../../constants/solicitudesArticuloV2.js";
import {
  CAMBIO_DIA_TITULO_UI,
  articuloEsCambioDia,
  labelEstadoSolicitudAgente as labelEstadoBase,
  ymdToDdMmYyyy,
} from "./cambioDiaUi.js";

/** Artículo CAMBIO-DIA Soft Launch (prod) — seeds/cambio_dia/applied-ids.json */
export const ARTICULO_CAMBIO_DIA_ID = "art_01KX0Z07N5PFY7ZG0ZZP93EJ8H";
/** 63-J Etapa 1 */
export const ARTICULO_63J_ID = "art_01KVWVW9Z50VR6T1BC6J0R3YQ8";

export const MIS_SOL_PAGE_SIZE = 10;

/** @typedef {"pendiente" | "autorizada" | "rechazada"} BucketEstadoSolicitud */
/** @typedef {"rose" | "slate" | "emerald" | "amber"} ChipTone */

const TZ_AR = "America/Argentina/Buenos_Aires";

/** Títulos de respaldo cuando el catálogo elegible no trae el art_* */
export const FALLBACK_TITULO_ARTICULO = Object.freeze({
  [ARTICULO_64A_ID]: "Art. 64-A",
  [ARTICULO_64B_ID]: "Art. 64-B",
  [ARTICULO_63J_ID]: "Art. 63-J",
  [ARTICULO_CAMBIO_DIA_ID]: CAMBIO_DIA_TITULO_UI,
});

/**
 * @param {string | null | undefined} estadoId
 */
export function labelEstadoSolicitudAgente(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_pendiente_clasificacion_medica") {
    return "Pendiente de clasificación médica";
  }
  if (e === "cfg_esa_esperando_dictamen_junta") {
    return "Esperando dictamen de junta médica";
  }
  if (e === "cfg_esa_en_revision_rrhh") return "Pendiente de autorización (RRHH)";
  const base = labelEstadoBase(e);
  if (base && base !== e) return base;
  if (e.includes("junta")) return "En junta médica";
  if (e.includes("medica") || e.includes("médica")) return "En trámite médica";
  return base || e || "—";
}

/**
 * @param {string | null | undefined} estadoId
 * @returns {BucketEstadoSolicitud}
 */
export function bucketEstadoSolicitud(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_aprobada") return "autorizada";
  if (e === "cfg_esa_rechazada" || e === "cfg_esa_cancelada") return "rechazada";
  return "pendiente";
}

/**
 * @param {string | null | undefined} estadoId
 * @returns {ChipTone}
 */
export function chipToneEstado(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_cancelada") return "slate";
  if (e === "cfg_esa_rechazada") return "rose";
  if (e === "cfg_esa_aprobada") return "emerald";
  if (e === "cfg_esa_aprobada_pendiente_aplicacion") return "amber";
  return "amber";
}

/**
 * @param {ChipTone} tone
 */
export function chipToneClass(tone) {
  if (tone === "rose") return "bg-rose-100 text-rose-900";
  if (tone === "emerald") return "bg-emerald-100 text-emerald-900";
  if (tone === "amber") return "bg-amber-100 text-amber-950";
  return "bg-slate-100 text-slate-800";
}

/**
 * Hoy (YMD) en zona Argentina.
 * @param {Date} [now]
 */
export function ymdHoyAr(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: TZ_AR });
}

/**
 * Corte inclusivo: hoy − 3 meses calendario (YMD AR).
 * @param {Date} [now]
 */
export function ymdCorteHistorico3Meses(now = new Date()) {
  const hoy = ymdHoyAr(now);
  const [y, m, d] = hoy.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() - 3);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * @param {unknown} creadoEn — Timestamp Firestore, Date, ISO o millis
 * @param {Date} [now]
 */
export function estaDentroHistorico3Meses(creadoEn, now = new Date()) {
  const corte = ymdCorteHistorico3Meses(now);
  const ymd = ymdDesdeCreadoEn(creadoEn);
  if (!ymd) return false;
  return ymd >= corte;
}

/**
 * @param {unknown} creadoEn
 */
export function ymdDesdeCreadoEn(creadoEn) {
  if (creadoEn == null) return "";
  if (typeof creadoEn?.toDate === "function") {
    return creadoEn.toDate().toLocaleDateString("en-CA", { timeZone: TZ_AR });
  }
  if (creadoEn instanceof Date) {
    return creadoEn.toLocaleDateString("en-CA", { timeZone: TZ_AR });
  }
  if (typeof creadoEn?.toMillis === "function") {
    return new Date(creadoEn.toMillis()).toLocaleDateString("en-CA", { timeZone: TZ_AR });
  }
  const n = Number(creadoEn);
  if (Number.isFinite(n) && n > 0) {
    return new Date(n).toLocaleDateString("en-CA", { timeZone: TZ_AR });
  }
  const s = String(creadoEn).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString("en-CA", { timeZone: TZ_AR });
  }
  return "";
}

/**
 * @param {Record<string, unknown>} sol
 * @param {{ nombre?: string, codigo_grilla?: string, codigo?: string } | null} [artElegible]
 */
export function tituloSolicitudAgente(sol, artElegible = null) {
  if (articuloEsCambioDia(sol) || sol?.es_cambio_dia === true) {
    return CAMBIO_DIA_TITULO_UI;
  }
  if (String(sol?.schema_version || "") === SCHEMA_SOLICITUD_MED_AVISO) {
    return "Aviso de licencia médica";
  }
  if (artElegible) {
    const cod = String(artElegible.codigo_grilla || artElegible.codigo || "").trim();
    const nom = String(artElegible.nombre || "").trim();
    if (cod && nom) return `${cod} — ${nom}`;
    if (nom) return nom;
    if (cod) return `Art. ${cod}`;
  }
  const artId = String(sol?.articulo_id || "").trim();
  if (FALLBACK_TITULO_ARTICULO[artId]) return FALLBACK_TITULO_ARTICULO[artId];
  const codSol = String(sol?.codigo_grilla || "").trim();
  if (codSol) return `Art. ${codSol}`;
  return "Solicitud";
}

/**
 * @param {Record<string, unknown>} sol
 */
export function textoFechasSolicitud(sol) {
  if (articuloEsCambioDia(sol) || sol?.es_cambio_dia === true) {
    const fo = ymdToDdMmYyyy(sol.fecha_origen || sol.fecha_desde);
    const fd = ymdToDdMmYyyy(sol.fecha_destino);
    if (fo && fd) return `Ausencia ${fo} → prestación ${fd}`;
    if (fo) return `Desde ${fo}`;
    return "—";
  }
  const desde = ymdToDdMmYyyy(sol.fecha_desde || sol.fecha_inicio_reposo_estimada);
  const hasta = ymdToDdMmYyyy(sol.fecha_hasta || sol.fecha_fin_reposo_estimada);
  if (desde && hasta && desde !== hasta) return `${desde} → ${hasta}`;
  if (desde) return `Desde ${desde}`;
  return "—";
}

/**
 * Rol legible del actor de rechazo (sin join a personas — rules restringen lectura).
 * @param {Record<string, unknown>} sol
 */
export function labelRolActorRechazo(sol) {
  const e = String(sol?.estado_solicitud_id || "").trim();
  if (e === "cfg_esa_cancelada") return "Cancelada por el titular o el sistema";
  if (sol?.auditor_medico_clasificacion && typeof sol.auditor_medico_clasificacion === "object") {
    const am = /** @type {Record<string, unknown>} */ (sol.auditor_medico_clasificacion);
    if (am.dictamen_favorable === false || String(sol.estado_solicitud_id) === "cfg_esa_rechazada") {
      if (String(am.auditor_persona_id || "").trim()) return "Auditoría médica";
    }
  }
  if (String(sol?.rrhh_revision_persona_id || "").trim()) return "RRHH";
  if (String(sol?.jefe_revision_persona_id || "").trim()) return "Jefatura";
  if (Array.isArray(sol?.motor_codigos) && sol.motor_codigos.length) return "Sistema (validación)";
  if (String(sol?.motivo_rechazo_id || "").trim()) return "Sistema";
  return "Autoridad competente";
}

/**
 * @param {Record<string, unknown>} sol
 */
export function motivoRechazoTexto(sol) {
  const jefe = String(sol?.jefe_motivo || "").trim();
  if (jefe) return jefe;
  const rrhh = String(sol?.rrhh_motivo || "").trim();
  if (rrhh) return rrhh;
  const det = String(sol?.motivo_rechazo_detalle || "").trim();
  if (det) return det;
  const msgs = Array.isArray(sol?.motor_mensajes)
    ? sol.motor_mensajes.map((m) => String(m || "").trim()).filter(Boolean)
    : [];
  if (msgs.length) return msgs.join(" · ");
  return "";
}

/**
 * @param {Record<string, unknown>} sol
 */
export function personaIdActorRechazo(sol) {
  const am = sol?.auditor_medico_clasificacion;
  if (am && typeof am === "object") {
    const id = String(/** @type {Record<string, unknown>} */ (am).auditor_persona_id || "").trim();
    if (/^per_/i.test(id)) return id;
  }
  const rrhh = String(sol?.rrhh_revision_persona_id || "").trim();
  if (/^per_/i.test(rrhh)) return rrhh;
  const jefe = String(sol?.jefe_revision_persona_id || "").trim();
  if (/^per_/i.test(jefe)) return jefe;
  return "";
}

/**
 * @param {Record<string, unknown>} sol
 */
export function requiereAcuseRechazo(sol) {
  if (String(sol?.estado_solicitud_id || "").trim() !== "cfg_esa_rechazada") return false;
  if (sol?.agente_acuse_rechazo_en) return false;
  return estaDentroHistorico3Meses(sol?.creado_en);
}
