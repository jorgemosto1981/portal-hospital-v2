"use strict";

const { ulid } = require("ulid");
const { FieldValue } = require("firebase-admin/firestore");
const { buildVisDocumentId, diaMesKeyDesdeYmd } = require("../shared/mdcRdaDocumentIds");
const { assertPeriodoNoCerrado } = require("../asistencia/asistenciaPeriodoLiquidacion");
const { alinearMarcasConTeoriaDia, alinearMarcasConTeoriaEnCalendario } = require("../shared/fichadasAlineacionTeoria");
const { evaluarDeltaCeldaDia } = require("../shared/fichadasDeltaCeldaDia");
const { segmentarOperacionesFirestore } = require("../shared/fichadasDeltaCeldaDia");
const {
  parseTxtRelojBiometrico,
  agruparMarcasPorClaveVis,
  claveVisImportMarca,
  detectarDuplicadosProbablesEnLote,
} = require("../shared/fichadasValidacionMarcas");
const {
  relojEsUniversalPorGrupoCfg,
  expandirMarcasPorEnrolamientoYMultiCargo,
} = require("./fichadasMultiCargoUniversal");
const { buildEventoV21, persistEventoV21 } = require("../shared/eventosV2");
const {
  marcasDesdeFichadasRealesExistentes,
  marcasDesdePayloadHoras,
  unirMarcasSinDuplicarInstante,
  validarVersionCeldaFichada,
} = require("./fichadasMarcasUtils");

const COL_VIS = "vistas_grilla_mes_agente";
const COL_FMH = "fichadas_marca_huerfana";
const COL_FIL = "fichadas_import_lote";
const COL_RPE = "reloj_persona_enrolamiento";
const ESTADO_FMH_PENDIENTE = "PENDIENTE_ENROLAMIENTO";
const TIPO_EVENTO_FICHADAS = "cfg_tev_rrhh";
const MODULO_ORIGEN = "fichadas_reloj";

const ACCIONES_VALIDAS = new Set([
  "REEMPLAZAR_MARCAS",
  "AGREGAR_MARCAS",
  "BORRAR_CAPA",
  "BORRAR_FILA",
]);

function anioMesDesdeYmd(fechaYmd) {
  const ymd = String(fechaYmd || "").slice(0, 10);
  const [y, m] = ymd.split("-").map(Number);
  return { anio: y, mes: m };
}

function origenPermiteResueltoRrhh(origen) {
  return origen === "GRILLA_ABM" || origen === "CARGA_MANUAL";
}

async function registrarEventoFichadaSiCorresponde(db, {
  evtId,
  persona_id,
  actor_uid,
  actor_persona_id,
  accion,
  fecha_ymd,
  grupo_trabajo_id,
  motivo,
  origen,
}) {
  const evento = buildEventoV21({
    id: evtId,
    tipo_evento_id: TIPO_EVENTO_FICHADAS,
    modulo_origen: MODULO_ORIGEN,
    accion,
    persona_id,
    actor_uid,
    actor_persona_id,
    payload_ui: {
      titulo: "Ajuste fichada real",
      resumen: `${fecha_ymd} · ${origen || accion}${motivo ? ` · ${motivo}` : ""}`,
      entidad: "vistas_grilla_mes_agente",
      persona_afectada_label: persona_id,
      actor_label: actor_persona_id || "RRHH",
    },
    payload_contexto: {
      fecha_ymd,
      grupo_trabajo_id,
      origen,
      motivo: motivo || null,
    },
    payload_cambios: [],
  });
  await persistEventoV21({ db, evento });
}

/**
 * @param {object} celdaAntes
 * @param {object} params
 */
