"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("./shared/context");
const runtimeFlags = require("./shared/runtimeFlags.json");
const { assertRrhh, normalizeCatalogDocId, serializeFirestoreValue } = require("./shared/helpers");

const COL = "cfg_regimen_horario";
const TIPOS_PATRON = new Set(["fijo", "rotativo", "planificado"]);
const TIPOS_DIA = new Set(["laborable", "guardia", "no_laborable", "franco"]);
const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_PREFIX_RE = /^CFG_REG_HOR_/;

function err(code, msg) {
  throw new HttpsError(code, msg);
}

function assertHHMM(val, campo) {
  if (typeof val !== "string" || !HH_MM_RE.test(val)) err("invalid-argument", `${campo}: formato HH:MM requerido.`);
}

function assertNumRange(val, campo, min, max, nullable = false) {
  if (nullable && (val === null || val === undefined)) return;
  if (typeof val !== "number" || val < min || val > max) err("invalid-argument", `${campo}: número entre ${min} y ${max}.`);
}

function assertBool(val, campo) {
  if (typeof val !== "boolean") err("invalid-argument", `${campo}: booleano requerido.`);
}

function assertStr(val, campo, maxLen = 500) {
  if (typeof val !== "string" || val.trim().length === 0 || val.length > maxLen)
    err("invalid-argument", `${campo}: texto 1-${maxLen} chars.`);
}

function validarBandaHoraria(b, path) {
  if (b === null || b === undefined) return null;
  if (typeof b !== "object") err("invalid-argument", `${path}: objeto o null.`);
  assertHHMM(b.desde, `${path}.desde`);
  assertHHMM(b.hasta, `${path}.hasta`);
  return { desde: b.desde, hasta: b.hasta };
}

function validarDescanso(d, path) {
  if (d === null || d === undefined) return null;
  if (typeof d !== "object") err("invalid-argument", `${path}: objeto o null.`);
  assertNumRange(d.duracion_min, `${path}.duracion_min`, 0, 120);
  assertBool(d.es_pago, `${path}.es_pago`);
  assertNumRange(d.despues_de_horas, `${path}.despues_de_horas`, 0, 24);
  return {
    duracion_min: Math.round(d.duracion_min),
    es_pago: d.es_pago,
    despues_de_horas: d.despues_de_horas,
  };
}

function validarTurno(t, path) {
  if (t === null || t === undefined) return null;
  if (typeof t !== "object") err("invalid-argument", `${path}: objeto turno requerido.`);
  assertHHMM(t.ingreso, `${path}.ingreso`);
  assertHHMM(t.egreso, `${path}.egreso`);
  assertNumRange(t.horas_efectivas, `${path}.horas_efectivas`, 0, 24);
  const es_nocturno = t.es_nocturno === true;
  const tolerancia_ingreso_min = typeof t.tolerancia_ingreso_min === "number" ? t.tolerancia_ingreso_min : 0;
  const tolerancia_egreso_min = typeof t.tolerancia_egreso_min === "number" ? t.tolerancia_egreso_min : 0;
  assertNumRange(tolerancia_ingreso_min, `${path}.tolerancia_ingreso_min`, 0, 60);
  assertNumRange(tolerancia_egreso_min, `${path}.tolerancia_egreso_min`, 0, 60);
  return {
    ingreso: t.ingreso,
    egreso: t.egreso,
    horas_efectivas: t.horas_efectivas,
    es_nocturno,
    tolerancia_ingreso_min: Math.round(tolerancia_ingreso_min),
    tolerancia_egreso_min: Math.round(tolerancia_egreso_min),
    banda_ingreso: validarBandaHoraria(t.banda_ingreso ?? null, `${path}.banda_ingreso`),
    banda_egreso: validarBandaHoraria(t.banda_egreso ?? null, `${path}.banda_egreso`),
    descanso: validarDescanso(t.descanso ?? null, `${path}.descanso`),
  };
}

