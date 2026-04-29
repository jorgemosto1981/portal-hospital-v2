"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { db, FieldValue } = require("./shared/context");
const runtimeFlags = require("../../shared/runtimeFlags.json");
const { assertRrhh } = require("./shared/helpers");
const {
  COLECCIONES_ESCRITURA_LABORAL_TEMPORAL,
  toNullableTrimmedString,
  toNumberOrNull,
  isRangoInvalido,
  assertDocExistsOrNull,
  findSolapeHlc,
  findSolapeHlgMismoCargo,
  assertHlgDentroDeHlc,
  buildWarningReconciliacionCarga,
  pushWarning,
  validarCargaPorDiaSemana,
} = require("./catalogosShared");

function toDateKey(value) {
  const raw = toNullableTrimmedString(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function vigenteEnFechaInclusiva(desde, hasta, fecha) {
  if (!desde || !fecha) return false;
  if (desde > fecha) return false;
  if (hasta && hasta < fecha) return false;
  return true;
}

function estadoOperativoDesdeRango(desde, hasta, fecha) {
  if (!desde || !fecha) return "desconocido";
  if (desde > fecha) return "pendiente";
  if (hasta && hasta < fecha) return "no_vigente";
  return "activo";
}

function estadoAdminDesdeFechaFin(hasta) {
  return hasta ? "cerrado" : "abierto";
}

function sumarCargaSemanal(cargaPorDiaSemana) {
  if (!Array.isArray(cargaPorDiaSemana)) return 0;
  return cargaPorDiaSemana.reduce((acc, item) => {
    const horas = item && typeof item === "object" && !Array.isArray(item) ? Number(item.horas) : Number(item);
    return Number.isFinite(horas) ? acc + horas : acc;
  }, 0);
}

function haySolapeInclusivo(aDesde, aHasta, bDesde, bHasta) {
  if (!aDesde || !bDesde) return false;
  const aFin = aHasta || "9999-12-31";
  const bFin = bHasta || "9999-12-31";
  return aDesde <= bFin && bDesde <= aFin;
}

const guardarRegistroLaboralTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const colRaw = typeof d.collectionName === "string" ? d.collectionName.trim() : "";
  if (!COLECCIONES_ESCRITURA_LABORAL_TEMPORAL.has(colRaw)) {
    throw new HttpsError("invalid-argument", "[VAL-HLB-001] Colección laboral no permitida para escritura temporal.");
  }
  const datos = d.datos && typeof d.datos === "object" ? d.datos : {};
  const now = FieldValue.serverTimestamp();

  if (colRaw === "historial_laboral_cargos") {
    const id = toNullableTrimmedString(datos.id) || `hlc_${ulid()}`;
    const personaId = toNullableTrimmedString(datos.persona_id);
    const grupoTrabajoId = toNullableTrimmedString(datos.grupo_de_trabajo_id);
    const efDesignacionId = toNullableTrimmedString(datos.efector_designacion_id);
    const efCumplimientoId = toNullableTrimmedString(datos.efector_cumplimiento_id);
    if (!personaId || !grupoTrabajoId || !efDesignacionId || !efCumplimientoId) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLC-002] En HLc son obligatorios: persona_id, grupo_de_trabajo_id, efector_designacion_id y efector_cumplimiento_id.",
      );
    }
    await assertDocExistsOrNull("grupos_de_trabajo", grupoTrabajoId, "grupo_de_trabajo_id");
    await assertDocExistsOrNull("cfg_efectores", efDesignacionId, "efector_designacion_id");
    await assertDocExistsOrNull("cfg_efectores", efCumplimientoId, "efector_cumplimiento_id");
    const tipoVinculoId = toNullableTrimmedString(datos.tipo_vinculo_id);
    const modalidadJornadaId = toNullableTrimmedString(datos.modalidad_jornada_id);
    const causalFinAsignacionId = toNullableTrimmedString(datos.causal_fin_asignacion_id);
    const estadoAsignacionId = toNullableTrimmedString(datos.estado_asignacion_id);
    const escalafonId = toNullableTrimmedString(datos.escalafon_id);
    const agrupamientoId = toNullableTrimmedString(datos.agrupamiento_id);
    const categoriaId = toNullableTrimmedString(datos.categoria_id);
    const cargoFuncionalId = toNullableTrimmedString(datos.cargo_funcional_id);
    const cargaHorariaTotal = toNumberOrNull(datos.carga_horaria_total);
    if (
      !tipoVinculoId ||
      !modalidadJornadaId ||
      !estadoAsignacionId ||
      !escalafonId ||
      !agrupamientoId ||
      !categoriaId ||
      !cargoFuncionalId ||
      cargaHorariaTotal == null
    ) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLC-007] En HLc son obligatorios: tipo_vinculo_id, modalidad_jornada_id, estado_asignacion_id, escalafon_id, agrupamiento_id, categoria_id, cargo_funcional_id y carga_horaria_total.",
      );
    }
    await assertDocExistsOrNull("cfg_tipo_vinculo_laboral", tipoVinculoId, "tipo_vinculo_id");
    await assertDocExistsOrNull("cfg_modalidad_jornada", modalidadJornadaId, "modalidad_jornada_id");
    await assertDocExistsOrNull("cfg_estado_asignacion_laboral", estadoAsignacionId, "estado_asignacion_id");
    await assertDocExistsOrNull("cfg_escalafon", escalafonId, "escalafon_id");
    await assertDocExistsOrNull("cfg_agrupamiento", agrupamientoId, "agrupamiento_id");
    await assertDocExistsOrNull("cfg_categorias", categoriaId, "categoria_id");
    await assertDocExistsOrNull("cfg_cargo_funcional", cargoFuncionalId, "cargo_funcional_id");
    await assertDocExistsOrNull(
      "cfg_causal_fin_asignacion_laboral",
      causalFinAsignacionId,
      "causal_fin_asignacion_id",
    );
    const referenciasNormativa = Array.isArray(datos.referencias_normativa_designacion)
      ? datos.referencias_normativa_designacion
      : [];
    if (referenciasNormativa.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLC-005] referencias_normativa_designacion requiere al menos una referencia legal.",
      );
    }
    const referenciasNormalizadas = [];
    for (const item of referenciasNormativa) {
      const tipoActoId = toNullableTrimmedString(item && item.tipo_acto_id);
      const numero = toNullableTrimmedString(item && item.numero);
      const fecha = toNullableTrimmedString(item && item.fecha);
      if (!tipoActoId || !numero || !fecha) {
        throw new HttpsError(
          "invalid-argument",
          "[VAL-HLC-006] Cada referencia normativa requiere tipo_acto_id, numero y fecha.",
        );
      }
      await assertDocExistsOrNull("cfg_tipo_acto_designacion", tipoActoId, "referencias_normativa_designacion.tipo_acto_id");
      referenciasNormalizadas.push({
        tipo_acto_id: tipoActoId,
        numero,
        fecha,
        detalle: toNullableTrimmedString(item && item.detalle),
      });
    }
    const payload = {
      id,
      persona_id: personaId,
      grupo_de_trabajo_id: grupoTrabajoId,
      efector_designacion_id: efDesignacionId,
      efector_cumplimiento_id: efCumplimientoId,
      escalafon_id: escalafonId,
      agrupamiento_id: agrupamientoId,
      categoria_id: categoriaId,
      cargo_funcional_id: cargoFuncionalId,
      tipo_vinculo_id: tipoVinculoId,
      modalidad_jornada_id: modalidadJornadaId,
      causal_fin_asignacion_id: causalFinAsignacionId,
      referencias_normativa_designacion: referenciasNormalizadas,
      estado_asignacion_id: estadoAsignacionId,
      carga_horaria_total: cargaHorariaTotal,
      fecha_desde: toNullableTrimmedString(datos.fecha_desde),
      fecha_hasta: toNullableTrimmedString(datos.fecha_hasta),
      activo: datos.activo !== false,
      actualizado_en: now,
    };
    const warnings = [];
    if (!payload.fecha_desde) {
      throw new HttpsError("invalid-argument", "[VAL-HLC-001] fecha_desde es obligatoria en HLc.");
    }
    if (isRangoInvalido(payload.fecha_desde, payload.fecha_hasta)) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLC-003] Rango inválido en HLc: fecha_desde no puede ser mayor que fecha_hasta.",
      );
    }
    if (payload.fecha_hasta && !payload.causal_fin_asignacion_id) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLC-004] causal_fin_asignacion_id es obligatorio cuando fecha_hasta está informada.",
      );
    }
    const solapeHlc = await findSolapeHlc({
      id,
      personaId,
      fechaDesde: payload.fecha_desde,
      fechaHasta: payload.fecha_hasta,
    });
    if (solapeHlc) {
      pushWarning(
        warnings,
        "VAL-HLC-W001",
        `Solape de vigencia HLc detectado para persona_id ${personaId} (conflicto con ${solapeHlc.id}).`,
        { persona_id: personaId, id, conflictivo_id: solapeHlc.id, collection: colRaw },
      );
    }
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    const hldSnap = await db.collection("historial_laboral_datos").where("cargo_id", "==", id).get();
    let tieneGrupoAsignado = false;
    if (!hldSnap.empty) {
      for (const hldDoc of hldSnap.docs) {
        const hlgSnap = await db
          .collection("historial_laboral_grupos")
          .where("dato_laboral_id", "==", hldDoc.id)
          .limit(1)
          .get();
        if (!hlgSnap.empty) {
          tieneGrupoAsignado = true;
          break;
        }
      }
    }
    const cargoActivo = payload.activo !== false && !payload.fecha_hasta;
    if (cargoActivo && !tieneGrupoAsignado) {
      pushWarning(
        warnings,
        "VAL-HLC-W005",
        "Cargo activo sin grupo de trabajo asignado aún. Recomendado: completar HLg para evitar errores operativos.",
        { persona_id: personaId, hlc_id: id, collection: colRaw },
      );
    }
    return { ok: true, id, warnings };
  }

  if (colRaw === "historial_laboral_datos") {
    const id = toNullableTrimmedString(datos.id) || `hld_${ulid()}`;
    const personaId = toNullableTrimmedString(datos.persona_id);
    const cargoId = toNullableTrimmedString(datos.cargo_id);
    if (!personaId || !cargoId) throw new HttpsError("invalid-argument", "En HLd son obligatorios: persona_id y cargo_id.");
    await assertDocExistsOrNull("historial_laboral_cargos", cargoId, "cargo_id");
    const cargoSnap = await db.collection("historial_laboral_cargos").doc(cargoId).get();
    const cargoPersonaId = toNullableTrimmedString(cargoSnap.get("persona_id"));
    if (cargoPersonaId && cargoPersonaId !== personaId) {
      throw new HttpsError(
        "invalid-argument",
        `[VAL-HLD-001] persona_id inconsistente: HLd (${personaId}) no coincide con HLc (${cargoPersonaId}).`,
      );
    }
    const rolId = toNullableTrimmedString(datos.rol_id);
    const funcionRealId = toNullableTrimmedString(datos.funcion_real_id);
    const nivelJerarquico = toNumberOrNull(datos.nivel_jerarquico);
    const fechaInicio = toNullableTrimmedString(datos.fecha_inicio);
    if (!rolId || !funcionRealId || nivelJerarquico == null || !fechaInicio) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLD-002] En HLd son obligatorios: rol_id, funcion_real_id, nivel_jerarquico y fecha_inicio.",
      );
    }
    const payload = {
      id,
      persona_id: personaId,
      cargo_id: cargoId,
      rol_id: rolId,
      regimen_horario_id: toNullableTrimmedString(datos.regimen_horario_id),
      centro_costo_id: toNullableTrimmedString(datos.centro_costo_id),
      escalafon_id: toNullableTrimmedString(datos.escalafon_id),
      agrupamiento_id: toNullableTrimmedString(datos.agrupamiento_id),
      funcion_real_id: funcionRealId,
      nivel_jerarquico: nivelJerarquico,
      fecha_inicio: fechaInicio,
      fecha_fin: toNullableTrimmedString(datos.fecha_fin),
      activo: datos.activo !== false,
      actualizado_en: now,
    };
    await assertDocExistsOrNull("cfg_regimen_horario", payload.regimen_horario_id, "regimen_horario_id");
    await assertDocExistsOrNull("cfg_centro_costo", payload.centro_costo_id, "centro_costo_id");
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id };
  }

  const id = toNullableTrimmedString(datos.id) || `hlg_${ulid()}`;
  const personaId = toNullableTrimmedString(datos.persona_id);
  const datoLaboralId = toNullableTrimmedString(datos.dato_laboral_id);
  const grupoId = toNullableTrimmedString(datos.grupo_de_trabajo_id);
  if (!personaId || !datoLaboralId || !grupoId) {
    throw new HttpsError(
      "invalid-argument",
      "[VAL-HLG-007] En HLg son obligatorios: persona_id, dato_laboral_id y grupo_de_trabajo_id.",
    );
  }
  await assertDocExistsOrNull("historial_laboral_datos", datoLaboralId, "dato_laboral_id");
  const datoSnap = await db.collection("historial_laboral_datos").doc(datoLaboralId).get();
  const datoPersonaId = toNullableTrimmedString(datoSnap.get("persona_id"));
  if (datoPersonaId && datoPersonaId !== personaId) {
    throw new HttpsError(
      "invalid-argument",
      `[VAL-HLG-001] persona_id inconsistente: HLg (${personaId}) no coincide con HLd (${datoPersonaId}).`,
    );
  }
  await assertDocExistsOrNull("grupos_de_trabajo", grupoId, "grupo_de_trabajo_id");
  const carga = Array.isArray(datos.carga_por_dia_semana)
    ? datos.carga_por_dia_semana.map((x) => {
        if (x && typeof x === "object") {
          return { dia_semana_id: toNullableTrimmedString(x.dia_semana_id), horas: toNumberOrNull(x.horas) || 0 };
        }
        const n = toNumberOrNull(x);
        return n != null ? n : 0;
      })
    : [];
  for (const item of carga) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      await assertDocExistsOrNull("cfg_dia_semana", toNullableTrimmedString(item.dia_semana_id), "carga_por_dia_semana.dia_semana_id");
    }
  }
  const payload = {
    id,
    persona_id: personaId,
    dato_laboral_id: datoLaboralId,
    grupo_de_trabajo_id: grupoId,
    nivel_jerarquico: toNumberOrNull(datos.nivel_jerarquico),
    carga_por_dia_semana: carga,
    fecha_inicio: toNullableTrimmedString(datos.fecha_inicio),
    fecha_fin: toNullableTrimmedString(datos.fecha_fin),
    activo: datos.activo !== false,
    actualizado_en: now,
  };
  const warnings = [];
  if (!Array.isArray(payload.carga_por_dia_semana) || payload.carga_por_dia_semana.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "[VAL-HLG-013] carga_por_dia_semana es obligatoria y debe contener al menos un día.",
    );
  }
  if (!payload.fecha_inicio) {
    throw new HttpsError("invalid-argument", "[VAL-HLG-010] fecha_inicio es obligatoria en HLg.");
  }
  if (isRangoInvalido(payload.fecha_inicio, payload.fecha_fin)) {
    throw new HttpsError("invalid-argument", "[VAL-HLG-005] Rango inválido en HLg: fecha_inicio no puede ser mayor que fecha_fin.");
  }
  validarCargaPorDiaSemana(payload.carga_por_dia_semana);
  const cargoId = toNullableTrimmedString(datoSnap.get("cargo_id"));
  if (!cargoId) {
    throw new HttpsError(
      "failed-precondition",
      "[VAL-HLG-006] HLd referenciado no contiene cargo_id para validar cadena HLg->HLd->HLc.",
    );
  }
  await assertDocExistsOrNull("historial_laboral_cargos", cargoId, "cargo_id");
  const cargoSnap = await db.collection("historial_laboral_cargos").doc(cargoId).get();
  await assertHlgDentroDeHlc({
    fechaInicioHlg: payload.fecha_inicio,
    fechaFinHlg: payload.fecha_fin,
    fechaDesdeHlc: toNullableTrimmedString(cargoSnap.get("fecha_desde")),
    fechaHastaHlc: toNullableTrimmedString(cargoSnap.get("fecha_hasta")),
  });
  const solapeHlg = await findSolapeHlgMismoCargo({
    id,
    grupoId,
    cargoId,
    fechaInicio: payload.fecha_inicio,
    fechaFin: payload.fecha_fin,
  });
  if (solapeHlg) {
    pushWarning(
      warnings,
      "VAL-HLG-W002",
      `Solape de vigencia HLg detectado dentro del mismo cargo (${cargoId}) para grupo_de_trabajo_id ${grupoId} (conflicto con ${solapeHlg.id}).`,
      { persona_id: personaId, cargo_id: cargoId, id, grupo_de_trabajo_id: grupoId, conflictivo_id: solapeHlg.id, collection: colRaw },
    );
  }
  const hasDiaSemanaObjects = payload.carga_por_dia_semana.some((x) => x && typeof x === "object" && !Array.isArray(x));
  if (!hasDiaSemanaObjects) {
    throw new HttpsError(
      "invalid-argument",
      "[VAL-HLG-015] carga_por_dia_semana debe informar dia_semana_id por item (modo objeto).",
    );
  }
  const warningCarga = await buildWarningReconciliacionCarga({
    id,
    cargoId,
    cargaPorDiaSemanaActual: payload.carga_por_dia_semana,
    cargaHorariaTotalHlc: cargoSnap.get("carga_horaria_total"),
  });
  if (warningCarga) warnings.push(warningCarga);
  const ref = db.collection(colRaw).doc(id);
  const exists = (await ref.get()).exists;
  if (!exists) payload.creado_en = now;
  await ref.set(payload, { merge: true });
  return { ok: true, id, warnings };
});

const listarReadModelLaboralOperativoTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const data = request && request.data && typeof request.data === "object" ? request.data : {};
  const personaId = toNullableTrimmedString(data.persona_id);
  const grupoId = toNullableTrimmedString(data.grupo_de_trabajo_id);
  const fechaCorte = toDateKey(data.fecha_corte) || new Date().toISOString().slice(0, 10);
  const incluirNoVigentes = data.incluir_no_vigentes === true;

  const [hlcSnap, hldSnap, hlgSnap, personasSnap, gruposSnap] = await Promise.all([
    db.collection("historial_laboral_cargos").get(),
    db.collection("historial_laboral_datos").get(),
    db.collection("historial_laboral_grupos").get(),
    db.collection("personas").get(),
    db.collection("grupos_de_trabajo").get(),
  ]);

  const idxHlc = new Map();
  hlcSnap.docs.forEach((doc) => idxHlc.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
  const idxHld = new Map();
  hldSnap.docs.forEach((doc) => idxHld.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
  const idxPersonas = new Map();
  personasSnap.docs.forEach((doc) => idxPersonas.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
  const idxGrupos = new Map();
  gruposSnap.docs.forEach((doc) => idxGrupos.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));

  const totalCargaPorCargo = new Map();
  const hlgEnriquecidos = [];
  hlgSnap.docs.forEach((doc) => {
    const hlg = doc.data() || {};
    const hld = idxHld.get(String(hlg.dato_laboral_id || ""));
    const cargoId = toNullableTrimmedString(hld && hld.cargo_id);
    const rowGrupoId = toNullableTrimmedString(hlg.grupo_de_trabajo_id);
    const fechaInicio = toDateKey(hlg.fecha_inicio);
    const fechaFin = toDateKey(hlg.fecha_fin);
    hlgEnriquecidos.push({
      id: doc.id,
      hlg,
      hld,
      cargo_id: cargoId,
      grupo_de_trabajo_id: rowGrupoId,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    });
    if (!cargoId) return;
    totalCargaPorCargo.set(cargoId, Number(totalCargaPorCargo.get(cargoId) || 0) + sumarCargaSemanal(hlg.carga_por_dia_semana));
  });

  const idsConSolapeCargoGrupo = new Set();
  const byCargoGrupo = new Map();
  hlgEnriquecidos.forEach((row) => {
    if (!row.cargo_id || !row.grupo_de_trabajo_id) return;
    const k = `${row.cargo_id}::${row.grupo_de_trabajo_id}`;
    const list = byCargoGrupo.get(k) || [];
    list.push(row);
    byCargoGrupo.set(k, list);
  });
  byCargoGrupo.forEach((list) => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (haySolapeInclusivo(list[i].fecha_inicio, list[i].fecha_fin, list[j].fecha_inicio, list[j].fecha_fin)) {
          idsConSolapeCargoGrupo.add(list[i].id);
          idsConSolapeCargoGrupo.add(list[j].id);
        }
      }
    }
  });

  const items = [];
  hlgEnriquecidos.forEach((row) => {
    const { hlg, hld, cargo_id: cargoId, grupo_de_trabajo_id: rowGrupoId, fecha_inicio: fechaInicio, fecha_fin: fechaFin } = row;
    const hlc = hld ? idxHlc.get(String(hld.cargo_id || "")) : null;
    const rowPersonaId = toNullableTrimmedString(hlg.persona_id);
    const vigente = vigenteEnFechaInclusiva(fechaInicio, fechaFin, fechaCorte);
    const estadoOperativo = estadoOperativoDesdeRango(fechaInicio, fechaFin, fechaCorte);
    const estadoAdmin = estadoAdminDesdeFechaFin(fechaFin);

    if (personaId && rowPersonaId !== personaId) return;
    if (grupoId && rowGrupoId !== grupoId) return;
    if (!incluirNoVigentes && !vigente) return;

    const persona = idxPersonas.get(rowPersonaId);
    const grupo = idxGrupos.get(rowGrupoId);
    const expectedCarga = hlc ? Number(hlc.carga_horaria_total) : null;
    const totalCarga = Number(totalCargaPorCargo.get(String((hlc && hlc.id) || "")) || 0);
    const warningCodes = [];
    if (idsConSolapeCargoGrupo.has(row.id)) {
      warningCodes.push("SOLAPE_CARGO_GRUPO");
    }
    if (hlc && Number.isFinite(expectedCarga) && Math.abs(totalCarga - expectedCarga) > 0.01) {
      warningCodes.push("DESVIO_CARGA_NORMATIVA");
    }

    items.push({
      persona_id: rowPersonaId || null,
      persona_nombre: persona
        ? `${String(persona.apellido || "").trim()} ${String(persona.nombre || "").trim()}`.trim()
        : null,
      grupo_de_trabajo_id: rowGrupoId || null,
      grupo_nombre: grupo ? toNullableTrimmedString(grupo.nombre) : null,
      fecha_corte: fechaCorte,
      hlg_id: row.id,
      hld_id: hld ? String(hld.id || "") : null,
      hlc_id: hlc ? String(hlc.id || "") : null,
      nivel_jerarquico: hlg.nivel_jerarquico == null ? null : Number(hlg.nivel_jerarquico),
      vigente_en_fecha: vigente,
      estado_operativo: estadoOperativo,
      estado_admin: estadoAdmin,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      regimen_horario_id: hld ? toNullableTrimmedString(hld.regimen_horario_id) : null,
      centro_costo_id: hld ? toNullableTrimmedString(hld.centro_costo_id) : null,
      carga_horas_semana_hlg: sumarCargaSemanal(hlg.carga_por_dia_semana),
      carga_horas_total_hlc: Number.isFinite(expectedCarga) ? expectedCarga : null,
      warning_codes: warningCodes,
    });
  });

  items.sort((a, b) => {
    const ga = String(a.grupo_de_trabajo_id || "");
    const gb = String(b.grupo_de_trabajo_id || "");
    if (ga !== gb) return ga.localeCompare(gb);
    const na = Number.isFinite(a.nivel_jerarquico) ? a.nivel_jerarquico : 999;
    const nb = Number.isFinite(b.nivel_jerarquico) ? b.nivel_jerarquico : 999;
    if (na !== nb) return na - nb;
    return String(a.persona_id || "").localeCompare(String(b.persona_id || ""));
  });

  return {
    items,
    resumen: {
      total: items.length,
      vigentes: items.filter((x) => x.estado_operativo === "activo").length,
      no_vigentes: items.filter((x) => x.estado_operativo === "no_vigente").length,
      pendientes: items.filter((x) => x.estado_operativo === "pendiente").length,
      abiertos: items.filter((x) => x.estado_admin === "abierto").length,
      cerrados: items.filter((x) => x.estado_admin === "cerrado").length,
      warning_solape_cargo_grupo: items.filter((x) => Array.isArray(x.warning_codes) && x.warning_codes.includes("SOLAPE_CARGO_GRUPO")).length,
      warning_desvio_carga: items.filter((x) => Array.isArray(x.warning_codes) && x.warning_codes.includes("DESVIO_CARGA_NORMATIVA")).length,
    },
    meta: {
      fecha_corte: fechaCorte,
      filtros: {
        persona_id: personaId || null,
        grupo_de_trabajo_id: grupoId || null,
        incluir_no_vigentes: incluirNoVigentes,
      },
    },
  };
});

module.exports = { guardarRegistroLaboralTemporal, listarReadModelLaboralOperativoTemporal };