function prepararMarcasParaAlineacion(celdaAntes, params) {
  const { accion, marcas, fecha_ymd } = params;
  const existentes = marcasDesdeFichadasRealesExistentes(celdaAntes.fichadas_reales, fecha_ymd);
  const payloadMarcas = marcasDesdePayloadHoras(marcas, fecha_ymd);

  if (accion === "BORRAR_CAPA") {
    return { marcasCrudas: [], borrarCapa: true };
  }
  if (accion === "BORRAR_FILA") {
    const idx = Number(params.fila_index);
    const actuales = Array.isArray(celdaAntes.fichadas_reales) ? [...celdaAntes.fichadas_reales] : [];
    if (Number.isFinite(idx) && idx >= 0 && idx < actuales.length) {
      actuales.splice(idx, 1);
    }
    return {
      marcasCrudas: marcasDesdeFichadasRealesExistentes(actuales, fecha_ymd),
      borrarCapa: false,
      snapshotBorrado: celdaAntes.fichadas_reales,
    };
  }
  if (accion === "REEMPLAZAR_MARCAS") {
    return { marcasCrudas: payloadMarcas, borrarCapa: false };
  }
  if (accion === "AGREGAR_MARCAS") {
    return {
      marcasCrudas: unirMarcasSinDuplicarInstante([existentes, payloadMarcas]),
      borrarCapa: false,
    };
  }
  return { marcasCrudas: payloadMarcas, borrarCapa: false };
}

