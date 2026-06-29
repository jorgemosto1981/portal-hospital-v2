"use strict";

const { FieldValue, Timestamp } = require("./context");
const {
  PARAM_LM_INCOMPLETA_PLAZO_HORAS,
  calcularVencimientoPlazoCertificado,
  resolverHorasDesdeParametroSistema,
} = require("./licenciaMedicaParametrosCore");

function vencDateToIso(venc) {
  if (venc && typeof venc.toDate === "function") {
    return venc.toDate().toISOString();
  }
  return null;
}

/**
 * @param {unknown} raw
 */
function normalizarDeclaracionContactoAviso(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const cel = String(o.telefono_celular || "").trim();
  const dom = String(o.domicilio_declarado || "").trim();
  const mail = String(o.email || "").trim();
  if (cel.length < 6 || dom.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return null;
  }
  const fijo = String(o.telefono_fijo || "").trim();
  return {
    usar_datos_perfil: o.usar_datos_perfil === true,
    telefono_celular: cel.slice(0, 32),
    ...(fijo ? { telefono_fijo: fijo.slice(0, 32) } : {}),
    domicilio_declarado: dom.slice(0, 512),
    permanece_en_domicilio: o.permanece_en_domicilio === true,
    usar_email_perfil: o.usar_email_perfil === true,
    email: mail.slice(0, 256),
  };
}

const {
  ESTADO_PENDIENTE_CLASIFICACION,
  SCHEMA_MED_AVISO,
  MAX_AVISOS_PROVISORIOS_VIGENTES,
  listarAvisosIncompletosVigentes,
} = require("./avisoMedicoProvisoriosVigentesCore");
const { validarPeriodoExclusivoAvisoMedico } = require("./avisoMedicoExclusividadValidacion");
const { resincronizarProyeccionAvisoMedicoGrillaAsync } = require("./avisoMedicoGrillaMdcCore");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function leerPlazoHorasLicenciaIncompleta(db) {
  const snap = await db.collection("cfg_parametros_sistema").doc(PARAM_LM_INCOMPLETA_PLAZO_HORAS).get();
  return resolverHorasDesdeParametroSistema(snap.exists ? snap.data() : null);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} titularPersonaId
 */
async function buscarAvisoIncompletaVigente(db, titularPersonaId) {
  const titular = String(titularPersonaId || "").trim();
  if (!/^per_/i.test(titular)) {
    return { ok: false, codigo: "TITULAR_INVALIDO" };
  }
  const avisos = await listarAvisosIncompletosVigentes(db, titular);
  const permiteNuevo = avisos.length < MAX_AVISOS_PROVISORIOS_VIGENTES;
  if (!avisos.length) {
    return {
      ok: false,
      codigo: "SIN_AVISO_INCOMPLETA_VIGENTE",
      avisos: [],
      max_provisorios_vigentes: MAX_AVISOS_PROVISORIOS_VIGENTES,
      permite_nuevo_provisorio: true,
    };
  }
  const primero = avisos[0];
  return {
    ok: true,
    avisos,
    count: avisos.length,
    max_provisorios_vigentes: MAX_AVISOS_PROVISORIOS_VIGENTES,
    permite_nuevo_provisorio: permiteNuevo,
    solicitud_id: primero.solicitud_id,
    resumen: primero.resumen,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solicitudId: string,
 *   titularPersonaId: string,
 *   adjuntos: Array<{ storage_path: string, content_type?: string, nombre_archivo?: string }>,
 *   fechaInicioReposoEstimada?: string,
 *   fechaFinReposoEstimada?: string,
 *   declaracionClinica?: { sintomas?: string, enfermedad?: string, codigo_cie?: string, detalle?: string },
 *   declaracionContacto?: {
 *     usar_datos_perfil: boolean,
 *     telefono_celular: string,
 *     telefono_fijo?: string,
 *     domicilio_declarado: string,
 *     permanece_en_domicilio: boolean,
 *     usar_email_perfil: boolean,
 *     email: string,
 *   },
 * }} input
 */
