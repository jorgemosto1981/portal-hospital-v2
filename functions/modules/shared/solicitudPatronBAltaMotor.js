"use strict";

/**
 * Motor alta solicitud Patrón B (64-A MVP).
 */
const { parseYmd } = require("./laoPreviewMotor");
const { saldoAnualDocId, pickBolsaParaConsumo } = require("./laoSaldosBolsa");
const { resolvePatronSaldo, PATRON_SALDO_B } = require("./resolvePatronSaldo");
const {
  mapHlcRow,
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
  mensajeParaCodigo,
  CODIGO_SALDO_CICLO,
  CODIGO_SALDO_MES,
  CODIGO_SALDO_EVENTO,
  CODIGO_FECHA_RANGO,
  CODIGO_SUPERPOSICION,
  CODIGO_GRUPO_ANCLA_REQUERIDO,
  CODIGO_GRUPO_ANCLA_INVALIDO,
  CODIGO_SIN_GRUPO_VIGENTE,
} = require("./solicitudElegibilidadLaboral");
const { validarSuperposicionFechasPatronB } = require("./patronBSuperposicionValidacion");
const { resolverGrupoTrabajoIdAnclaParaSolicitud } = require("./solicitudGrupoTrabajoAncla");
const { validarGrillaHorariaParaSolicitud } = require("./mdcGrillaHorariaGate");
const { tokenHasRrhhLaborAccess } = require("./laborProfile");
const {
  validarFechasArticuloEnMotor,
  readModoCalculo,
} = require("./validarFechasArticuloRuntime");

const ESTADOS_CUENTAN_FRECUENCIA_MES = new Set([
  "cfg_esa_borrador",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
  "cfg_esa_aprobada",
]);

function patronFromVersion(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  const topes = versionData?.bloque_topes_plazos_computo || {};
  return resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, ident.es_lao_anual === true);
}