function construirPatchCeldaDia({
  celdaAntes,
  alineado,
  accion,
  motivo,
  actor_persona_id,
  origen,
  snapshotBorrado,
}) {
  const fichadasNuevas = alineado.fichadas_reales || [];
  let advertencias = alineado.advertencias_fichada_abiertas || [];

  if (accion === "BORRAR_CAPA") {
    advertencias = [];
  }

  const delta = evaluarDeltaCeldaDia({
    fichadas_reales_antes: celdaAntes.fichadas_reales,
    fichadas_reales_despues: fichadasNuevas,
    advertencias_antes: celdaAntes.advertencias_fichada_abiertas,
    advertencias_despues: advertencias,
  });

  if (!delta.tiene_delta && accion !== "BORRAR_CAPA") {
    return { write_skipped: true, tiene_delta: false };
  }

  const borradas = Array.isArray(celdaAntes.fichadas_borradas) ? [...celdaAntes.fichadas_borradas] : [];
  if (
    (accion === "BORRAR_CAPA" || accion === "BORRAR_FILA") &&
    Array.isArray(snapshotBorrado || celdaAntes.fichadas_reales) &&
    (snapshotBorrado || celdaAntes.fichadas_reales).length
  ) {
    borradas.push({
      marcas_snapshot: snapshotBorrado || celdaAntes.fichadas_reales,
      borrado_por_persona_id: actor_persona_id,
      borrado_en: FieldValue.serverTimestamp(),
      motivo: String(motivo || "").trim() || "sin motivo",
      origen_borrado: origen === "CARGA_MANUAL" ? "CARGA_MANUAL" : "GRILLA_ABM",
    });
  }

  const resuelto =
    origenPermiteResueltoRrhh(origen) && advertencias.length === 0 && fichadasNuevas.length > 0;

  return {
    write_skipped: false,
    tiene_delta: true,
    celdaNueva: {
      ...celdaAntes,
      fichadas_reales: fichadasNuevas,
      advertencias_fichada_abiertas: advertencias,
      fichadas_borradas: borradas,
      resuelto_rrhh: resuelto,
      resuelto_rrhh_por_persona_id: resuelto ? actor_persona_id : celdaAntes.resuelto_rrhh_por_persona_id,
      resuelto_rrhh_motivo_corto: resuelto ? String(motivo || "").slice(0, 120) : celdaAntes.resuelto_rrhh_motivo_corto,
      fichadas_reales_version: FieldValue.increment(1),
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function guardarCapaFichadaDia(db, params, actor) {
  const persona_id = String(params.persona_id || "").trim();
  const grupo_trabajo_id = String(params.grupo_trabajo_id || "").trim();
  const fecha_ymd = String(params.fecha_ymd || "").trim();
  const accion = String(params.accion || "").trim();
  const motivo = String(params.motivo || "").trim();
  const origen = String(params.origen || "GRILLA_ABM").trim();
  const version_esperada = params.version_esperada;

  if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(grupo_trabajo_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "persona_id o grupo_trabajo_id inválidos." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_ymd)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "fecha_ymd inválida." };
  }
  if (!ACCIONES_VALIDAS.has(accion)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "accion inválida." };
  }
  if ((accion === "BORRAR_CAPA" || accion === "BORRAR_FILA") && !motivo) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "motivo obligatorio para borrado." };
  }

  await assertPeriodoNoCerrado(db, persona_id, fecha_ymd, grupo_trabajo_id);

  const { anio, mes } = anioMesDesdeYmd(fecha_ymd);
  const visId = buildVisDocumentId(persona_id, `${anio}-${String(mes).padStart(2, "0")}-01`, grupo_trabajo_id);
  const diaKey = diaMesKeyDesdeYmd(fecha_ymd);
  if (!diaKey) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "fecha_ymd fuera de mes." };
  }

  const evtId = `evt_${ulid()}`;
  let writeSkipped = false;
  let versionNueva = null;

  await db.runTransaction(async (tx) => {
    const ref = db.collection(COL_VIS).doc(visId);
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const dias = data.dias && typeof data.dias === "object" ? data.dias : {};
    const celdaAntes = dias[diaKey] || {};

    validarVersionCeldaFichada(celdaAntes, version_esperada);

    const prep = prepararMarcasParaAlineacion(celdaAntes, {
      accion,
      marcas: params.marcas,
      fecha_ymd,
      fila_index: params.fila_index,
    });

    const celdaPlusKey = diaMesKeyDesdeYmd(
      (() => {
        const [y, mo, d] = fecha_ymd.split("-").map(Number);
        const t = new Date(Date.UTC(y, mo - 1, d + 1));
        return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
      })(),
    );
    const celdaPlus = celdaPlusKey ? dias[celdaPlusKey] : null;

    const alineado =
      prep.borrarCapa && prep.marcasCrudas.length === 0
        ? { fichadas_reales: [], advertencias_fichada_abiertas: [] }
        : alinearMarcasConTeoriaDia({
          marcas: prep.marcasCrudas,
          celda_teoria: celdaAntes,
          celda_teoria_dia_siguiente: celdaPlus,
          fecha_ymd,
        });

    const patch = construirPatchCeldaDia({
      celdaAntes,
      alineado,
      accion,
      motivo,
      actor_persona_id: actor.actor_persona_id,
      origen,
      snapshotBorrado: prep.snapshotBorrado,
    });

    if (patch.write_skipped) {
      writeSkipped = true;
      return;
    }

    const updatePayload = {
      [`dias.${diaKey}.fichadas_reales`]: patch.celdaNueva.fichadas_reales,
      [`dias.${diaKey}.advertencias_fichada_abiertas`]: patch.celdaNueva.advertencias_fichada_abiertas,
      [`dias.${diaKey}.fichadas_borradas`]: patch.celdaNueva.fichadas_borradas,
      [`dias.${diaKey}.resuelto_rrhh`]: patch.celdaNueva.resuelto_rrhh,
      [`dias.${diaKey}.fichadas_reales_version`]: patch.celdaNueva.fichadas_reales_version,
      persona_id,
      grupo_de_trabajo_id: grupo_trabajo_id,
      anio,
      mes,
    };
    if (patch.celdaNueva.resuelto_rrhh) {
      updatePayload[`dias.${diaKey}.resuelto_rrhh_por_persona_id`] = patch.celdaNueva.resuelto_rrhh_por_persona_id;
      updatePayload[`dias.${diaKey}.resuelto_rrhh_motivo_corto`] = patch.celdaNueva.resuelto_rrhh_motivo_corto;
    }

    tx.set(ref, updatePayload, { merge: true });
    const { leerVersionCeldaFichada } = require("./fichadasMarcasUtils");
    versionNueva = leerVersionCeldaFichada(celdaAntes) + 1;
  });

  if (writeSkipped) {
    return { ok: true, write_skipped: true, vis_id: visId, evt_id: null };
  }

  await registrarEventoFichadaSiCorresponde(db, {
    evtId,
    persona_id,
    actor_uid: actor.actor_uid,
    actor_persona_id: actor.actor_persona_id,
    accion,
    fecha_ymd,
    grupo_trabajo_id,
    motivo,
    origen,
  });

  return {
    ok: true,
    write_skipped: false,
    vis_id: visId,
    evt_id: evtId,
    fichadas_reales_version: versionNueva,
  };
}

