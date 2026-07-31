"use strict";

const { parseYmd } = require("./laoPreviewDateUtils");
const { PATRON_SALDO_B, PATRON_SALDO_C } = require("./resolvePatronSaldo");
const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
} = require("./solicitudElegibilidadLaboral");
const { loadHlcArray, patronFromVersion } = require("./patronBAltaMotorV2");

const PATRONES_TICKETERA = new Set([PATRON_SALDO_B, PATRON_SALDO_C]);
const {
  ARTICULO_IDS_MVP,
  modoListadoArticulosIngreso,
  usaCatalogoPatronBCompleto,
} = require("./ticketeraArticulosMvp");
const {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronBAsync,
} = require("./patronBFechasSolicitud");
const { readModoCalculo } = require("./validarFechasArticuloRuntime");
const { getAllDocsChunked } = require("./firestoreGetAllChunked");
const {
  mapOpcionesParaListadoCliente,
  versionTieneOpcionesConsumoActivas,
} = require("./opcionesConsumoSolicitud");
const { modoResolucionJefeDesdeVersion } = require("./modoResolucionJefe");
const {
  esIngresoFamilia64Oculto,
  esIngresoFamilia64ConGoce,
  resolveFamilia64Pair,
} = require("./familia64Config");

const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

/**
 * @param {Record<string, unknown> | null | undefined} core
 */
function esArticuloOperativo(core) {
  if (!core || typeof core !== "object") return false;
  if (core.activo === false) return false;
  return true;
}

/**
 * @param {Record<string, unknown>} versionData
 * @param {Record<string, unknown>} versionDataOther
 */
