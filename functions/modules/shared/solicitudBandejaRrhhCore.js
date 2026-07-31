"use strict";

const { FieldValue } = require("./context");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
  ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
  ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
} = require("./solicitudesArticuloEstados");
const { TIPO_EVENTO_TICKET, ORIGEN_EVENTO } = require("./solicitudEventosTicketConstants");
const { registrarEventoTicket } = require("./registrarEventoTicket");

/**
 * Estados sobre los que RRHH puede actuar (Oleada A — RFC §2 ítem 17). Es el
 * conjunto de la vista por defecto: lo que espera una acción suya.
 */
const ESTADOS_BANDEJA_RRHH_ACCIONABLES = [
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
];

/**
 * Todo trámite ya presentado. Queda afuera solo el borrador, que todavía no
 * salió del agente y por lo tanto no es asunto de RRHH.
 */
const ESTADOS_BANDEJA_RRHH_TODOS = [
  ...ESTADOS_BANDEJA_RRHH_ACCIONABLES,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
  ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
  ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
  ESTADO_SOLICITUD_RECHAZADA,
];

/**
 * @param {Record<string, unknown>} sol
 */
function bandejaRrhhModoItem(sol) {
  const est = String(sol.estado_solicitud_id || "").trim();
  if (est === ESTADO_SOLICITUD_EN_REVISION_RRHH) {
    return {
      modo: "legacy_rrhh",
      puede_aprobar_rechazar: true,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Pendiente RRHH (legacy)",
    };
  }
  if (est === ESTADO_SOLICITUD_EN_REVISION_JEFE && sol.autorizacion_rrhh_sustituta === true) {
    return {
      modo: "cierre_sustituta",
      puede_aprobar_rechazar: true,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Huérfana — cierre RRHH",
    };
  }
  if (est === ESTADO_SOLICITUD_EN_REVISION_JEFE) {
    return {
      modo: "visibilidad_jefe",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "En revisión por jefatura",
    };
  }
  if (est === ESTADO_SOLICITUD_APROBADA) {
    if (sol.rrhh_toma_conocimiento_en) {
      return {
        modo: "toma_conocimiento_ok",
        puede_aprobar_rechazar: false,
        puede_registrar_toma_conocimiento: false,
        etiqueta_estado: "Toma de conocimiento registrada",
      };
    }
    return {
      modo: "toma_conocimiento",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: true,
      etiqueta_estado: "Aprobada — pendiente toma de conocimiento RRHH",
    };
  }
  if (est === ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION) {
    return {
      modo: "aprobada_pendiente_aplicacion",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Aprobada — pendiente de aplicación",
    };
  }
  if (est === ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA) {
    return {
      modo: "circuito_medico",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "En auditoría médica",
    };
  }
  if (est === ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA) {
    return {
      modo: "circuito_medico",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "En junta médica",
    };
  }
  if (est === ESTADO_SOLICITUD_RECHAZADA) {
    return {
      modo: "rechazada",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Rechazada",
    };
  }
  return {
    modo: "otro",
    puede_aprobar_rechazar: false,
    puede_registrar_toma_conocimiento: false,
    etiqueta_estado: est,
  };
}
const {
  loadArticuloDisplay,
  loadPersonaBandeja,
  loadGrupoAnclaLabel,
  resolverDecisionJefeSolicitud,
  esHuerfanaEnRevisionJefe,
} = require("./solicitudBandejaJefeCore");
const { trazabilidadResolucionSolicitud } = require("./solicitudTrazabilidadResolucion");
const { esSnapshotMotorV2, snapshotTieneAdvertencias } = require("./motorSnapshotFlags");
const { revisorPuedeAutorizarJerarquico } = require("./solicitudAutorizacionJerarquicaCore");
const { revertirMotorBolsaPatronBEnTx } = require("./solicitudPatronBReversoSaldo");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcTicketeraEmisor");

const {
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
} = require("./solicitudBandejaListUtils");

const COL_SOL = "solicitudes_articulo";
const SCAN_LIMIT = 400;

