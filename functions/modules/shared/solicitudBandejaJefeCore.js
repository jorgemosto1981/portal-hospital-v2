"use strict";

const { FieldValue } = require("./context");
const { revertirMotorBolsaPatronBEnTx } = require("./solicitudPatronBReversoSaldo");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcTicketeraEmisor");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
} = require("./solicitudesArticuloEstados");
const { solicitudEsCambioDia } = require("./cambioDiaSolicitudCore");
const { aplicarCambioDiaTrasAprobacionJefe } = require("./cambioDiaAplicarTrasAprobacion");
const { TIPO_EVENTO_TICKET, ORIGEN_EVENTO } = require("./solicitudEventosTicketConstants");
const { registrarEventoTicket } = require("./registrarEventoTicket");
const {
  CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS,
  mensajeParaCodigoAutorizacion,
} = require("./solicitudAutorizacionCodigos");
const {
  resolverCadenaAutorizacion,
  buildAutorizacionSnapshotFields,
  revisorPuedeAutorizarJerarquico,
  revalidarRevisorEnAutorizadores,
} = require("./solicitudAutorizacionJerarquicaCore");
const { modoResolucionJefeDesdeSolicitud } = require("./modoResolucionJefe");
const { etiquetaGrupoTrabajo } = require("./solicitudGrupoTrabajoAncla");
const { crearCacheAutorizacion } = require("./solicitudAutorizacionCache");
const { asyncMapLimite } = require("./asyncMapLimite");
const { normalizeArtId } = require("./familia64Config");
const {
  debeMaterializar770AlRechazar,
  materializarSol770DesdeRechazo,
} = require("./solicitudArt770DerivacionCore");
const {
  resolveVersionPublicadaId,
  aplicarModalidad64EnTx,
  countSolicitudesMesArticulo64,
  resolveFamilia64PairAsync,
} = require("./solicitudPatronBCruceModalidad64");
const { logger } = require("firebase-functions");

/**
 * @param {Record<string, unknown>} sol
 * @returns {boolean}
 */
function esHuerfanaEnRevisionJefe(sol) {
  return (
    String(sol.estado_solicitud_id || "").trim() === ESTADO_SOLICITUD_EN_REVISION_JEFE &&
    sol.autorizacion_rrhh_sustituta === true
  );
}

const {
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
} = require("./solicitudBandejaListUtils");

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";
const COL_CFG_ART = "cfg_articulos";
const SCAN_LIMIT = 400;
/** Lecturas en vuelo al resolver visibilidad/ítems del lote escaneado. */
const CONCURRENCIA_RESOLUCION = 10;
const FILTRO_JEFE_PENDIENTES = "pendientes";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {Map<string, { codigo_grilla: string, nombre: string, articulo_label: string }>} cache
 */
async function loadArticuloDisplay(db, articuloId, cache) {
  const id = String(articuloId || "").trim();
  if (!id) {
    return { codigo_grilla: "", nombre: "", articulo_label: "Solicitud" };
  }
  if (cache.has(id)) return cache.get(id);

  const snap = await db.collection(COL_CFG_ART).doc(id).get();
  const core = snap.exists ? snap.data() || {} : {};
  const codigo_grilla = String(core.codigo || core.nombre_corto || "").trim();
  const nombre = String(core.nombre || core.codigo || "").trim();
  let articulo_label = "Artículo";
  if (codigo_grilla && nombre) articulo_label = `${codigo_grilla} — ${nombre}`;
  else articulo_label = codigo_grilla || nombre || id;

  const row = { codigo_grilla, nombre, articulo_label };
  cache.set(id, row);
  return row;
}

/**
 * Oleada A: visibilidad bandeja jefe (sin bypass RRHH; huérfanas solo RRHH).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {string} revisorPersonaId
 * @param {ReturnType<typeof crearCacheAutorizacion>} [cache]
 */