function validarComunes(d) {
  assertStr(d.nombre, "nombre", 120);
  assertStr(d.codigo, "codigo", 30);
  const activo = d.activo !== false;
  return {
    nombre: d.nombre.trim(),
    codigo: d.codigo.trim(),
    activo,
    carga_horaria_semanal_teorica:
      typeof d.carga_horaria_semanal_teorica === "number" ? d.carga_horaria_semanal_teorica : null,
    impacta_calendario_institucional: d.impacta_calendario_institucional !== false,
    tipo_contrato_ids: Array.isArray(d.tipo_contrato_ids) ? d.tipo_contrato_ids.filter((x) => typeof x === "string") : null,
    notas_rrhh: typeof d.notas_rrhh === "string" && d.notas_rrhh.trim() ? d.notas_rrhh.trim().slice(0, 500) : null,
    horas_extra_max_semanal: typeof d.horas_extra_max_semanal === "number" ? d.horas_extra_max_semanal : null,
    horas_extra_max_mensual: typeof d.horas_extra_max_mensual === "number" ? d.horas_extra_max_mensual : null,
  };
}

function validarDiaFijo(d, idx) {
  const p = `dias[${idx}]`;
  assertNumRange(d.dia_semana, `${p}.dia_semana`, 1, 7);
  if (!TIPOS_DIA.has(d.tipo_dia)) err("invalid-argument", `${p}.tipo_dia inválido.`);
  const necesitaTurno = d.tipo_dia === "laborable" || d.tipo_dia === "guardia";
  const turno = necesitaTurno ? validarTurno(d.turno, `${p}.turno`) : null;
  if (necesitaTurno && !turno) err("invalid-argument", `${p}: días laborables/guardia requieren turno.`);
  return {
    dia_semana: Math.round(d.dia_semana),
    tipo_dia: d.tipo_dia,
    turno,
  };
}

function validarPosicionCiclo(d, idx) {
  const p = `ciclo[${idx}]`;
  assertNumRange(d.posicion, `${p}.posicion`, 1, 60);
  if (!TIPOS_DIA.has(d.tipo_dia)) err("invalid-argument", `${p}.tipo_dia inválido.`);
  const necesitaTurno = d.tipo_dia === "laborable" || d.tipo_dia === "guardia";
  const turno = necesitaTurno ? validarTurno(d.turno, `${p}.turno`) : null;
  if (necesitaTurno && !turno) err("invalid-argument", `${p}: posiciones laborables/guardia requieren turno.`);
  return {
    posicion: Math.round(d.posicion),
    tipo_dia: d.tipo_dia,
    turno,
  };
}

function validarTurnoDisponible(d, idx) {
  const p = `turnos_disponibles[${idx}]`;
  assertStr(d.turno_id, `${p}.turno_id`, 10);
  assertStr(d.etiqueta, `${p}.etiqueta`, 50);
  assertHHMM(d.ingreso, `${p}.ingreso`);
  assertHHMM(d.egreso, `${p}.egreso`);
  assertNumRange(d.horas_efectivas, `${p}.horas_efectivas`, 0, 24);
  const es_nocturno = d.es_nocturno === true;
  const tolerancia_ingreso_min = typeof d.tolerancia_ingreso_min === "number" ? d.tolerancia_ingreso_min : 0;
  const tolerancia_egreso_min = typeof d.tolerancia_egreso_min === "number" ? d.tolerancia_egreso_min : 0;
  assertNumRange(tolerancia_ingreso_min, `${p}.tolerancia_ingreso_min`, 0, 60);
  assertNumRange(tolerancia_egreso_min, `${p}.tolerancia_egreso_min`, 0, 60);
  return {
    turno_id: d.turno_id.trim(),
    etiqueta: d.etiqueta.trim(),
    ingreso: d.ingreso,
    egreso: d.egreso,
    horas_efectivas: d.horas_efectivas,
    es_nocturno,
    tolerancia_ingreso_min: Math.round(tolerancia_ingreso_min),
    tolerancia_egreso_min: Math.round(tolerancia_egreso_min),
    banda_ingreso: validarBandaHoraria(d.banda_ingreso ?? null, `${p}.banda_ingreso`),
    banda_egreso: validarBandaHoraria(d.banda_egreso ?? null, `${p}.banda_egreso`),
    descanso: validarDescanso(d.descanso ?? null, `${p}.descanso`),
  };
}

function validarReglasPlanificacion(r, path) {
  if (r === null || r === undefined) return null;
  if (typeof r !== "object") err("invalid-argument", `${path}: objeto o null.`);
  return {
    dias_trabajo_max_mes: typeof r.dias_trabajo_max_mes === "number" ? Math.round(r.dias_trabajo_max_mes) : null,
    dias_franco_min_mes: typeof r.dias_franco_min_mes === "number" ? Math.round(r.dias_franco_min_mes) : null,
    max_consecutivos_trabajo:
      typeof r.max_consecutivos_trabajo === "number" ? Math.round(r.max_consecutivos_trabajo) : null,
    min_consecutivos_franco:
      typeof r.min_consecutivos_franco === "number" ? Math.round(r.min_consecutivos_franco) : null,
  };
}