const FILTRO_VISTA_PENDIENTES = "pendientes";
const FILTRO_VISTA_TODOS = "todos";

/**
 * Estados que hace falta traer de Firestore para resolver cada vista.
 *
 * Se acota por vista y no se consulta siempre el conjunto completo: el escaneo
 * está topeado en `SCAN_LIMIT`, así que traer estados que la vista va a
 * descartar en memoria le come lugar a los que sí importan.
 * @param {string} v
 */
function estadosQueryPorVista(v) {
  if (v === FILTRO_VISTA_TODOS) return ESTADOS_BANDEJA_RRHH_TODOS;
  if (v === "rechazados") return [ESTADO_SOLICITUD_RECHAZADA];
  if (v === "aprobados") {
    return [ESTADO_SOLICITUD_APROBADA, ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION];
  }
  if (v === "aprobada_pendiente_aplicacion") {
    return [ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION];
  }
  if (v === "toma_conocimiento_pendiente" || v === "toma_conocimiento_ok") {
    return [ESTADO_SOLICITUD_APROBADA];
  }
  if (v === "en_revision_jefe" || v === "huerfanas") {
    return [ESTADO_SOLICITUD_EN_REVISION_JEFE];
  }
  if (v === "en_revision_rrhh") return [ESTADO_SOLICITUD_EN_REVISION_RRHH];
  if (v === "circuito_medico") {
    return [
      ESTADO_SOLICITUD_PENDIENTE_CLASIFICACION_MEDICA,
      ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA,
    ];
  }
  return ESTADOS_BANDEJA_RRHH_ACCIONABLES;
}

/**
 * @param {unknown} raw
 */
function parseBandejaRrhhListOpts(raw) {
  return parseBandejaListPageOpts(raw, { filtroDefault: FILTRO_VISTA_PENDIENTES });
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} filtroVista
 */
function itemPasaFiltroVista(item, filtroVista) {
  const v = String(filtroVista || FILTRO_VISTA_PENDIENTES);
  const est = String(item.estado_solicitud_id);
  if (v === FILTRO_VISTA_TODOS) return true;
  if (v === FILTRO_VISTA_PENDIENTES) {
    return item.puede_aprobar_rechazar === true || item.puede_registrar_toma_conocimiento === true;
  }
  if (v === "aprobados") {
    return est === ESTADO_SOLICITUD_APROBADA || est === ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION;
  }
  if (v === "aprobada_pendiente_aplicacion") {
    return est === ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION;
  }
  if (v === "rechazados") return est === ESTADO_SOLICITUD_RECHAZADA;
  if (v === "en_revision_jefe") return est === ESTADO_SOLICITUD_EN_REVISION_JEFE;
  if (v === "en_revision_rrhh") return est === ESTADO_SOLICITUD_EN_REVISION_RRHH;
  if (v === "circuito_medico") return item.bandeja_rrhh_modo === "circuito_medico";
  if (v === "huerfanas") return item.bandeja_rrhh_modo === "cierre_sustituta";
  if (v === "toma_conocimiento_pendiente") return item.bandeja_rrhh_modo === "toma_conocimiento";
  if (v === "toma_conocimiento_ok") return item.bandeja_rrhh_modo === "toma_conocimiento_ok";
  return true;
}

/**
 * ¿El trámite pertenece a un par de la familia Art. 64? Se responde con el
 * snapshot que deja el alta, sin ir a cfg: solo hace falta para no adelantar la
 * modalidad en la etiqueta mientras jefatura no decidió.
 * @param {Record<string, unknown>} sol
 */
function esFamilia64PorSnapshot(sol) {
  if (sol.articulo_familia_64 === true) return true;
  return (
    /^art_/i.test(String(sol.articulo_id_con_goce || "").trim()) &&
    /^art_/i.test(String(sol.articulo_id_sin_goce || "").trim())
  );
}

/**
 * Nombres de los autorizadores del snapshot. RRHH necesita saber a quién le
 * tocaba firmar, y el id no se lo dice.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {unknown} ids
 * @param {Map} personaCache
 */