async function actualizarAvisoMedicoIncompleto(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  const titularPersonaId = String(input.titularPersonaId || "").trim();
  const adjuntos = Array.isArray(input.adjuntos) ? input.adjuntos : [];

  if (!/^sol_/i.test(solicitudId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO", mensaje: "solicitud_id inválido." };
  }
  if (!/^per_/i.test(titularPersonaId)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "Titular inválido." };
  }
  if (!adjuntos.length || !adjuntos.every((a) => a && typeof a.storage_path === "string" && a.storage_path.trim())) {
    return { ok: false, codigo: "ADJUNTO_REQUERIDO", mensaje: "Debés adjuntar al menos un certificado." };
  }

  const ref = db.collection("solicitudes_articulo").doc(solicitudId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADA", mensaje: "Solicitud no encontrada." };
  }

  const d = snap.data() || {};
  if (d.titular_persona_id !== titularPersonaId) {
    return { ok: false, codigo: "NO_TITULAR", mensaje: "No podés modificar esta solicitud." };
  }
  if (d.estado_solicitud_id !== ESTADO_PENDIENTE_CLASIFICACION) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud ya no está pendiente de clasificación." };
  }
  if (d.schema_version !== SCHEMA_MED_AVISO) {
    return { ok: false, codigo: "SCHEMA_INVALIDO", mensaje: "No es un aviso médico Caja Negra." };
  }

  const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : {};
  if (ing.es_licencia_incompleta !== true) {
    return { ok: false, codigo: "YA_COMPLETA", mensaje: "Esta solicitud ya no es un aviso incompleto." };
  }

  const venc = d.vencimiento_plazo_certificado;
  const vencDate = venc && typeof venc.toDate === "function" ? venc.toDate() : null;
  if (!vencDate || Date.now() >= vencDate.getTime()) {
    return {
      ok: false,
      codigo: "LICENCIA_INCOMPLETA_VENCIDA",
      mensaje: "Venció el plazo para completar el certificado. Contactá a RRHH.",
    };
  }

  const fechaInicio = String(d.fecha_inicio_reposo_estimada || "").slice(0, 10);
  const fechaDesdeAnterior = fechaInicio;
  const fechaHastaAnterior = String(d.fecha_fin_reposo_estimada || fechaInicio || "").slice(0, 10);

  const fechaFin =
    typeof input.fechaFinReposoEstimada === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.fechaFinReposoEstimada.trim())
      ? input.fechaFinReposoEstimada.trim()
      : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return { ok: false, codigo: "FECHA_INICIO_REQUERIDA", mensaje: "Fecha de inicio del reposo inválida." };
  }
  if (!fechaFin || fechaFin < fechaInicio) {
    return {
      ok: false,
      codigo: "FECHA_FIN_REQUERIDA",
      mensaje: "Indicá la fecha de fin de licencia (igual o posterior al inicio).",
    };
  }

  const clinIn = input.declaracionClinica && typeof input.declaracionClinica === "object" ? input.declaracionClinica : {};
  const tieneClin =
    Boolean(String(clinIn.sintomas || "").trim()) ||
    Boolean(String(clinIn.enfermedad || "").trim()) ||
    Boolean(String(clinIn.codigo_cie || "").trim());
  if (!tieneClin) {
    return {
      ok: false,
      codigo: "CLINICA_REQUERIDA",
      mensaje: "Indicá síntomas, enfermedad o código CIE al completar el aviso.",
    };
  }

  const contactoNorm = normalizarDeclaracionContactoAviso(input.declaracionContacto);
  if (!contactoNorm) {
    return {
      ok: false,
      codigo: "CONTACTO_REQUERIDO",
      mensaje: "Confirmá teléfono, domicilio y correo de contacto para el aviso.",
    };
  }

  const exclusividad = await validarPeriodoExclusivoAvisoMedico(db, {
    titularPersonaId,
    fechaDesde: fechaInicio,
    fechaHasta: fechaFin,
    excludeSolicitudId: solicitudId,
  });
  if (!exclusividad.ok) {
    return exclusividad;
  }

  const ingresoActualizado = {
    ...ing,
    adjuntos: adjuntos.map((a) => ({
      storage_path: String(a.storage_path).trim(),
      ...(a.content_type ? { content_type: String(a.content_type).slice(0, 128) } : {}),
      ...(a.nombre_archivo ? { nombre_archivo: String(a.nombre_archivo).slice(0, 256) } : {}),
    })),
    es_licencia_incompleta: false,
    completado_en: FieldValue.serverTimestamp(),
    declaracion_clinica: {
      ...(clinIn.sintomas ? { sintomas: String(clinIn.sintomas).slice(0, 2000) } : {}),
      ...(clinIn.enfermedad ? { enfermedad: String(clinIn.enfermedad).slice(0, 500) } : {}),
      ...(clinIn.codigo_cie ? { codigo_cie: String(clinIn.codigo_cie).slice(0, 16) } : {}),
      ...(clinIn.detalle ? { detalle: String(clinIn.detalle).slice(0, 2000) } : {}),
    },
    declaracion_contacto: contactoNorm,
  };

  const patch = {
    ingreso_medico: ingresoActualizado,
    actualizado_en: FieldValue.serverTimestamp(),
    fecha_inicio_reposo_estimada: fechaInicio,
    fecha_fin_reposo_estimada: fechaFin,
  };

  await ref.update(patch);

  resincronizarProyeccionAvisoMedicoGrillaAsync(db, solicitudId, {
    fechaDesdeAnterior,
    fechaHastaAnterior,
  });

  return {
    ok: true,
    solicitud_id: solicitudId,
    estado_solicitud_id: ESTADO_PENDIENTE_CLASIFICACION,
    mensaje_ui: "Certificado registrado. Medicina laboral clasificará tu caso.",
  };
}

module.exports = {
  ESTADO_PENDIENTE_CLASIFICACION,
  SCHEMA_MED_AVISO,
  MAX_AVISOS_PROVISORIOS_VIGENTES,
  leerPlazoHorasLicenciaIncompleta,
  normalizarDeclaracionContactoAviso,
  buscarAvisoIncompletaVigente,
  actualizarAvisoMedicoIncompleto,
  calcularVencimientoPlazoCertificado,
};
