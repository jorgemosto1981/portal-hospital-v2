"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./shared/context");
const { ymdDesdeValorLaboral } = require("./shared/fechaLaboralYmd");

const COLECCIONES_PUBLICAS_TEMPORALES = new Set([
  "grupos_de_trabajo",
  "cfg_efectores",
  "historial_laboral_cargos",
  "historial_laboral_datos",
  "historial_laboral_grupos",
  "personas",
  "formacion_agente",
  "declaraciones_grupo_familiar",
  "consentimientos",
  "eventos_ticket",
  "cfg_estado_civil",
  "cfg_nacionalidad",
  "cfg_sexo_genero",
  "cfg_provincia",
  "cfg_localidad",
  "cfg_pais",
  "cfg_nivel_estudios",
  "cfg_parentesco",
  "cfg_estado_auditoria_familiar",
  "cfg_motivo_rechazo_familiar",
  "cfg_estado_perfil_datos",
  "cfg_estado_asignacion_laboral",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_categorias",
  "cfg_cargo_funcional",
  "cfg_tipo_vinculo_laboral",
  "cfg_modalidad_jornada",
  "cfg_regimen_horario",
  "cfg_centro_costo",
  "cfg_causal_fin_asignacion_laboral",
  "cfg_motivo_deshabilitacion_hlc",
  "cfg_dia_semana",
  "cfg_tipo_acto_designacion",
  "cfg_motivo_baja_persona",
  "cfg_especialidad",
  "cfg_colegio",
  "cfg_jurisdiccion_matricula",
  "cfg_rol",
  "cfg_estado_declaracion_ddjj",
  "cfg_tipo_evento",
  "cfg_estado_bandeja_rrhh",
  "cfg_tipo_consentimiento",
  "cfg_textos_legales",
  "cfg_idioma",
]);

const COLECCIONES_ESCRITURA_LABORAL_TEMPORAL = new Set([
  "historial_laboral_cargos",
  "historial_laboral_datos",
  "historial_laboral_grupos",
]);

const COLECCIONES_ESCRITURA_PERSONAL_TEMPORAL = new Set([
  "personas",
  "formacion_agente",
  "declaraciones_grupo_familiar",
  "consentimientos",
]);

const ESTADO_DDJJ_DEFAULT_PERSONALES = "CFG_DDJJ_01_NO_INICIADA";
const ESTADO_PERFIL_DEFAULT_PERSONAS = "cfg_epd_inc";
const ESTADO_PERFIL_FALLBACK_PERSONAS = "cfg_epd_borr";
const ESTADO_PERFIL_COMPLETO = "cfg_epd_comp";
const ESTADO_ACCESO_ACTIVO = "cfg_eca_activo";
const RX_GDT_ID_V2 = /^gdt_[0-9A-HJKMNP-TV-Z]{26}$/;
const RX_GDT_ID_LEGACY = /^GT_[A-Z0-9_]+$/;