async function labelsAutorizadores(db, ids, personaCache) {
  const lista = (Array.isArray(ids) ? ids : [])
    .map((x) => String(x || "").trim())
    .filter((x) => /^per_/i.test(x));
  const filas = await Promise.all(lista.map((id) => loadPersonaBandeja(db, id, personaCache)));
  return filas.map((f) => f.label);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {{ label: string, dni: string }} personaRow
 * @param {{ persona: Map, articulo: Map, grupo: Map }} caches
 */
async function itemListaBandejaRrhh(db, sol, personaRow, caches) {
  const titularId = String(sol.titular_persona_id || "").trim();
  const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
  const artId = String(sol.articulo_id || "").trim();
  const anclaId = String(sol.grupo_trabajo_id_ancla || "").trim();
  const jefeId = String(sol.jefe_revision_persona_id || "").trim();

  const [artDisplay, anclaLabel, autorizadoresLabels, jefeRow, trazabilidad] = await Promise.all([
    loadArticuloDisplay(db, artId, caches.articulo),
    loadGrupoAnclaLabel(db, anclaId, caches.grupo),
    labelsAutorizadores(db, sol.autorizadores_elegibles_ids, caches.persona),
    /^per_/i.test(jefeId) ? loadPersonaBandeja(db, jefeId, caches.persona) : null,
    trazabilidadResolucionSolicitud(db, sol, caches.articulo),
  ]);

  const modo = bandejaRrhhModoItem(sol);
  const snapshotMotor =
    sol.motor_snapshot && typeof sol.motor_snapshot === "object" ? sol.motor_snapshot : null;

  return {
    solicitud_id: String(sol.id || ""),
    articulo_id: artId,
    articulo_label: artDisplay.articulo_label,
    codigo_grilla: artDisplay.codigo_grilla,
    articulo_nombre: artDisplay.nombre,
    articulo_familia_64: esFamilia64PorSnapshot(sol),
    modalidad_goce_jefe: sol.modalidad_goce_jefe != null ? String(sol.modalidad_goce_jefe) : null,
    titular_persona_id: titularId,
    titular_label: personaRow.label,
    titular_dni: personaRow.dni || null,
    fecha_desde: fechaRef,
    fecha_hasta: String(sol.fecha_hasta || fechaRef).slice(0, 10),
    dias_solicitados: Number(sol.dias_solicitados) || 1,
    patron_saldo: String(sol.patron_saldo || ""),
    estado_solicitud_id: sol.estado_solicitud_id,
    creado_en: sol.creado_en || null,
    grupo_trabajo_id_ancla: anclaId || null,
    // RRHH cae al id si el grupo no tiene nombre: perder el dato le rompe la
    // trazabilidad, que es justamente para lo que lo mira.
    grupo_trabajo_ancla_label: anclaLabel || anclaId || null,
    jefe_revision_en: sol.jefe_revision_en || null,
    jefe_revision_persona_id: jefeId || null,
    jefe_revision_label: jefeRow ? jefeRow.label : null,
    jefe_motivo: sol.jefe_motivo != null ? String(sol.jefe_motivo) : null,
    rrhh_revision_en: sol.rrhh_revision_en || null,
    rrhh_revision_persona_id: String(sol.rrhh_revision_persona_id || "").trim() || null,
    rrhh_motivo: sol.rrhh_motivo != null ? String(sol.rrhh_motivo) : null,
    rrhh_toma_conocimiento_motivo:
      sol.rrhh_toma_conocimiento_motivo != null ? String(sol.rrhh_toma_conocimiento_motivo) : null,
    rrhh_toma_conocimiento_en: sol.rrhh_toma_conocimiento_en || null,
    autorizadores_elegibles_ids: Array.isArray(sol.autorizadores_elegibles_ids)
      ? sol.autorizadores_elegibles_ids
      : [],
    autorizadores_elegibles_labels: autorizadoresLabels,
    autorizacion_rrhh_sustituta: sol.autorizacion_rrhh_sustituta === true,
    bandeja_rrhh_modo: modo.modo,
    puede_aprobar_rechazar: modo.puede_aprobar_rechazar,
    puede_registrar_toma_conocimiento: modo.puede_registrar_toma_conocimiento === true,
    etiqueta_estado: modo.etiqueta_estado,
    trazabilidad,
    // El veredicto del motor se pide aparte: en el listado solo viajan los dos
    // flags que la UI necesita para decidir si ofrece el bloque y si avisa.
    motor_tiene_veredicto: esSnapshotMotorV2(snapshotMotor),
    motor_tiene_advertencias: snapshotTieneAdvertencias(snapshotMotor),
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("./solicitudBandejaRrhhCore").parseBandejaRrhhListOpts} optsParsed — ver parseBandejaRrhhListOpts
 */
async function listarSolicitudesBandejaRrhh(db, opts = {}) {
  const { filtroVista, dni, usuario, cursor, pageSize } = parseBandejaRrhhListOpts(opts);
  const estadosQuery = estadosQueryPorVista(filtroVista);

  let titularIdsDni = null;
  if (dni) {
    titularIdsDni = await resolverPersonaIdsPorDni(db, dni);
    if (titularIdsDni && titularIdsDni.size === 0) {
      return {
        solicitudes: [],
        page_info: {
          page_size: pageSize,
          has_more: false,
          next_cursor: null,
          total_filtrado: 0,
        },
        filtros: { filtro_vista: filtroVista, dni, usuario: usuario || null },
      };
    }
  }

  const snap = await db
    .collection(COL_SOL)
    .where("estado_solicitud_id", "in", estadosQuery)
    .limit(SCAN_LIMIT)
    .get();

  const out = [];
  const caches = { persona: new Map(), articulo: new Map(), grupo: new Map() };

  for (const doc of snap.docs) {
    const sol = { id: doc.id, ...(doc.data() || {}) };
    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;
    if (titularIdsDni && !titularIdsDni.has(titularId)) continue;

    const personaRow = await loadPersonaBandeja(db, titularId, caches.persona);

    if (usuario) {
      const hayUsuario =
        String(personaRow.label || "")
          .toLowerCase()
          .includes(usuario) ||
        String(personaRow.dni || "").includes(usuario.replace(/\D/g, ""));
      if (!hayUsuario) continue;
    }

    const item = await itemListaBandejaRrhh(db, sol, personaRow, caches);
    if (!itemPasaFiltroVista(item, filtroVista)) continue;
    out.push(item);
  }

  out.sort((a, b) => String(a.fecha_desde).localeCompare(String(b.fecha_desde)));
  const page = paginarBandejaOrdenada(out, { cursor, pageSize });

  return {
    solicitudes: page.solicitudes,
    page_info: {
      page_size: pageSize,
      has_more: page.has_more,
      next_cursor: page.next_cursor,
      total_filtrado: page.total_filtrado,
      scan_limit: SCAN_LIMIT,
    },
    filtros: {
      filtro_vista: filtroVista,
      dni: dni || null,
      usuario: usuario || null,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {"aprobar"|"rechazar"} decision
 * @param {string} motivo
 */
/**
 * @param {Record<string, unknown>} sol
 * @returns {"cierre_sustituta"|"legacy_rrhh"|"invalido"}
 */
function tipoFlujoResolverDecisionRrhh(sol) {
  if (esHuerfanaEnRevisionJefe(sol)) return "cierre_sustituta";
  if (String(sol.estado_solicitud_id || "").trim() === ESTADO_SOLICITUD_EN_REVISION_RRHH) {
    return "legacy_rrhh";
  }
  return "invalido";
}

async function resolverDecisionRrhhSolicitud(db, solId, revisorPersonaId, decision, motivo) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  const flujo = tipoFlujoResolverDecisionRrhh(sol);

  if (flujo === "cierre_sustituta") {
    if (!revisorPuedeAutorizarJerarquico(sol, revisorPersonaId, { rrhhSustituto: true })) {
      return {
        ok: false,
        codigo: "PERMISSION_DENIED",
        mensaje: "No tenés permiso de cierre sustituto RRHH para esta solicitud.",
      };
    }
    return resolverDecisionJefeSolicitud(db, solId, revisorPersonaId, decision, motivo, false, {
      rrhhSustituto: true,
    });
  }

  if (flujo !== "legacy_rrhh") {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje:
        "La solicitud no está en revisión RRHH (legacy) ni es huérfana pendiente de cierre sustituto.",
    };
  }

  const titularId = String(sol.titular_persona_id || "").trim();

  if (decision === "aprobar") {
    await solRef.update({
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      rrhh_revision_persona_id: revisorPersonaId,
      rrhh_revision_en: FieldValue.serverTimestamp(),
      rrhh_motivo: motivo || null,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      {
        ...sol,
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        codigo_grilla: artDisplay.codigo_grilla,
      },
      MDC_COMANDO_CONSOLIDAR_APROBADO,
    );
    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
    };
  }

  if (decision === "rechazar") {
    let reverso = false;
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_RRHH) return;

      reverso = await revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId);

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        rrhh_revision_persona_id: revisorPersonaId,
        rrhh_revision_en: FieldValue.serverTimestamp(),
        rrhh_motivo: motivo || null,
        motor_reverso_rrhh_aplicado: cur.motor_descuento_aplicado === true,
        actualizado_en: FieldValue.serverTimestamp(),
      });
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      { ...sol, codigo_grilla: artDisplay.codigo_grilla },
      MDC_COMANDO_REVERTIR_PROYECCION,
    );

    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
      motor_reverso_rrhh_aplicado: reverso,
    };
  }

  return { ok: false, codigo: "DECISION_INVALIDA", mensaje: "Decisión inválida." };
}