function resolveExternosDesdePersona(persona) {
  if (!persona || typeof persona !== "object") return 0;
  const n = Number(persona.antiguedad_reconocida_dias ?? persona.dias_antiguedad_reconocida);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function loadHlcArray(db, personaId) {
  const snap = await db.collection("historial_laboral_cargos").where("persona_id", "==", personaId).get();
  return snap.docs.map((doc) => mapHlcRow({ ...(doc.data() || {}), id: doc.id }, doc.id));
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {string} articuloId
 * @param {number} anio
 * @param {number} mes 1-12
 */
async function countSolicitudesMesArticulo(db, personaId, articuloId, anio, mes, excludeSolId = "") {
  const snap = await db
    .collection("solicitudes_articulo")
    .where("titular_persona_id", "==", personaId)
    .where("articulo_id", "==", articuloId)
    .get();
  let n = 0;
  for (const doc of snap.docs) {
    if (excludeSolId && doc.id === excludeSolId) continue;
    const s = doc.data() || {};
    if (s.estado_solicitud_id === "cfg_esa_rechazada") continue;
    const fd = typeof s.fecha_desde === "string" ? s.fecha_desde.slice(0, 10) : "";
    const p = parseYmd(fd);
    if (!p || p.y !== anio || p.mo !== mes) continue;
    if (!ESTADOS_CUENTAN_FRECUENCIA_MES.has(String(s.estado_solicitud_id || ""))) continue;
    n += 1;
  }
  return n;
}

/**
 * @param {{
 *   db: import("firebase-admin/firestore").Firestore,
 *   solicitud: Record<string, unknown>,
 *   excludeSolId?: string,
 *   authToken?: unknown,
 * }} params
 */
async function runPatronBAltaMotor(params) {
  const { db, solicitud, excludeSolId, authToken } = params;
  const personaId = String(solicitud.titular_persona_id || "").trim();
  const articuloId = String(solicitud.articulo_id || "").trim();
  const versionId = String(
    solicitud.version_id_aplicada ||
      solicitud.version_aplicada_id ||
      solicitud.version_aplicada ||
      "",
  ).trim();
  const fechaDesde = String(solicitud.fecha_desde || "").slice(0, 10);
  const fechaHasta = String(solicitud.fecha_hasta || "").slice(0, 10);
  const diasSolicitados = Number(solicitud.dias_solicitados);
  const anioCiclo = Number(solicitud.anio_ciclo_consumo);

  const pDesde = parseYmd(fechaDesde);
  if (!pDesde) {
    return { ok: false, codigos: [CODIGO_FECHA_RANGO], mensajes: [mensajeParaCodigo(CODIGO_FECHA_RANGO)] };
  }
  if (anioCiclo !== pDesde.y) {
    return { ok: false, codigos: [CODIGO_FECHA_RANGO], mensajes: [mensajeParaCodigo(CODIGO_FECHA_RANGO)] };
  }

  const [personaSnap, versionSnap] = await Promise.all([
    db.collection("personas").doc(personaId).get(),
    db.collection("cfg_articulos").doc(articuloId).collection("versiones").doc(versionId).get(),
  ]);

  if (!personaSnap.exists || !versionSnap.exists) {
    return { ok: false, codigos: ["NOT_FOUND"], mensajes: ["Artículo o persona no encontrados."] };
  }

  const versionData = versionSnap.data() || {};
  if (String(versionData.estado_version_id || "").trim() !== "cfg_est_ver_publicada") {
    return { ok: false, codigos: ["VERSION_NO_PUBLICADA"], mensajes: ["La versión del artículo no está publicada."] };
  }

  if (patronFromVersion(versionData) !== PATRON_SALDO_B) {
    return { ok: false, codigos: ["PATRON_INVALIDO"], mensajes: ["El artículo no es Patrón B."] };
  }

  const topes = versionData.bloque_topes_plazos_computo || {};
  const topeEvento = Number(topes.tope_dias_por_evento);
  const topeMes = Number(topes.tope_frecuencia_mensual);
  const diasPedidos = Number.isFinite(diasSolicitados) && diasSolicitados > 0 ? Math.floor(diasSolicitados) : 1;

  if (Number.isFinite(topeEvento) && topeEvento > 0 && diasPedidos !== topeEvento) {
    return { ok: false, codigos: [CODIGO_SALDO_EVENTO], mensajes: [mensajeParaCodigo(CODIGO_SALDO_EVENTO)] };
  }

  let fechaHastaEff = fechaHasta || fechaDesde;
  const fechasVal = await validarFechasArticuloEnMotor(db, {
    versionData,
    fechaDesde,
    fechaHasta: fechaHastaEff,
    diasSolicitados: diasPedidos,
    omitirHorizonte: tokenHasRrhhLaborAccess(authToken),
  });
  if (!fechasVal.ok) {
    return {
      ok: false,
      codigos: fechasVal.codigos,
      mensajes: fechasVal.mensajes,
      calendario_resumen: fechasVal.calendario_resumen || null,
    };
  }
  fechaHastaEff = fechasVal.fecha_hasta || fechaDesde;
  if (readModoCalculo(versionData).modo === "CORRIDOS" && fechaHastaEff !== fechaDesde) {
    return { ok: false, codigos: [CODIGO_FECHA_RANGO], mensajes: [mensajeParaCodigo(CODIGO_FECHA_RANGO)] };
  }

  const hlcArray = await loadHlcArray(db, personaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde);
  const diasExternos = resolveExternosDesdePersona(personaSnap.data() || {});

  const eleg = resolverElegibilidadSolicitud({
    versionData,
    hlcVigentes,
    personaId,
    fechaDesde,
    diasExternos,
    authToken,
    skipPortalRoleCheck: authToken == null,
  });
  if (!eleg.ok) {
    return { ok: false, codigos: eleg.codigos, mensajes: eleg.mensajes, hlc_id: null };
  }

  const grupoAncla = await resolverGrupoTrabajoIdAnclaParaSolicitud(db, {
    persona_id: personaId,
    fecha_desde: fechaDesde,
    grupo_trabajo_id_ancla:
      String(solicitud.grupo_trabajo_id_ancla || solicitud.grupo_de_trabajo_id || "").trim() ||
      null,
  });
  if (!grupoAncla.ok) {
    return {
      ok: false,
      codigos: [grupoAncla.codigo || CODIGO_GRUPO_ANCLA_REQUERIDO],
      mensajes: [grupoAncla.mensaje || mensajeParaCodigo(CODIGO_GRUPO_ANCLA_REQUERIDO)],
      hlc_id: eleg.hlc_id,
      requiere_seleccion_grupo: grupoAncla.requiere_seleccion === true,
      grupos_trabajo_vigentes: grupoAncla.grupos_vigentes || [],
    };
  }

  const superpos = await validarSuperposicionFechasPatronB(db, {
    persona_id: personaId,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHastaEff,
    exclude_sol_id: excludeSolId || "",
    version_data: versionData,
  });
  if (!superpos.ok) {
    return {
      ok: false,
      codigos: [superpos.codigo || CODIGO_SUPERPOSICION],
      mensajes: [superpos.mensaje || mensajeParaCodigo(CODIGO_SUPERPOSICION)],
      hlc_id: eleg.hlc_id,
      conflicto_solicitud_id: superpos.conflicto_solicitud_id || null,
    };
  }

  /** @type {{ en_mes: number, tope_mes: number } | null} */
  let frecuenciaMes = null;
  if (Number.isFinite(topeMes) && topeMes > 0) {
    const enMes = await countSolicitudesMesArticulo(
      db,
      personaId,
      articuloId,
      pDesde.y,
      pDesde.mo,
      excludeSolId || "",
    );
    frecuenciaMes = { en_mes: enMes, tope_mes: Math.floor(topeMes) };
    if (enMes >= topeMes) {
      return { ok: false, codigos: [CODIGO_SALDO_MES], mensajes: [mensajeParaCodigo(CODIGO_SALDO_MES)] };
    }
  }

  const salId = saldoAnualDocId(personaId, anioCiclo);
  if (!salId) {
    return { ok: false, codigos: [CODIGO_SALDO_CICLO], mensajes: [mensajeParaCodigo(CODIGO_SALDO_CICLO)] };
  }

  const salSnap = await db.collection("saldos_articulo_agente").doc(salId).get();
  if (!salSnap.exists) {
    return { ok: false, codigos: [CODIGO_SALDO_CICLO], mensajes: [mensajeParaCodigo(CODIGO_SALDO_CICLO)] };
  }

  const match = pickBolsaParaConsumo(salSnap.data() || {}, articuloId, anioCiclo);
  if (!match) {
    return { ok: false, codigos: [CODIGO_SALDO_CICLO], mensajes: [mensajeParaCodigo(CODIGO_SALDO_CICLO)] };
  }

  const disp = Number(match.bolsa.disponible);
  if (!Number.isFinite(disp) || disp < diasPedidos) {
    return { ok: false, codigos: [CODIGO_SALDO_CICLO], mensajes: [mensajeParaCodigo(CODIGO_SALDO_CICLO)] };
  }

  const gateGrilla = await validarGrillaHorariaParaSolicitud(db, {
    depende_rda: topes.depende_rda === true,
    persona_id: personaId,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHastaEff,
    grupo_trabajo_id: grupoAncla.grupo_trabajo_id_ancla || undefined,
  });
  if (!gateGrilla.ok) {
    return {
      ok: false,
      codigos: [gateGrilla.codigo || "GRILLA_NO_AUTORIZADA"],
      mensajes: [gateGrilla.mensaje || "Grilla horaria no autorizada."],
      hlc_id: eleg.hlc_id,
      grupo_trabajo_id_ancla: grupoAncla.grupo_trabajo_id_ancla,
    };
  }

  return {
    ok: true,
    codigos: [],
    mensajes: [],
    hlc_id: eleg.hlc_id,
    grupo_trabajo_id_ancla: grupoAncla.grupo_trabajo_id_ancla,
    grupos_trabajo_vigentes: grupoAncla.grupos_vigentes || [],
    dias_consumo: diasPedidos,
    anio_ciclo_consumo: anioCiclo,
    bolsa_id: match.bolsaId,
    saldo_doc_id: salId,
    articulo_id: articuloId,
    saldo_disponible: disp,
    saldo_restante_preview: disp - diasPedidos,
    frecuencia_mes: frecuenciaMes,
    fecha_hasta: fechaHastaEff,
    calendario_resumen: fechasVal.calendario_resumen || null,
    modo_computo: fechasVal.modo_computo || readModoCalculo(versionData).modo,
    usa_calendario_institucional: fechasVal.usa_calendario_institucional === true,
    incluye_feriados_institucionales: fechasVal.incluye_feriados_institucionales === true,
  };
}

module.exports = {
  runPatronBAltaMotor,
  patronFromVersion,
  loadHlcArray,
  countSolicitudesMesArticulo,
};