function toNullableTrimmedString(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toNumberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ymdLaboralOrNull(v) {
  const y = ymdDesdeValorLaboral(v);
  return y || null;
}

function hasRangoSolapado({ desdeA, hastaA, desdeB, hastaB }) {
  const inicioA = ymdLaboralOrNull(desdeA);
  const finA = ymdLaboralOrNull(hastaA) || "9999-12-31";
  const inicioB = ymdLaboralOrNull(desdeB);
  const finB = ymdLaboralOrNull(hastaB) || "9999-12-31";
  if (!inicioA || !inicioB) return false;
  return inicioA <= finB && inicioB <= finA;
}

function isRangoInvalido(desde, hasta) {
  const inicio = ymdLaboralOrNull(desde);
  const fin = ymdLaboralOrNull(hasta);
  if (!inicio || !fin) return false;
  return inicio > fin;
}

function derivarCargaSemanalDesdeRegimen(regimenDoc) {
  if (!regimenDoc || typeof regimenDoc !== "object") return null;
  const tipo = regimenDoc.tipo_patron;
  if (tipo === "fijo") {
    const dias = regimenDoc.dias;
    if (!Array.isArray(dias)) return null;
    return dias.reduce((acc, d) => {
      const h = d && d.turno && typeof d.turno.horas_efectivas === "number" ? d.turno.horas_efectivas : 0;
      return acc + h;
    }, 0);
  }
  if (tipo === "rotativo") {
    const ciclo = regimenDoc.ciclo;
    if (!Array.isArray(ciclo) || ciclo.length === 0) return null;
    const sumaCiclo = ciclo.reduce((acc, pos) => {
      const h = pos && pos.turno && typeof pos.turno.horas_efectivas === "number" ? pos.turno.horas_efectivas : 0;
      return acc + h;
    }, 0);
    return (sumaCiclo / ciclo.length) * 7;
  }
  if (tipo === "planificado") {
    const v = regimenDoc.carga_horaria_semanal_teorica;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return null;
}

function pushWarning(warnings, code, message, details) {
  if (!Array.isArray(warnings)) return;
  const payload = { code, severity: "warning", message };
  if (details && typeof details === "object") payload.details = details;
  warnings.push(payload);
}


function normalizeGrupoTrabajoIdV2(id) {
  const raw = toNullableTrimmedString(id);
  if (!raw) throw new HttpsError("invalid-argument", "El id es obligatorio.");
  if (RX_GDT_ID_LEGACY.test(raw)) return raw;
  if (!RX_GDT_ID_V2.test(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "ID inválido para grupos_de_trabajo. Regla V2: gdt_<ULID> (ej: gdt_01H...).",
    );
  }
  return raw;
}

async function assertDocExistsOrNull(collectionName, docId, label) {
  if (!docId) return;
  const snap = await db.collection(collectionName).doc(docId).get();
  if (!snap.exists) throw new HttpsError("invalid-argument", `${label} inválido o inexistente: ${docId}`);
}

async function resolveEstadoPerfilDatosIdDefault(rawEstadoPerfilId) {
  const incoming = toNullableTrimmedString(rawEstadoPerfilId);
  if (incoming) {
    await assertDocExistsOrNull("cfg_estado_perfil_datos", incoming, "estado_perfil_datos_id");
    return incoming;
  }
  const preferredSnap = await db.collection("cfg_estado_perfil_datos").doc(ESTADO_PERFIL_DEFAULT_PERSONAS).get();
  if (preferredSnap.exists) return ESTADO_PERFIL_DEFAULT_PERSONAS;
  const fallbackSnap = await db.collection("cfg_estado_perfil_datos").doc(ESTADO_PERFIL_FALLBACK_PERSONAS).get();
  if (fallbackSnap.exists) return ESTADO_PERFIL_FALLBACK_PERSONAS;
  throw new HttpsError(
    "failed-precondition",
    "Falta seed de cfg_estado_perfil_datos (esperado: cfg_epd_inc o cfg_epd_borr).",
  );
}

async function findSolapeHlc({ id, personaId, fechaDesde, fechaHasta }) {
  const snap = await db.collection("historial_laboral_cargos").where("persona_id", "==", personaId).get();
  const desdeNorm = ymdLaboralOrNull(fechaDesde);
  const candidatos = snap.docs.filter((doc) => {
    if (doc.id === id) return false;
    const hastaB = ymdLaboralOrNull(doc.get("fecha_hasta"));
    if (!hastaB) return true;
    if (!desdeNorm) return true;
    return hastaB >= desdeNorm;
  });
  return (
    candidatos.find((doc) =>
      hasRangoSolapado({
        desdeA: fechaDesde,
        hastaA: fechaHasta,
        desdeB: doc.get("fecha_desde"),
        hastaB: doc.get("fecha_hasta"),
      }),
    ) || null
  );
}


async function findSolapeHlgMismoCargo({ id, grupoId, cargoId, fechaInicio, fechaFin }) {
  if (!grupoId || !cargoId) return null;
  const hldSnap = await db.collection("historial_laboral_datos").where("cargo_id", "==", cargoId).get();
  if (hldSnap.empty) return null;
  const hldIds = hldSnap.docs.map((doc) => String(doc.id));
  const snap = await db.collection("historial_laboral_grupos").where("grupo_de_trabajo_id", "==", grupoId).get();
  return (
    snap.docs.find((doc) => {
      if (doc.id === id) return false;
      const datoLaboralId = toNullableTrimmedString(doc.get("dato_laboral_id"));
      if (!datoLaboralId || !hldIds.includes(datoLaboralId)) return false;
      return hasRangoSolapado({
        desdeA: fechaInicio,
        hastaA: fechaFin,
        desdeB: doc.get("fecha_inicio"),
        hastaB: doc.get("fecha_fin"),
      });
    }) || null
  );
}

async function assertHlgDentroDeHlc({ fechaInicioHlg, fechaFinHlg, fechaDesdeHlc, fechaHastaHlc }) {
  const inicioHlg = ymdLaboralOrNull(fechaInicioHlg);
  const finHlg = ymdLaboralOrNull(fechaFinHlg);
  const inicioHlc = ymdLaboralOrNull(fechaDesdeHlc);
  const finHlc = ymdLaboralOrNull(fechaHastaHlc);
  if (!inicioHlg || !inicioHlc) return;
  if (inicioHlg < inicioHlc) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLG-003] La asignacion a grupo comienza antes que el periodo del cargo. Ajusta la fecha de inicio del grupo o la del cargo.",
    );
  }
  if (!finHlc) return;
  if (!finHlg) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLG-004] El cargo esta cerrado y la asignacion a grupo quedo abierta. Debes informar fecha de fin en la asignacion.",
    );
  }
  if (finHlg > finHlc) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLG-004] La fecha de fin de la asignacion a grupo supera la fecha de fin del cargo. Ajusta el periodo para que quede dentro del cargo.",
    );
  }
}