/**
 * Toma de conocimiento RRHH (Oleada A4): no cambia estado sustantivo.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {string} motivo
 */
async function registrarTomaConocimientoRrhhSolicitud(db, solId, revisorPersonaId, motivo) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_APROBADA) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "Solo se registra toma de conocimiento en solicitudes ya aprobadas por jefatura.",
    };
  }
  if (sol.rrhh_toma_conocimiento_en) {
    return {
      ok: false,
      codigo: "TC_YA_REGISTRADA",
      mensaje: "La toma de conocimiento ya fue registrada.",
    };
  }

  await solRef.update({
    rrhh_toma_conocimiento_persona_id: revisorPersonaId,
    rrhh_toma_conocimiento_en: FieldValue.serverTimestamp(),
    rrhh_toma_conocimiento_motivo: motivo || null,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const titularId = String(sol.titular_persona_id || "").trim();
  void registrarEventoTicket(db, solId, {
    tipo_evento: TIPO_EVENTO_TICKET.TOMA_CONOCIMIENTO_RRHH,
    actor_persona_id: revisorPersonaId,
    titular_persona_id: titularId,
    estado_anterior_id: ESTADO_SOLICITUD_APROBADA,
    estado_nuevo_id: ESTADO_SOLICITUD_APROBADA,
    origen: ORIGEN_EVENTO.CALLABLE,
    accion: "rrhh_toma_conocimiento",
    metadata: {
      rrhh_toma_conocimiento_motivo: motivo || null,
      articulo_id: String(sol.articulo_id || "") || null,
      fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
      codigo_grilla: sol.codigo_grilla || null,
    },
  });

  return {
    ok: true,
    solicitud_id: solId,
    estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
  };
}

module.exports = {
  listarSolicitudesBandejaRrhh,
  resolverDecisionRrhhSolicitud,
  registrarTomaConocimientoRrhhSolicitud,
  tipoFlujoResolverDecisionRrhh,
  bandejaRrhhModoItem,
  parseBandejaRrhhListOpts,
  itemPasaFiltroVista,
  estadosQueryPorVista,
  paginarBandejaOrdenada: paginarBandejaOrdenada,
  FILTRO_VISTA_PENDIENTES,
  FILTRO_VISTA_TODOS,
};