function versionPublicadaEsMasReciente(versionData, versionDataOther) {
  const a = String(versionData.vigente_desde || "").slice(0, 10);
  const b = String(versionDataOther.vigente_desde || "").slice(0, 10);
  if (!a) return false;
  if (!b) return true;
  return a > b;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @returns {Promise<{ articuloId: string, core: Record<string, unknown>, versionData: Record<string, unknown>, versionId: string } | null>}
 */
async function loadArticuloPatronBVersionPublicada(db, articuloId) {
  const artRef = db.collection("cfg_articulos").doc(articuloId);
  const [artSnap, verSnap] = await Promise.all([
    artRef.get(),
    artRef
      .collection("versiones")
      .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
      .limit(1)
      .get(),
  ]);
  if (!artSnap.exists || verSnap.empty) return null;

  const core = artSnap.data() || {};
  if (!esArticuloOperativo(core)) return null;

  const versionData = verSnap.docs[0].data() || {};
  const patron = patronFromVersion(versionData);
  if (!PATRONES_TICKETERA.has(patron)) return null;

  return {
    articuloId,
    core,
    versionData,
    versionId: verSnap.docs[0].id,
    patron,
  };
}

/**
 * Descubre artículos Patrón B con versión publicada (1 query collection group + get batch).
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function discoverArticulosPatronBPublicados(db) {
  const verSnap = await db
    .collectionGroup("versiones")
    .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
    .get();

  /** @type {Map<string, { versionData: Record<string, unknown>, versionId: string }>} */
  const porArticulo = new Map();
  for (const verDoc of verSnap.docs) {
    const articuloId = verDoc.ref.parent?.parent?.id;
    if (!articuloId) continue;
    const versionData = verDoc.data() || {};
    const patron = patronFromVersion(versionData);
    if (!PATRONES_TICKETERA.has(patron)) continue;
    const prev = porArticulo.get(articuloId);
    if (prev && !versionPublicadaEsMasReciente(versionData, prev.versionData)) continue;
    porArticulo.set(articuloId, { versionData, versionId: verDoc.id, patron });
  }

  const ids = [...porArticulo.keys()];
  if (!ids.length) return [];

  const refs = ids.map((id) => db.collection("cfg_articulos").doc(id));
  const artSnaps = await getAllDocsChunked(db, refs);
  /** @type {Array<{ articuloId: string, core: Record<string, unknown>, versionData: Record<string, unknown>, versionId: string }>} */
  const out = [];
  for (const artSnap of artSnaps) {
    if (!artSnap.exists) continue;
    const core = artSnap.data() || {};
    if (!esArticuloOperativo(core)) continue;
    const meta = porArticulo.get(artSnap.id);
    if (!meta) continue;
    out.push({
      articuloId: artSnap.id,
      core,
      versionData: meta.versionData,
      versionId: meta.versionId,
      patron: meta.patron,
    });
  }
  return out;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function cargarCandidatosPatronB(db) {
  if (!usaCatalogoPatronBCompleto()) {
    const loaded = await Promise.all(
      ARTICULO_IDS_MVP.map((id) => loadArticuloPatronBVersionPublicada(db, id)),
    );
    return loaded.filter(Boolean);
  }
  return discoverArticulosPatronBPublicados(db);
}

/**
 * @param {{
 *   db: import("firebase-admin/firestore").Firestore,
 *   personaId: string,
 *   fechaDesde: string,
 *   authToken?: unknown,
 * }} params
 */
async function listarArticulosIngresoPatronB(params) {
  const { db, personaId, fechaDesde, authToken } = params;
  if (!parseYmd(fechaDesde)) {
    return { error: "invalid-argument", message: "fecha_desde debe ser YYYY-MM-DD." };
  }

  const personaSnap = await db.collection("personas").doc(personaId).get();
  if (!personaSnap.exists) {
    return { error: "not-found", message: "La persona no existe." };
  }
  const persona = personaSnap.data() || {};
  const hlcArray = await loadHlcArray(db, personaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde);
  const diasExt = Number(persona.antiguedad_reconocida_dias);
  const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;

  const candidatos = await cargarCandidatosPatronB(db);
  /** @type {Array<object>} */
  const articulos = [];
  /** @type {{ codigos: string[], mensajes: string[] } | null} */
  let elegibilidadVacia = null;

  for (const cand of candidatos) {
    const { articuloId, core, versionData, versionId, patron } = cand;
    // Familia 64: el agente solo ve el art. con goce del par (cfg familia_64_par_articulo_id).
    // El jefe elige con/sin goce; el sin goce no es ingresable.
    if (esIngresoFamilia64Oculto(core, articuloId)) {
      continue;
    }
    const eleg = resolverElegibilidadSolicitud({
      versionData,
      hlcVigentes,
      personaId,
      fechaDesde,
      diasExternos: externos,
      authToken,
    });
    if (!eleg.ok) {
      if (!elegibilidadVacia && Array.isArray(eleg.codigos) && eleg.codigos.length) {
        elegibilidadVacia = {
          codigos: eleg.codigos,
          mensajes: Array.isArray(eleg.mensajes) ? eleg.mensajes : [],
        };
      }
      continue;
    }

    const requiereOpcion = versionTieneOpcionesConsumoActivas(versionData);
    const opcionesCliente = requiereOpcion ? mapOpcionesParaListadoCliente(versionData) : [];

    let diasSolicitados = null;
    let fechaHasta = null;
    if (!requiereOpcion) {
      diasSolicitados = diasSolicitadosDesdeVersion(versionData);
      fechaHasta = await fechaHastaDesdeVersionPatronBAsync(db, fechaDesde, diasSolicitados, versionData);
    }

    const pair64 = resolveFamilia64Pair(articuloId, core);
    const es64Unificado = esIngresoFamilia64ConGoce(core, articuloId);
    const codigoGrillaRaw = String(core.codigo || core.nombre_corto || "").trim() || "ART";
    const nombreRaw = String(core.nombre || core.codigo || "").trim();
    const visCodigo = String(
      versionData?.bloque_identidad_naturaleza?.visualizacion?.codigo_grilla || "",
    ).trim();
    // Par ADMIN: chip unificado "64" / "ASUNTOS PARTICULARES".
    // Par ½ carga (u otro): respeta código/nombre de cfg (distinguible en hub).
    const esMediaCarga = /1\s*\/\s*2|media.?carga|½/i.test(`${codigoGrillaRaw} ${nombreRaw}`);
    const codigoChip = es64Unificado
      ? visCodigo || (esMediaCarga ? codigoGrillaRaw : "64")
      : codigoGrillaRaw;
    const nombreChip = es64Unificado
      ? esMediaCarga
        ? nombreRaw
        : "ASUNTOS PARTICULARES"
      : nombreRaw;

    const row = {
      articulo_id: articuloId,
      version_id: versionId,
      codigo_grilla: codigoChip,
      nombre: nombreChip,
      modo_resolucion_jefe: modoResolucionJefeDesdeVersion(versionData),
      patron_saldo: patron || PATRON_SALDO_B,
      ...(es64Unificado && pair64.conGoceId && pair64.sinGoceId
        ? {
            articulo_familia_64: true,
            articulo_id_con_goce: pair64.conGoceId,
            articulo_id_sin_goce: pair64.sinGoceId,
          }
        : {}),
      requiere_opcion_consumo: requiereOpcion,
      ...(requiereOpcion ? { opciones_consumo_solicitud: opcionesCliente } : {}),
      dias_solicitados: diasSolicitados,
      fecha_hasta: fechaHasta,
      tope_dias_por_evento: (() => {
        const t = Number(versionData?.bloque_topes_plazos_computo?.tope_dias_por_evento);
        return Number.isFinite(t) && t > 0 ? Math.floor(t) : null;
      })(),
      regla_computo_dias_id: String(versionData?.bloque_topes_plazos_computo?.regla_computo_dias_id || "").trim() || null,
      ...(() => {
        const ident = versionData?.bloque_identidad_naturaleza;
        const modoLm = String(ident?.modo_licencia_medica_id || "").trim();
        const esLarga =
          ident?.es_licencia_medica === true && modoLm === "cfg_mlm_larga_episodio";
        if (!esLarga) return {};
        return {
          modo_licencia_medica_id: modoLm,
          requiere_causal_larga: true,
          requiere_cie10: true,
          tope_dias_solicitud: 730,
        };
      })(),
      ...(() => {
        const m = readModoCalculo(versionData);
        return {
          modo_computo: m.modo,
          usa_calendario_institucional: m.usaCalendario,
          incluye_feriados_institucionales: m.incluyeFeriadosInstitucionales,
        };
      })(),
      ...(() => {
        // Retroactividad/preaviso para que el widget de fecha limite la selección.
        const wf = versionData?.bloque_workflow_sla_cobertura || {};
        const preavisoRaw = wf.plazo_preaviso_interno_dias;
        const preaviso =
          preavisoRaw == null || preavisoRaw === ""
            ? null
            : Number.isFinite(Number(preavisoRaw))
              ? Math.max(0, Math.floor(Number(preavisoRaw)))
              : null;
        return {
          permite_retroactividad: wf.permite_retroactividad === true,
          plazo_preaviso_interno_dias: preaviso,
        };
      })(),
      ...(() => {
        const ext = versionData?.cambio_dia_solicitud;
        const codigoArt = String(core.codigo || "").trim().toUpperCase();
        const esCambioDia =
          (ext && typeof ext === "object" && String(ext.schema || "") === "CAMBIO_DIA_V1") ||
          codigoArt === "CAMBIO-DIA" ||
          codigoArt === "C-DIA";
        if (!esCambioDia) return {};
        const wf = versionData?.bloque_workflow_sla_cobertura || {};
        const preavisoRaw = wf.plazo_preaviso_interno_dias;
        const preaviso =
          preavisoRaw == null || preavisoRaw === ""
            ? null
            : Number.isFinite(Number(preavisoRaw))
              ? Math.max(0, Math.floor(Number(preavisoRaw)))
              : null;
        const extSafe = ext && typeof ext === "object" ? ext : {};
        return {
          es_cambio_dia: true,
          cambio_dia_solicitud: {
            schema: "CAMBIO_DIA_V1",
            campos_requeridos: Array.isArray(extSafe.campos_requeridos)
              ? extSafe.campos_requeridos
              : ["fecha_origen", "fecha_destino", "motivo"],
            origen_celdas_ok: Array.isArray(extSafe.origen_celdas_ok) ? extSafe.origen_celdas_ok : [],
            destino_celdas_ok: Array.isArray(extSafe.destino_celdas_ok) ? extSafe.destino_celdas_ok : [],
            aplica_batch: String(extSafe.aplica_batch || "traslado_propio_b_batch"),
            motivo_max_len:
              Number.isFinite(Number(extSafe.motivo_max_len)) && Number(extSafe.motivo_max_len) > 0
                ? Math.floor(Number(extSafe.motivo_max_len))
                : 500,
          },
          permite_retroactividad: wf.permite_retroactividad === true,
          plazo_preaviso_interno_dias: preaviso,
        };
      })(),
    };

    articulos.push(row);
  }

  return {
    articulos,
    fecha_desde: fechaDesde,
    persona_id: personaId,
    meta: {
      listado_modo: modoListadoArticulosIngreso(),
      candidatos_evaluados: candidatos.length,
      filtro_circuito_ingreso: true,
    },
    ...(elegibilidadVacia && articulos.length === 0 ? { elegibilidad_vacia: elegibilidadVacia } : {}),
  };
}

module.exports = {
  listarArticulosIngresoPatronB,
  loadArticuloPatronBVersionPublicada,
  discoverArticulosPatronBPublicados,
  esArticuloOperativo,
  versionPublicadaEsMasReciente,
};