async function assertHldDentroDeHlc({ fechaInicioHld, fechaFinHld, fechaDesdeHlc, fechaHastaHlc }) {
  const inicioHld = ymdLaboralOrNull(fechaInicioHld);
  const finHld = ymdLaboralOrNull(fechaFinHld);
  const inicioHlc = ymdLaboralOrNull(fechaDesdeHlc);
  const finHlc = ymdLaboralOrNull(fechaHastaHlc);
  if (!inicioHld || !inicioHlc) return;
  if (inicioHld < inicioHlc) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLD-004] El detalle laboral comienza antes que el periodo del cargo. Ajusta la fecha de inicio del detalle o la del cargo.",
    );
  }
  if (!finHlc) return;
  if (!finHld) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLD-004] El cargo esta cerrado y el detalle laboral quedo abierto. Debes informar fecha de fin en el detalle.",
    );
  }
  if (finHld > finHlc) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLD-004] La fecha de fin del detalle laboral supera la fecha de fin del cargo. Ajusta el periodo para que quede dentro del cargo.",
    );
  }
}

async function buildWarningReconciliacionCarga({
  id,
  cargoId,
  cargaSemanalActual,
  cargaHorariaTotalHlc,
  epsilon = 0.01,
}) {
  const objetivo = toNumberOrNull(cargaHorariaTotalHlc);
  if (objetivo == null) return null;
  if (!cargoId) return null;
  const hldSnap = await db.collection("historial_laboral_datos").where("cargo_id", "==", cargoId).get();
  if (hldSnap.empty) return null;
  const hldIds = hldSnap.docs.map((doc) => String(doc.id));
  const hlgSnap = await db.collection("historial_laboral_grupos").get();
  const otrosHlg = hlgSnap.docs.filter((doc) => {
    if (doc.id === id) return false;
    const datoLaboralId = toNullableTrimmedString(doc.get("dato_laboral_id"));
    return datoLaboralId && hldIds.includes(datoLaboralId);
  });
  const regimenIds = [...new Set(otrosHlg.map((doc) => toNullableTrimmedString(doc.get("regimen_horario_id"))).filter(Boolean))];
  const regimenesMap = new Map();
  if (regimenIds.length > 0) {
    const refs = regimenIds.map((rid) => db.collection("cfg_regimen_horario").doc(rid));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => { if (s.exists) regimenesMap.set(s.id, s.data()); });
  }
  const acumuladoExistente = otrosHlg.reduce((acc, doc) => {
    const rid = toNullableTrimmedString(doc.get("regimen_horario_id"));
    const reg = rid ? regimenesMap.get(rid) : null;
    const h = derivarCargaSemanalDesdeRegimen(reg);
    return acc + (h != null ? h : 0);
  }, 0);
  const actual = cargaSemanalActual != null ? cargaSemanalActual : 0;
  const total = acumuladoExistente + actual;
  if (Math.abs(total - objetivo) <= epsilon) return null;
  return {
    code: "VAL-HLG-W003",
    severity: "warning",
    message: `Advertencia: la suma semanal de horas en asignaciones a grupo (${total}) no coincide con la carga horaria total del cargo (${objetivo}).`,
    details: { total_hlg: total, carga_horaria_total_hlc: objetivo, epsilon },
  };
}

async function assertConsistenciaEstadoPerfilCuenta(personaId, estadoPerfilDatosId) {
  if (!personaId || !estadoPerfilDatosId) return;
  const cuentaSnap = await db.collection("usuarios_cuenta").where("persona_id", "==", personaId).limit(1).get();
  if (cuentaSnap.empty) return;
  const estadoAccesoId = toNullableTrimmedString(cuentaSnap.docs[0].get("estado_acceso"));
  if (estadoPerfilDatosId === ESTADO_PERFIL_COMPLETO && estadoAccesoId !== ESTADO_ACCESO_ACTIVO) {
    throw new HttpsError(
      "failed-precondition",
      `[VAL-PER-003] Inconsistencia de estado: perfil completo (${ESTADO_PERFIL_COMPLETO}) requiere estado_acceso=${ESTADO_ACCESO_ACTIVO}.`,
    );
  }
}

function hasFamiliarIncompleto(familiares) {
  return (familiares || []).some((f) => {
    if (!f || typeof f !== "object") return true;
    const hasAny =
      !!toNullableTrimmedString(f.parentesco_id) ||
      !!toNullableTrimmedString(f.nombre) ||
      !!toNullableTrimmedString(f.apellido);
    if (!hasAny) return false;
    return (
      !toNullableTrimmedString(f.parentesco_id) ||
      !toNullableTrimmedString(f.nombre) ||
      !toNullableTrimmedString(f.apellido)
    );
  });
}

module.exports = {
  COLECCIONES_PUBLICAS_TEMPORALES,
  COLECCIONES_ESCRITURA_LABORAL_TEMPORAL,
  COLECCIONES_ESCRITURA_PERSONAL_TEMPORAL,
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  normalizeGrupoTrabajoIdV2,
  toNullableTrimmedString,
  toNumberOrNull,
  isRangoInvalido,
  derivarCargaSemanalDesdeRegimen,
  assertDocExistsOrNull,
  resolveEstadoPerfilDatosIdDefault,
  findSolapeHlc,
  findSolapeHlgMismoCargo,
  assertHlgDentroDeHlc,
  assertHldDentroDeHlc,
  buildWarningReconciliacionCarga,
  assertConsistenciaEstadoPerfilCuenta,
  pushWarning,
  hasFamiliarIncompleto,
};