async function revisorVeSolicitudEnBandejaJefe(db, sol, revisorPersonaId, cache) {
  if (sol.autorizacion_rrhh_sustituta === true) return false;

  const titularId = String(sol.titular_persona_id || "").trim();
  const ancla = String(sol.grupo_trabajo_id_ancla || "").trim();
  const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
  if (!/^per_/i.test(titularId) || !/^gdt_/i.test(ancla)) return false;

  const cadena = await resolverCadenaAutorizacion(
    db,
    { titularPersonaId: titularId, grupoTrabajoIdAncla: ancla, fechaRefYmd: fechaRef },
    cache,
  );
  if (!cadena.ok || cadena.autorizacion_rrhh_sustituta) return false;
  return revisorPuedeAutorizarJerarquico(buildAutorizacionSnapshotFields(cadena), revisorPersonaId);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} titularId
 * @param {Map<string, { label: string, dni: string }>} personaCache
 */
async function loadPersonaBandeja(db, titularId, personaCache) {
  let row = personaCache.get(titularId);
  if (row !== undefined) return row;
  const pSnap = await db.collection(COL_PERSONAS).doc(titularId).get();
  const p = pSnap.exists ? pSnap.data() || {} : {};
  const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
  row = {
    label: nom || titularId,
    dni: String(p.dni || "").replace(/\D/g, "").trim(),
  };
  personaCache.set(titularId, row);
  return row;
}

/**
 * Nombre del grupo ancla para la bandeja jefe. Devuelve null si solo se resuelve
 * el propio id: la UI del jefe no muestra identificadores técnicos.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} gdtId
 * @param {Map<string, string | null>} cache
 */