async function cargarMapaEnrolamientoReloj(db, reloj_id) {
  const snap = await db.collection(COL_RPE).where("reloj_id", "==", reloj_id).get();
  /** @type {Map<string, { persona_id: string, grupo_trabajo_id: string | null, multi_cargo_universal?: boolean }>} */
  const map = new Map();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (d.activo === false) continue;
    const tarjeta = String(d.numero_tarjeta || "").trim();
    const pid = String(d.persona_id || "").trim();
    const gdt = String(d.grupo_trabajo_id || "").trim();
    if (!tarjeta || !/^per_/i.test(pid)) continue;
    if (d.multi_cargo_universal === true || !/^gdt_/i.test(gdt)) {
      map.set(tarjeta, {
        persona_id: pid,
        grupo_trabajo_id: /^gdt_/i.test(gdt) ? gdt : null,
        multi_cargo_universal: d.multi_cargo_universal === true || !/^gdt_/i.test(gdt),
      });
      continue;
    }
    map.set(tarjeta, { persona_id: pid, grupo_trabajo_id: gdt, multi_cargo_universal: false });
  }
  return map;
}

async function insertarMarcasHuerfanasBatch(db, lineas, reloj_id, import_lote_id) {
  const ops = lineas.map((linea) => ({
    reloj_id,
    numero_tarjeta: linea.numero_tarjeta,
    fecha_ymd: linea.fecha_ymd,
    hora_hm: linea.hora_hm,
    codigo_dispositivo: linea.codigo_dispositivo || null,
    origen: "IMPORT_TXT",
    import_lote_id: import_lote_id || null,
    estado: ESTADO_FMH_PENDIENTE,
    persona_id: null,
  }));

  const chunks = segmentarOperacionesFirestore(ops);
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const row of chunk) {
      batch.set(db.collection(COL_FMH).doc(`fmh_${ulid()}`), {
        ...row,
        creado_en: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return ops.length;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function aplicarImportFichadasReloj(db, params, actor) {
  const reloj_id = String(params.reloj_id || "").trim();
  let grupo_trabajo_id = String(params.grupo_trabajo_id || "").trim();
  let contenido_txt = typeof params.contenido_txt === "string" ? params.contenido_txt : "";
  const import_lote_id = typeof params.import_lote_id === "string" ? params.import_lote_id.trim() : "";

  if (!/^rel_/i.test(reloj_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "reloj_id inválido." };
  }

  const relojSnap = await db.collection("cfg_reloj_biometrico").doc(reloj_id).get();
  const relojGrupoCfg = relojSnap.exists
    ? String(relojSnap.get("grupo_trabajo_id") || "").trim()
    : "";
  if (!grupo_trabajo_id && relojGrupoCfg) {
    grupo_trabajo_id = relojGrupoCfg;
  }

  if (import_lote_id && !contenido_txt) {
    const filSnap = await db.collection(COL_FIL).doc(import_lote_id).get();
    if (!filSnap.exists) {
      return { ok: false, codigo: "LOTE_NO_ENCONTRADO", mensaje: "import_lote_id no existe." };
    }
    contenido_txt = String(filSnap.get("contenido_txt") || "");
  }
  if (!contenido_txt.trim()) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "contenido_txt vacío." };
  }

  const mascara_tokens = relojSnap.exists
    ? String(relojSnap.get("mascara_tokens") || "").trim()
    : "";
  const parseadas = parseTxtRelojBiometrico(contenido_txt, { mascara_tokens }).filter((l) => l.ok);
  const enrolMap = await cargarMapaEnrolamientoReloj(db, reloj_id);
  const conAdvertencias = detectarDuplicadosProbablesEnLote(parseadas, {
    umbral_duplicado_minutos: params.umbral_duplicado_minutos,
  });

  const relojUniversal = relojEsUniversalPorGrupoCfg(relojGrupoCfg);
  const { conPersona, huerfanas } = await expandirMarcasPorEnrolamientoYMultiCargo(db, {
    marcas: conAdvertencias,
    enrolMap,
    relojUniversal,
  });

  const porVis = agruparMarcasPorClaveVis(conPersona, (m) =>
    claveVisImportMarca(m, { persona_id: m.persona_id, grupo_trabajo_id: m.grupo_trabajo_id }),
  );

  let visTocados = 0;
  let writeSkipped = 0;
  const evtIds = [];

  for (const [visKey, marcasVis] of porVis.entries()) {
    const sample = marcasVis[0];
    const persona_id = sample.persona_id;
    const gdtDestino = String(sample.grupo_trabajo_id || "").trim();
    if (!/^gdt_/i.test(gdtDestino)) continue;
    const { anio, mes } = anioMesDesdeYmd(sample.fecha_ymd);
    const visId = buildVisDocumentId(persona_id, `${anio}-${String(mes).padStart(2, "0")}-01`, gdtDestino);

    for (const f of [...new Set(marcasVis.map((m) => m.fecha_ymd))]) {
      await assertPeriodoNoCerrado(db, persona_id, f, gdtDestino);
    }

    let skippedTx = false;
    await db.runTransaction(async (tx) => {
      const ref = db.collection(COL_VIS).doc(visId);
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      const dias = data.dias && typeof data.dias === "object" ? data.dias : {};

      const fechas = [...new Set(marcasVis.map((m) => m.fecha_ymd))];
      const celdas_por_fecha = {};
      for (const f of fechas) {
        const dk = diaMesKeyDesdeYmd(f);
        celdas_por_fecha[f] = (dk && dias[dk]) || {};
      }

      const marcasMerge = [];
      for (const f of fechas) {
        const dk = diaMesKeyDesdeYmd(f);
        const existentes = marcasDesdeFichadasRealesExistentes(dias[dk]?.fichadas_reales, f);
        const nuevas = marcasVis.filter((m) => m.fecha_ymd === f);
        marcasMerge.push(...unirMarcasSinDuplicarInstante([existentes, nuevas]));
      }

      const alineado = alinearMarcasConTeoriaEnCalendario({ marcas: marcasMerge, celdas_por_fecha });
      const updatePayload = {
        persona_id,
        grupo_de_trabajo_id: gdtDestino,
        anio,
        mes,
      };
      let huboDelta = false;

      for (const [fecha_ymd, resultado] of Object.entries(alineado.dias || {})) {
        const diaKey = diaMesKeyDesdeYmd(fecha_ymd);
        if (!diaKey) continue;
        const celdaAntes = dias[diaKey] || {};
        const delta = evaluarDeltaCeldaDia({
          fichadas_reales_antes: celdaAntes.fichadas_reales,
          fichadas_reales_despues: resultado.fichadas_reales,
          advertencias_antes: celdaAntes.advertencias_fichada_abiertas,
          advertencias_despues: resultado.advertencias_fichada_abiertas,
        });
        if (!delta.tiene_delta) continue;
        huboDelta = true;
        updatePayload[`dias.${diaKey}.fichadas_reales`] = resultado.fichadas_reales;
        updatePayload[`dias.${diaKey}.advertencias_fichada_abiertas`] = resultado.advertencias_fichada_abiertas;
        updatePayload[`dias.${diaKey}.resuelto_rrhh`] = false;
        updatePayload[`dias.${diaKey}.fichadas_reales_version`] = FieldValue.increment(1);
      }

      if (!huboDelta) {
        skippedTx = true;
        return;
      }
      tx.set(ref, updatePayload, { merge: true });
    });

    if (skippedTx) {
      writeSkipped += 1;
    } else {
      visTocados += 1;
      const evtId = `evt_${ulid()}`;
      evtIds.push(evtId);
      await registrarEventoFichadaSiCorresponde(db, {
        evtId,
        persona_id,
        actor_uid: actor.actor_uid,
        actor_persona_id: actor.actor_persona_id,
        accion: "aplicar_import_fichadas",
        fecha_ymd: marcasVis[0].fecha_ymd,
        grupo_trabajo_id: gdtDestino,
        motivo: `Import lote ${import_lote_id || "directo"}`,
        origen: "IMPORT_TXT",
      });
    }
  }

  const huerfanasInsertadas = huerfanas.length
    ? await insertarMarcasHuerfanasBatch(db, huerfanas, reloj_id, import_lote_id || null)
    : 0;

  if (import_lote_id) {
    await db.collection(COL_FIL).doc(import_lote_id).set(
      {
        estado: "APLICADO",
        aplicado_en: FieldValue.serverTimestamp(),
        aplicado_por_persona_id: actor.actor_persona_id,
      },
      { merge: true },
    );
  }

  return {
    ok: true,
    lineas_parseadas: parseadas.length,
    vis_documentos_tocados: visTocados,
    write_skipped_vis: writeSkipped,
    huerfanas_insertadas: huerfanasInsertadas,
    evt_ids: evtIds,
  };
}

module.exports = {
  ACCIONES_VALIDAS,
  guardarCapaFichadaDia,
  aplicarImportFichadasReloj,
  prepararMarcasParaAlineacion,
  construirPatchCeldaDia,
  validarVersionCeldaFichada,
  registrarEventoFichadaSiCorresponde,
};
