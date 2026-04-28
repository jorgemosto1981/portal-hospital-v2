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
  findSolapeHlg,
  assertHlgDentroDeHlc,
  buildWarningReconciliacionCarga,
  pushWarning,
  validarCargaPorDiaSemana,
} = require("./catalogosShared");

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
    const efDesignacionId = toNullableTrimmedString(datos.efector_designacion_id);
    const efCumplimientoId = toNullableTrimmedString(datos.efector_cumplimiento_id);
    if (!personaId || !efDesignacionId || !efCumplimientoId) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-HLC-002] En HLc son obligatorios: persona_id, efector_designacion_id y efector_cumplimiento_id.",
      );
    }
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
      throw new HttpsError(
        "failed-precondition",
        `[VAL-HLC-008] Solape de vigencia HLc detectado para persona_id ${personaId} (conflicto con ${solapeHlc.id}).`,
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
      escalafon_id: toNullableTrimmedString(datos.escalafon_id),
      agrupamiento_id: toNullableTrimmedString(datos.agrupamiento_id),
      funcion_real_id: funcionRealId,
      nivel_jerarquico: nivelJerarquico,
      fecha_inicio: fechaInicio,
      fecha_fin: toNullableTrimmedString(datos.fecha_fin),
      activo: datos.activo !== false,
      actualizado_en: now,
    };
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
  const solapeHlg = await findSolapeHlg({ id, personaId, grupoId, fechaInicio: payload.fecha_inicio, fechaFin: payload.fecha_fin });
  if (solapeHlg) {
    throw new HttpsError(
      "failed-precondition",
      `[VAL-HLG-014] Solape de vigencia HLg detectado para persona_id ${personaId} y grupo_de_trabajo_id ${grupoId} (conflicto con ${solapeHlg.id}).`,
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
    datoLaboralId,
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

module.exports = { guardarRegistroLaboralTemporal };
