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
const {
  loadEtapa1Runtime,
  personaPermitidaCircuitoEtapa1,
  articuloFilaPermitidaEtapa1,
} = require("./etapa1RuntimeLoader");
const { rolesHlcFromAuthToken } = require("./solicitudElegibilidadLaboral");

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

  const etapa1Cfg = await loadEtapa1Runtime(db);
  const rolesTok = rolesHlcFromAuthToken(authToken);
  const esRrhh =
    rolesTok.includes("CFG_RRHH") ||
    String(authToken?.portal_role || "")
      .trim()
      .toLowerCase() === "rrhh" ||
    String(authToken?.portal_role || "")
      .trim()
      .toLowerCase() === "admin";

  if (!personaPermitidaCircuitoEtapa1(etapa1Cfg, personaId, hlcVigentes, { esRrhh })) {
    return {
      articulos: [],
      fecha_desde: fechaDesde,
      persona_id: personaId,
      meta: {
        listado_modo: modoListadoArticulosIngreso(),
        candidatos_evaluados: 0,
        etapa1_bloqueado: true,
      },
      elegibilidad_vacia: {
        codigos: ["ETAPA1_ALLOWLIST"],
        mensajes: [
          "Tu grupo de trabajo no está habilitado en Etapa 1 del portal. Si deberías estar en el piloto, pedí a RRHH que te asigne al GDT correspondiente.",
        ],
      },
    };
  }

  const candidatos = await cargarCandidatosPatronB(db);
  /** @type {Array<object>} */
  const articulos = [];
  /** @type {{ codigos: string[], mensajes: string[] } | null} */
  let elegibilidadVacia = null;

  for (const cand of candidatos) {
    const { articuloId, core, versionData, versionId, patron } = cand;
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

    const row = {
      articulo_id: articuloId,
      version_id: versionId,
      codigo_grilla: String(core.codigo || core.nombre_corto || "").trim() || "ART",
      nombre: String(core.nombre || core.codigo || "").trim(),
      patron_saldo: patron || PATRON_SALDO_B,
      requiere_opcion_consumo: requiereOpcion,
      ...(requiereOpcion ? { opciones_consumo_solicitud: opcionesCliente } : {}),
      dias_solicitados: diasSolicitados,
      fecha_hasta: fechaHasta,
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
        const ext = versionData?.cambio_dia_solicitud;
        if (!ext || typeof ext !== "object") return {};
        if (String(ext.schema || "") !== "CAMBIO_DIA_V1") return {};
        const wf = versionData?.bloque_workflow_sla_cobertura || {};
        const preavisoRaw = wf.plazo_preaviso_interno_dias;
        const preaviso =
          preavisoRaw == null || preavisoRaw === ""
            ? null
            : Number.isFinite(Number(preavisoRaw))
              ? Math.max(0, Math.floor(Number(preavisoRaw)))
              : null;
        return {
          es_cambio_dia: true,
          cambio_dia_solicitud: {
            schema: "CAMBIO_DIA_V1",
            campos_requeridos: Array.isArray(ext.campos_requeridos)
              ? ext.campos_requeridos
              : ["fecha_origen", "fecha_destino", "motivo"],
            origen_celdas_ok: Array.isArray(ext.origen_celdas_ok) ? ext.origen_celdas_ok : [],
            destino_celdas_ok: Array.isArray(ext.destino_celdas_ok) ? ext.destino_celdas_ok : [],
            aplica_batch: String(ext.aplica_batch || "traslado_propio_b_batch"),
            motivo_max_len:
              Number.isFinite(Number(ext.motivo_max_len)) && Number(ext.motivo_max_len) > 0
                ? Math.floor(Number(ext.motivo_max_len))
                : 500,
          },
          permite_retroactividad: wf.permite_retroactividad === true,
          plazo_preaviso_interno_dias: preaviso,
        };
      })(),
    };

    if (!articuloFilaPermitidaEtapa1(etapa1Cfg, row)) continue;
    articulos.push(row);
  }

  return {
    articulos,
    fecha_desde: fechaDesde,
    persona_id: personaId,
    meta: {
      listado_modo: modoListadoArticulosIngreso(),
      candidatos_evaluados: candidatos.length,
      etapa1_catalogo_filtrado: true,
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