async function loadGrupoAnclaLabel(db, gdtId, cache) {
  const id = String(gdtId || "").trim();
  if (!/^gdt_/i.test(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const etiqueta = String(await etiquetaGrupoTrabajo(db, id)).trim();
  const label = etiqueta && etiqueta !== id ? etiqueta : null;
  cache.set(id, label);
  return label;
}

/**
 * Par familia 64 del trámite, para que el jefe elija modalidad sobre los artículos
 * que realmente le corresponden al solicitante (ADMIN vs ½ carga, etc.).
 *
 * Prioriza el snapshot que deja el alta; solo si falta (trámites anteriores al
 * snapshot) resuelve contra cfg. No se usa la heurística por `codigo_grilla`,
 * que devuelve el par canónico Etapa1 y erraría en los pares de ½ carga.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {Map} articuloCache
 */
async function loadFamilia64Bandeja(db, sol, articuloCache) {
  const conSnap = normalizeArtId(sol.articulo_id_con_goce);
  const sinSnap = normalizeArtId(sol.articulo_id_sin_goce);

  let conGoceId = null;
  let sinGoceId = null;
  if (sol.articulo_familia_64 === true && conSnap && sinSnap) {
    conGoceId = conSnap;
    sinGoceId = sinSnap;
  } else {
    const artId = normalizeArtId(sol.articulo_id);
    if (!artId) return null;
    const pair = await resolveFamilia64PairAsync(db, artId, null);
    if (!pair.enFamilia || !pair.conGoceId || !pair.sinGoceId) return null;
    conGoceId = pair.conGoceId;
    sinGoceId = pair.sinGoceId;
  }

  const [con, sin] = await Promise.all([
    loadArticuloDisplay(db, conGoceId, articuloCache),
    loadArticuloDisplay(db, sinGoceId, articuloCache),
  ]);
  return { conGoceId, sinGoceId, con, sin };
}

/**
 * @param {string} usuario
 * @param {{ label: string, dni: string }} personaRow
 */
function personaCoincideUsuario(usuario, personaRow) {
  if (!usuario) return true;
  return (
    String(personaRow.label || "")
      .toLowerCase()
      .includes(usuario) ||
    String(personaRow.dni || "").includes(usuario.replace(/\D/g, ""))
  );
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {Map} personaCache
 * @param {Map} articuloCache
 * @param {{ puede_decidir: boolean, etiqueta_estado: string }} meta
 * @param {Map} grupoCache
 */
async function itemListaBandejaJefe(db, sol, personaCache, articuloCache, meta, grupoCache) {
  const titularId = String(sol.titular_persona_id || "").trim();
  const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
  const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
  const artId = String(sol.articulo_id || "").trim();
  const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);
  const anclaId = String(sol.grupo_trabajo_id_ancla || "").trim();
  const anclaLabel = await loadGrupoAnclaLabel(db, anclaId, grupoCache || new Map());
  const fam = await loadFamilia64Bandeja(db, sol, articuloCache);
  return {
    solicitud_id: String(sol.id || ""),
    articulo_id: artId,
    articulo_label: artDisplay.articulo_label,
    codigo_grilla: artDisplay.codigo_grilla,
    articulo_nombre: artDisplay.nombre,
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
    grupo_trabajo_ancla_label: anclaLabel,
    jefe_revision_en: sol.jefe_revision_en || null,
    jefe_revision_persona_id: String(sol.jefe_revision_persona_id || "").trim() || null,
    jefe_motivo: sol.jefe_motivo != null ? String(sol.jefe_motivo) : null,
    puede_decidir: meta.puede_decidir === true,
    etiqueta_estado: meta.etiqueta_estado,
    modo_resolucion_jefe: modoResolucionJefeDesdeSolicitud(sol, artDisplay.codigo_grilla),
    modalidad_goce_jefe: sol.modalidad_goce_jefe != null ? String(sol.modalidad_goce_jefe) : null,
    articulo_familia_64: fam != null,
    articulo_id_con_goce: fam ? fam.conGoceId : null,
    articulo_id_sin_goce: fam ? fam.sinGoceId : null,
    articulo_codigo_con_goce: fam ? fam.con.codigo_grilla : null,
    articulo_codigo_sin_goce: fam ? fam.sin.codigo_grilla : null,
    articulo_nombre_con_goce: fam ? fam.con.nombre : null,
    articulo_nombre_sin_goce: fam ? fam.sin.nombre : null,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ revisorPersonaId: string, rrhhBypass?: boolean } & Record<string, unknown>} opts
 */
async function listarSolicitudesBandejaJefe(db, opts) {
  const revisorPersonaId = String(opts.revisorPersonaId || "").trim();
  const { filtroVista, dni, usuario, cursor, pageSize } = parseBandejaListPageOpts(opts, {
    filtroDefault: FILTRO_JEFE_PENDIENTES,
  });
  const fechaDesdeMin = String(opts.fecha_desde_min || "").slice(0, 10);
  const fechaDesdeMax = String(opts.fecha_desde_max || "").slice(0, 10);

  let titularIdsDni = null;
  if (dni) {
    titularIdsDni = await resolverPersonaIdsPorDni(db, dni);
    if (titularIdsDni && titularIdsDni.size === 0) {
      return {
        solicitudes: [],
        page_info: { page_size: pageSize, has_more: false, next_cursor: null, total_filtrado: 0 },
        filtros: { filtro_vista: filtroVista, dni, usuario: usuario || null },
      };
    }
  }

  const personaCache = new Map();
  const articuloCache = new Map();
  const grupoCache = new Map();
  const cacheAutorizacion = crearCacheAutorizacion();
  const byId = new Map();

  /** Filtros baratos y sincrónicos, antes de gastar lecturas. @param {Record<string, unknown>} sol */
  function pasaFiltrosBaratos(sol) {
    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) return false;
    if (fechaDesdeMin && fechaRef < fechaDesdeMin) return false;
    if (fechaDesdeMax && fechaRef > fechaDesdeMax) return false;
    if (titularIdsDni && !titularIdsDni.has(titularId)) return false;
    return true;
  }

  const incluirPendientes =
    filtroVista === FILTRO_JEFE_PENDIENTES || filtroVista === "todos";
  const incluirAprobados = filtroVista === "aprobados_por_mi" || filtroVista === "todos";
  const incluirRechazados = filtroVista === "rechazados_por_mi" || filtroVista === "todos";

  if (incluirPendientes) {
    // orderBy alinea el recorte de SCAN_LIMIT con el eje de presentación (fecha_desde);
    // sin él Firestore ordena por id (ULID) y trunca por fecha de alta.
    const snap = await db
      .collection(COL_SOL)
      .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_EN_REVISION_JEFE)
      .orderBy("fecha_desde")
      .limit(SCAN_LIMIT)
      .get();

    const candidatos = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(pasaFiltrosBaratos);

    const resueltos = await asyncMapLimite(candidatos, CONCURRENCIA_RESOLUCION, async (sol) => {
      if (!(await revisorVeSolicitudEnBandejaJefe(db, sol, revisorPersonaId, cacheAutorizacion))) {
        return null;
      }
      const titularId = String(sol.titular_persona_id || "").trim();
      const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
      if (!personaCoincideUsuario(usuario, personaRow)) return null;
      return itemListaBandejaJefe(
        db,
        sol,
        personaCache,
        articuloCache,
        { puede_decidir: true, etiqueta_estado: "Pendiente tu decisión" },
        grupoCache,
      );
    });

    for (const item of resueltos) {
      if (item) byId.set(item.solicitud_id, item);
    }
  }

  async function agregarHistorialJefe(estadoId, etiqueta) {
    const snap = await db
      .collection(COL_SOL)
      .where("jefe_revision_persona_id", "==", revisorPersonaId)
      .where("estado_solicitud_id", "==", estadoId)
      .orderBy("fecha_desde")
      .limit(SCAN_LIMIT)
      .get();

    const candidatos = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(pasaFiltrosBaratos);

    const resueltos = await asyncMapLimite(candidatos, CONCURRENCIA_RESOLUCION, async (sol) => {
      const titularId = String(sol.titular_persona_id || "").trim();
      const personaRow = await loadPersonaBandeja(db, titularId, personaCache);
      if (!personaCoincideUsuario(usuario, personaRow)) return null;
      return itemListaBandejaJefe(
        db,
        sol,
        personaCache,
        articuloCache,
        { puede_decidir: false, etiqueta_estado: etiqueta },
        grupoCache,
      );
    });

    for (const item of resueltos) {
      if (item) byId.set(item.solicitud_id, item);
    }
  }

  if (incluirAprobados) {
    await agregarHistorialJefe(ESTADO_SOLICITUD_APROBADA, "Aprobada por vos (cierre jerárquico)");
  }
  if (incluirRechazados) {
    await agregarHistorialJefe(ESTADO_SOLICITUD_RECHAZADA, "Rechazada por vos");
  }

  const out = Array.from(byId.values());
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
      fecha_desde_min: fechaDesdeMin || null,
      fecha_desde_max: fechaDesdeMax || null,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {"aprobar"|"rechazar"} decision
 * @param {string} motivo
 * @param {boolean} [_rrhhBypass] — deprecado Oleada A (ignorado)
 * @param {{ rrhhSustituto?: boolean }} [opts] — cierre sustituto huérfana desde bandeja RRHH (A4)
 */
async function resolverDecisionJefeSolicitud(db, solId, revisorPersonaId, decision, motivo, _rrhhBypass, opts = {}) {
  const rrhhSustituto = opts.rrhhSustituto === true;
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud ya no está en revisión por jefe." };
  }

  const titularId = String(sol.titular_persona_id || "").trim();

  if (sol.autorizacion_rrhh_sustituta === true && !rrhhSustituto) {
    return {
      ok: false,
      codigo: "PERMISSION_DENIED",
      mensaje: "Esta solicitud debe gestionarse desde la bandeja RRHH (autorización sustituta).",
    };
  }

  if (rrhhSustituto) {
    if (!esHuerfanaEnRevisionJefe(sol)) {
      return {
        ok: false,
        codigo: "ESTADO_INVALIDO",
        mensaje: "Solo solicitudes huérfanas en revisión admiten cierre sustituto RRHH.",
      };
    }
    if (!revisorPuedeAutorizarJerarquico(sol, revisorPersonaId, { rrhhSustituto: true })) {
      return {
        ok: false,
        codigo: "PERMISSION_DENIED",
        mensaje: "No tenés permiso de cierre sustituto RRHH para esta solicitud.",
      };
    }
  } else {
  const permiso = await revalidarRevisorEnAutorizadores(db, sol, revisorPersonaId);
  if (!permiso.ok) {
    const codigo = permiso.codigo || "PERMISSION_DENIED";
    return {
      ok: false,
      codigo,
      mensaje:
        codigo === CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS
          ? mensajeParaCodigoAutorizacion(CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS)
          : permiso.mensaje || "No podés gestionar esta solicitud.",
    };
  }
  }

  const accionAprobar = rrhhSustituto ? "rrhh_sustituta_aprobar" : "jefe_aprobar";
  const accionRechazar = rrhhSustituto ? "rrhh_sustituta_rechazar" : "jefe_rechazar";

  if (decision === "aprobar") {
    const modalidadRaw = String(opts.modalidad_goce_jefe || "").trim().toLowerCase();
    const artSol = String(sol.articulo_id || "").trim();
    const pairSol = await resolveFamilia64PairAsync(db, artSol, null);
    const enFamilia64 = pairSol.enFamilia === true;
    const modalidad =
      modalidadRaw === "sin_goce" || modalidadRaw === "con_goce"
        ? modalidadRaw
        : enFamilia64 && artSol === pairSol.sinGoceId
          ? "sin_goce"
          : enFamilia64
            ? "con_goce"
            : "";
    const motivoTrim = String(motivo || "").trim();

    // Pedido ya anclado a sin goce del par: no permitir cambiar a con goce.
    if (enFamilia64 && artSol === pairSol.sinGoceId && modalidad === "con_goce") {
      return {
        ok: false,
        codigo: "MODALIDAD_FIJA_SIN_GOCE",
        mensaje:
          "Este trámite ya está anclado a sin goce. No se puede autorizar como con goce.",
      };
    }
    if (modalidad === "sin_goce") {
      if (motivoTrim.length < 3) {
        return {
          ok: false,
          codigo: "MOTIVO_SIN_GOCE_REQUERIDO",
          mensaje:
            "Para autorizar sin goce de haberes el justificativo es obligatorio (mín. 3 caracteres).",
        };
      }
      if (opts.confirma_sin_goce !== true) {
        return {
          ok: false,
          codigo: "CONFIRMA_SIN_GOCE_REQUERIDA",
          mensaje:
            "Para autorizar sin goce de haberes debés confirmar explícitamente la modalidad.",
        };
      }
    }

    // Cupo 1/mes por modalidad: al cruzar o al fijar modalidad, validar el destino (tope desde cfg del art destino).
    if (enFamilia64 && (modalidad === "sin_goce" || modalidad === "con_goce") && pairSol.conGoceId && pairSol.sinGoceId) {
      const fd = String(sol.fecha_desde || "").slice(0, 10);
      const ym = /^(\d{4})-(\d{2})-/.exec(fd);
      if (ym) {
        const anio = Number(ym[1]);
        const mes = Number(ym[2]);
        const destinoArt =
          modalidad === "sin_goce" ? pairSol.sinGoceId : pairSol.conGoceId;
        const enDestino = await countSolicitudesMesArticulo64(
          db,
          titularId,
          destinoArt,
          anio,
          mes,
          solId,
        );
        // tope_frecuencia_mensual se lee de la versión del art de alta; default 1 (cfg).
        let topeMes = 1;
        try {
          const verIdAlta = String(sol.version_id_aplicada || "").trim();
          if (verIdAlta) {
            const verSnap = await db
              .collection("cfg_articulos")
              .doc(artSol)
              .collection("versiones")
              .doc(verIdAlta)
              .get();
            const t = Number(verSnap.data()?.bloque_topes_plazos_computo?.tope_frecuencia_mensual);
            if (Number.isFinite(t) && t > 0) topeMes = Math.floor(t);
          }
        } catch {
          /* keep 1 */
        }
        if (enDestino >= topeMes) {
          return {
            ok: false,
            codigo: "SALDO_MES",
            mensaje:
              modalidad === "sin_goce"
                ? "Este mes ya hay un trámite sin goce del par. No podés autorizar otro sin goce."
                : "Este mes ya hay un trámite con goce del par. No podés autorizar otro con goce.",
          };
        }
      }
    }

    let version64bId = null;
    if (modalidad === "sin_goce" && enFamilia64 && pairSol.sinGoceId) {
      version64bId = await resolveVersionPublicadaId(db, pairSol.sinGoceId);
      if (!version64bId) {
        return {
          ok: false,
          codigo: "VERSION_64B_NO_ENCONTRADA",
          mensaje: "No hay versión publicada del artículo sin goce del par.",
        };
      }
    }

    /** @type {{ ok: false, codigo: string, mensaje: string } | null} */
    let cruceFail = null;

    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) return;

      const patch = {
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        jefe_revision_persona_id: revisorPersonaId,
        jefe_revision_en: FieldValue.serverTimestamp(),
        jefe_motivo: modalidad === "sin_goce" ? motivoTrim : motivo || null,
        actualizado_en: FieldValue.serverTimestamp(),
      };
      if (rrhhSustituto) {
        patch.cierre_rrhh_sustituta = true;
      }
      const decisionUi = String(opts.decision_ui || "").trim().toLowerCase();
      if (decisionUi === "conforme" || decisionUi === "observado" || decisionUi === "aprobar" || decisionUi === "rechazar") {
        patch.decision_jefe_ui = decisionUi;
      }

      if (modalidad === "con_goce" || modalidad === "sin_goce") {
        const cruce = await aplicarModalidad64EnTx(tx, db, cur, titularId, {
          modalidad,
          version_64b_id: version64bId,
          pair:
            pairSol.conGoceId && pairSol.sinGoceId
              ? { conGoceId: pairSol.conGoceId, sinGoceId: pairSol.sinGoceId }
              : null,
        });
        if (!cruce.ok) {
          cruceFail = { ok: false, codigo: cruce.codigo, mensaje: cruce.mensaje };
          return;
        }
        Object.assign(patch, cruce.patch);
      }

      tx.update(solRef, patch);
    });

    if (cruceFail) {
      return cruceFail;
    }

    const postSnap = await solRef.get();
    const postSol = postSnap.exists ? postSnap.data() || {} : sol;
    if (String(postSol.estado_solicitud_id) !== ESTADO_SOLICITUD_APROBADA) {
      return {
        ok: false,
        codigo: "ESTADO_INVALIDO",
        mensaje: "La solicitud ya no está en revisión por jefe.",
      };
    }

    const artCache = new Map();
    const artIdMdc = String(postSol.articulo_id || sol.articulo_id || "").trim();
    const artDisplay = await loadArticuloDisplay(db, artIdMdc, artCache);
    const codigoMdc =
      String(postSol.codigo_grilla || "").trim() || artDisplay.codigo_grilla || "";
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      {
        ...postSol,
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        articulo_id: artIdMdc,
        codigo_grilla: codigoMdc,
        grupo_autorizacion_id: postSol.grupo_autorizacion_id || null,
      },
      MDC_COMANDO_CONSOLIDAR_APROBADO,
    );
    let estadoFinal = ESTADO_SOLICITUD_APROBADA;
    let cambioDiaMeta = null;
    if (solicitudEsCambioDia(postSol) || solicitudEsCambioDia(sol)) {
      try {
        const applyRes = await aplicarCambioDiaTrasAprobacionJefe(db, {
          solId,
          sol: { ...sol, ...postSol },
          revisorPersonaId,
        });
        if (applyRes?.estado_solicitud_id) {
          estadoFinal = applyRes.estado_solicitud_id;
        }
        cambioDiaMeta = {
          applied: applyRes?.applied === true,
          skipped: applyRes?.skipped === true,
          codigo: applyRes?.codigo || null,
          mensaje: applyRes?.mensaje || null,
        };
      } catch (e) {
        estadoFinal = ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION;
        cambioDiaMeta = {
          applied: false,
          codigo: "CAMBIO_DIA_HOOK_ERROR",
          mensaje: e instanceof Error ? e.message : String(e),
        };
        await solRef.update({
          estado_solicitud_id: ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
          cambio_dia_aplicacion_error: {
            codigo: "CAMBIO_DIA_HOOK_ERROR",
            mensaje: cambioDiaMeta.mensaje,
            en: FieldValue.serverTimestamp(),
          },
          actualizado_en: FieldValue.serverTimestamp(),
        });
      }
    }

    void registrarEventoTicket(db, solId, {
      tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
      actor_persona_id: revisorPersonaId,
      titular_persona_id: titularId,
      estado_anterior_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      estado_nuevo_id: estadoFinal,
      origen: ORIGEN_EVENTO.CALLABLE,
      accion: accionAprobar,
      metadata: {
        decision: "aprobar",
        codigo_grilla: artDisplay.codigo_grilla || null,
        grupo_autorizacion_id: postSol.grupo_autorizacion_id || null,
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
        motivo: motivo || null,
        autorizacion_rrhh_sustituta: rrhhSustituto,
        cierre_rrhh_sustituta: rrhhSustituto,
        ...(cambioDiaMeta ? { cambio_dia: cambioDiaMeta } : {}),
      },
    });
    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: estadoFinal,
      ...(cambioDiaMeta ? { cambio_dia: cambioDiaMeta } : {}),
    };
  }

  if (decision === "rechazar") {
    const artCachePre = new Map();
    const artDisplayPre = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCachePre);
    const decisionUi = String(opts.decision_ui || "").trim().toLowerCase();
    const motivoTrim = String(motivo || "").trim();
    if (decisionUi === "observado" && motivoTrim.length < 3) {
      return {
        ok: false,
        codigo: "MOTIVO_OBSERVADO_REQUERIDO",
        mensaje:
          "Para marcar Observado debés indicar el motivo (mín. 3 caracteres). Queda en registro para auditoría.",
      };
    }
    const materializa770 = debeMaterializar770AlRechazar(sol, {
      decision_ui: decisionUi,
      codigo_grilla: artDisplayPre.codigo_grilla,
    });
    if (materializa770 && opts.confirma_injustificada !== true) {
      return {
        ok: false,
        codigo: "CONFIRMA_INJUSTIFICADA_REQUERIDA",
        mensaje:
          "Para rechazar una autorización debés confirmar que la inasistencia quedará injustificada (Art. 77-0).",
      };
    }

    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_JEFE) return;

      await revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId);

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        jefe_revision_persona_id: revisorPersonaId,
        jefe_revision_en: FieldValue.serverTimestamp(),
        jefe_motivo: decisionUi === "observado" ? motivoTrim : motivo || null,
        motor_reverso_jefe_aplicado: cur.motor_descuento_aplicado === true,
        actualizado_en: FieldValue.serverTimestamp(),
        ...(decisionUi === "observado" || decisionUi === "rechazar"
          ? { decision_jefe_ui: decisionUi }
          : {}),
      });
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(db, solId, {
      ...sol,
      codigo_grilla: artDisplay.codigo_grilla,
    }, MDC_COMANDO_REVERTIR_PROYECCION);

    void registrarEventoTicket(db, solId, {
      tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
      actor_persona_id: revisorPersonaId,
      titular_persona_id: titularId,
      estado_anterior_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      estado_nuevo_id: ESTADO_SOLICITUD_RECHAZADA,
      origen: ORIGEN_EVENTO.CALLABLE,
      accion: accionRechazar,
      metadata: {
        decision: "rechazar",
        codigo_grilla: artDisplay.codigo_grilla || null,
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10),
        motivo: motivo || null,
        autorizacion_rrhh_sustituta: rrhhSustituto,
        cierre_rrhh_sustituta: rrhhSustituto,
        deriva_77_0: materializa770 === true,
      },
    });

    /** @type {Record<string, unknown>|null} */
    let derivacion770 = null;
    if (materializa770) {
      try {
        const r770 = await materializarSol770DesdeRechazo(db, {
          solOrigen: { ...sol, codigo_grilla: artDisplay.codigo_grilla },
          solOrigenId: solId,
          revisorPersonaId,
          origenActo: rrhhSustituto ? "rechazo_autorizacion_rrhh_sustituta" : "rechazo_autorizacion_jefe",
        });
        if (!r770.ok) {
          logger.error("art_77_0_derivacion_fallo", { solId, codigo: r770.codigo, mensaje: r770.mensaje });
          await solRef.set(
            {
              art_77_0_derivacion_pendiente: true,
              art_77_0_derivacion_error: r770.codigo || "ERROR",
              actualizado_en: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        } else {
          derivacion770 = {
            solicitud_77_0_id: r770.solicitud_77_0_id,
            dias_acumulados: r770.dias_acumulados,
            alerta_umbral_emitida: r770.alerta_umbral_emitida === true,
          };
          await solRef.set(
            {
              art_77_0_derivada_id: r770.solicitud_77_0_id,
              art_77_0_derivacion_pendiente: false,
              actualizado_en: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      } catch (err) {
        logger.error("art_77_0_derivacion_exception", {
          solId,
          message: err instanceof Error ? err.message : String(err),
        });
        await solRef.set(
          {
            art_77_0_derivacion_pendiente: true,
            art_77_0_derivacion_error: "EXCEPTION",
            actualizado_en: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
      ...(derivacion770 ? { art_77_0: derivacion770 } : {}),
    };
  }

  return { ok: false, codigo: "DECISION_INVALIDA", mensaje: "Decisión inválida." };
}

module.exports = {
  listarSolicitudesBandejaJefe,
  resolverDecisionJefeSolicitud,
  revisorVeSolicitudEnBandejaJefe,
  loadArticuloDisplay,
  loadPersonaBandeja,
  loadGrupoAnclaLabel,
  esHuerfanaEnRevisionJefe,
};