function validarFijo(d) {
  if (!Array.isArray(d.dias) || d.dias.length !== 7) err("invalid-argument", "Fijo requiere exactamente 7 días.");
  const dias = d.dias.map((dia, i) => validarDiaFijo(dia, i));
  const semanas = dias.map((x) => x.dia_semana).sort((a, b) => a - b);
  if (JSON.stringify(semanas) !== "[1,2,3,4,5,6,7]")
    err("invalid-argument", "dias debe incluir cada día de la semana (1-7) exactamente una vez.");
  return { tipo_patron: "fijo", dias };
}

function validarRotativo(d) {
  if (!Array.isArray(d.ciclo) || d.ciclo.length < 2 || d.ciclo.length > 60)
    err("invalid-argument", "Rotativo requiere ciclo de 2 a 60 posiciones.");
  const ciclo = d.ciclo.map((pos, i) => validarPosicionCiclo(pos, i));
  for (let i = 0; i < ciclo.length; i++) {
    if (ciclo[i].posicion !== i + 1) err("invalid-argument", `ciclo[${i}].posicion debe ser ${i + 1}.`);
  }
  const ciclo_total = ciclo.length;
  if (typeof d.ciclo_total === "number" && d.ciclo_total !== ciclo_total)
    err("invalid-argument", "ciclo_total no coincide con la cantidad de posiciones.");
  return { tipo_patron: "rotativo", ciclo, ciclo_total };
}

function validarPlanificado(d) {
  if (!Array.isArray(d.turnos_disponibles) || d.turnos_disponibles.length < 1 || d.turnos_disponibles.length > 20)
    err("invalid-argument", "Planificado requiere 1 a 20 turnos_disponibles.");
  const turnos_disponibles = d.turnos_disponibles.map((t, i) => validarTurnoDisponible(t, i));
  const ids = turnos_disponibles.map((t) => t.turno_id);
  if (new Set(ids).size !== ids.length) err("invalid-argument", "turno_id duplicados en turnos_disponibles.");
  const reglas_planificacion = validarReglasPlanificacion(d.reglas_planificacion ?? null, "reglas_planificacion");
  return { tipo_patron: "planificado", turnos_disponibles, reglas_planificacion };
}

/**
 * RRHH: crear o actualizar un régimen horario en cfg_regimen_horario.
 * Recibe { id?: string, datos: RegimenHorario }.
 * Si `id` es proporcionado, actualiza; si no, crea con ID auto-generado.
 */
const guardarRegimenHorario = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const data = request.data;
  if (!data || !data.datos || typeof data.datos !== "object")
    err("invalid-argument", "[VAL-REG-001] datos requeridos.");

  const d = data.datos;
  const tipo_patron = d.tipo_patron;
  if (!TIPOS_PATRON.has(tipo_patron)) err("invalid-argument", "[VAL-REG-002] tipo_patron inválido.");

  const comunes = validarComunes(d);

  let especificos;
  switch (tipo_patron) {
    case "fijo":
      especificos = validarFijo(d);
      break;
    case "rotativo":
      especificos = validarRotativo(d);
      break;
    case "planificado":
      especificos = validarPlanificado(d);
      break;
    default:
      err("invalid-argument", "tipo_patron no soportado.");
  }

  const id = data.id && typeof data.id === "string" && ID_PREFIX_RE.test(data.id.trim())
    ? data.id.trim()
    : normalizeCatalogDocId(`CFG_REG_HOR_${Date.now()}`);

  const ref = db.collection(COL).doc(id);
  const exists = (await ref.get()).exists;

  const payload = {
    id,
    ...comunes,
    ...especificos,
    actualizado_en: FieldValue.serverTimestamp(),
  };
  if (!exists) payload.creado_en = FieldValue.serverTimestamp();

  await ref.set(payload, { merge: true });
  return { ok: true, id, modo: exists ? "actualizado" : "creado" };
});

/**
 * RRHH: listar todos los regímenes horarios.
 */
const listarRegimenesHorarios = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const snap = await db.collection(COL).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const flat = serializeFirestoreValue(data);
    const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { ...base, id: doc.id };
  });
  return { items };
});

module.exports = { guardarRegimenHorario, listarRegimenesHorarios };
