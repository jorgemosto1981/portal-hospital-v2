"use strict";

/**
 * Callable — paso 1 wizard LAO: disponibilidad de bolsas + versión publicada del ejercicio.
 * @see docs/v2/RFC_TICKETERA_LAO_WIZARD_V2.md §3.2
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");
const { assertAgenteConPersonaId, tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const { resolvePublishedLaoVersion } = require("../../modules/shared/laoVersionResolverDb");
const { buildResumenDisponibilidadLao } = require("../../modules/shared/obtenerContextoBolsaLaoCore");

const COL_SALDOS = "saldos_articulo_agente";

function resolvePersonaId(request, data) {
  if (runtimeFlags.OPEN_ACCESS_TEMP === true) {
    const pid = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
    if (pid && /^per_/i.test(pid)) return pid;
    throw new HttpsError("failed-precondition", "OPEN_ACCESS_TEMP: enviá persona_id explícito.");
  }
  if (request.auth && tokenHasRrhhAccess(request.auth.token)) {
    const pid = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
    if (pid && /^per_/i.test(pid)) return pid;
    throw new HttpsError("invalid-argument", "RRHH debe enviar persona_id del agente.");
  }
  return assertAgenteConPersonaId(request);
}

const obtenerContextoBolsaLaoAgente = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = resolvePersonaId(request, d);
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const anioInputRaw = d.anio_origen_bolsa;
  const anioOrigenBolsaInput =
    anioInputRaw != null && anioInputRaw !== "" ? Number(anioInputRaw) : null;

  if (!articuloId || !/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido (art_*).");
  }
  if (
    anioOrigenBolsaInput != null &&
    (!Number.isInteger(anioOrigenBolsaInput) || anioOrigenBolsaInput < 1900)
  ) {
    throw new HttpsError("invalid-argument", "anio_origen_bolsa inválido.");
  }

  const artSnap = await db.collection("cfg_articulos").doc(articuloId).get();
  if (!artSnap.exists) {
    throw new HttpsError("not-found", "El artículo no existe.");
  }
  const artData = artSnap.data() || {};
  const articuloMeta = {
    nombre: typeof artData.nombre === "string" ? artData.nombre.trim() : "",
    codigo: typeof artData.codigo === "string" ? artData.codigo.trim() : "",
  };

  const salSnap = await db.collection(COL_SALDOS).where("persona_id", "==", personaId).get();
  const saldoDocsData = salSnap.docs.map((doc) => doc.data() || {});

  const mergedPreview = { bolsas: {} };
  for (const doc of saldoDocsData) {
    if (doc.bolsas && typeof doc.bolsas === "object") {
      Object.assign(mergedPreview.bolsas, doc.bolsas);
    }
  }
  const { findOldestAnioOrigenWithDisponible } = require("../../modules/shared/laoSaldosBolsa");
  const sugerido = findOldestAnioOrigenWithDisponible(mergedPreview, articuloId);
  const anioParaVersion =
    anioOrigenBolsaInput != null && Number.isInteger(anioOrigenBolsaInput)
      ? anioOrigenBolsaInput
      : sugerido;

  if (anioParaVersion == null) {
    const { listBolsasResumenForArticulo } = require("../../modules/shared/obtenerContextoBolsaLaoCore");
    const { mergeBolsasFromSaldoDocs } = require("../../modules/shared/laoSaldosBolsa");
    const merged = mergeBolsasFromSaldoDocs(saldoDocsData);
    const bolsasResumen = listBolsasResumenForArticulo(merged, articuloId);
    const mensajes = bolsasResumen.length
      ? ["No tenés días disponibles en ninguna bolsa de este artículo."]
      : ["No hay bolsas LAO registradas para este artículo. Contactá a RRHH si creés que deberías tener saldo."];
    return {
      ok: false,
      codigo: "SIN_ANIO_ACTIVO",
      persona_id: personaId,
      articulo_id: articuloId,
      resumen_disponibilidad_lao: {
        ok: false,
        persona_id: personaId,
        articulo_id: articuloId,
        articulo_nombre: articuloMeta.nombre || null,
        articulo_codigo: articuloMeta.codigo || null,
        version_aplicada_id: null,
        correspondencia_anio: null,
        ejercicio_label: null,
        anio_origen_bolsa_sugerido: null,
        anio_origen_bolsa_activo: anioOrigenBolsaInput,
        bolsa_seleccionada: null,
        bolsas_resumen: bolsasResumen,
        fifo: { anio_mas_antiguo_con_saldo: null, debe_respetar_fifo: false },
        mensajes,
      },
    };
  }

  let versionPick;
  try {
    versionPick = await resolvePublishedLaoVersion(db, articuloId, anioParaVersion);
  } catch (err) {
    const code = err && typeof err.code === "string" ? err.code : "failed-precondition";
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "not-found") throw new HttpsError("not-found", msg);
    throw new HttpsError("failed-precondition", msg);
  }

  if (versionPick.versionData?.bloque_identidad_naturaleza?.es_lao_anual !== true) {
    throw new HttpsError("failed-precondition", "El artículo no está configurado como LAO anual.");
  }

  const resumen = buildResumenDisponibilidadLao({
    personaId,
    articuloId,
    articuloMeta,
    saldoDocsData,
    anioOrigenBolsaInput: anioOrigenBolsaInput,
    versionPick,
  });

  return {
    ok: resumen.ok,
    resumen_disponibilidad_lao: resumen,
    persona_id: personaId,
    articulo_id: articuloId,
  };
});

module.exports = { obtenerContextoBolsaLaoAgente };
