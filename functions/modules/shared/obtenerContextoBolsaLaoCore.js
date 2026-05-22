"use strict";

const {
  mergeBolsasFromSaldoDocs,
  findOldestAnioOrigenWithDisponible,
  pickBolsaParaConsumo,
} = require("./laoSaldosBolsa");
const { getCorrespondenciaAnioFromVersion } = require("./laoVersionResolver");

/**
 * @param {object | null | undefined} versionData
 * @param {{ nombre?: string, codigo?: string }} articuloMeta
 * @param {number} correspondenciaAnio
 */
function buildEjercicioLabel(versionData, articuloMeta, correspondenciaAnio) {
  const vis = versionData?.bloque_identidad_naturaleza?.visualizacion || versionData?.visualizacion || {};
  const titulo =
    (typeof vis.titulo_agente === "string" && vis.titulo_agente.trim()) ||
    (typeof articuloMeta.nombre === "string" && articuloMeta.nombre.trim()) ||
    (typeof articuloMeta.codigo === "string" && articuloMeta.codigo.trim()) ||
    "Licencia anual ordinaria";
  return `${titulo} ${correspondenciaAnio}`;
}

/**
 * @param {object} saldosMerged
 * @param {string} articuloId
 * @returns {Array<object>}
 */
function listBolsasResumenForArticulo(saldosMerged, articuloId) {
  const bolsas = saldosMerged && typeof saldosMerged.bolsas === "object" ? saldosMerged.bolsas : {};
  const art = String(articuloId || "").trim();
  const fifoAnio = findOldestAnioOrigenWithDisponible(saldosMerged, art);

  /** @type {Array<object>} */
  const rows = [];
  for (const [bolsaId, b] of Object.entries(bolsas)) {
    if (!b || typeof b !== "object") continue;
    if (String(b.articulo_id || "").trim() !== art) continue;
    const anio = Number(b.anio_origen);
    if (!Number.isInteger(anio)) continue;
    const disponible = Number(b.disponible);
    const dispOk = Number.isFinite(disponible) ? disponible : 0;
    const requiereFifo =
      fifoAnio != null && Number.isInteger(fifoAnio) && anio > fifoAnio && dispOk > 0;
    rows.push({
      bolsa_id: bolsaId,
      anio_origen: anio,
      disponible: dispOk,
      consumido: Number.isFinite(Number(b.consumido)) ? Number(b.consumido) : 0,
      cantidad_inicial: Number.isFinite(Number(b.cantidad_inicial)) ? Number(b.cantidad_inicial) : 0,
      es_arrastre: b.es_arrastre === true,
      fecha_vencimiento:
        typeof b.fecha_vencimiento === "string" ? b.fecha_vencimiento.trim().slice(0, 10) : null,
      codigo_grilla: typeof b.codigo_grilla === "string" ? b.codigo_grilla.trim() : null,
      requiere_fifo_antes: requiereFifo,
    });
  }
  rows.sort((a, b) => a.anio_origen - b.anio_origen);
  return rows;
}

/**
 * @param {object | null} picked
 */
function mapBolsaSeleccionada(picked) {
  if (!picked || !picked.bolsa) return null;
  const b = picked.bolsa;
  return {
    bolsa_id: picked.bolsaId,
    anio_origen: Number(b.anio_origen),
    disponible: Number.isFinite(Number(b.disponible)) ? Number(b.disponible) : 0,
    consumido: Number.isFinite(Number(b.consumido)) ? Number(b.consumido) : 0,
    cantidad_inicial: Number.isFinite(Number(b.cantidad_inicial)) ? Number(b.cantidad_inicial) : 0,
    es_arrastre: b.es_arrastre === true,
    fecha_vencimiento:
      typeof b.fecha_vencimiento === "string" ? b.fecha_vencimiento.trim().slice(0, 10) : null,
    codigo_grilla: typeof b.codigo_grilla === "string" ? b.codigo_grilla.trim() : null,
  };
}

/**
 * Arma `resumen_disponibilidad_lao` (puro, testeable).
 * @param {{
 *   personaId: string,
 *   articuloId: string,
 *   articuloMeta?: { nombre?: string, codigo?: string },
 *   saldoDocsData: Array<object>,
 *   anioOrigenBolsaInput?: number | null,
 *   versionPick: { versionId: string, versionData: object, correspondencia_anio: number },
 * }} params
 */
function buildResumenDisponibilidadLao(params) {
  const {
    personaId,
    articuloId,
    articuloMeta = {},
    saldoDocsData,
    anioOrigenBolsaInput = null,
    versionPick,
  } = params;

  const merged = mergeBolsasFromSaldoDocs(saldoDocsData);
  const sugerido = findOldestAnioOrigenWithDisponible(merged, articuloId);
  const inputAnio = Number(anioOrigenBolsaInput);
  const anioActivo = Number.isInteger(inputAnio) && inputAnio >= 1900 ? inputAnio : sugerido;

  const correspondenciaAnio =
    versionPick.correspondencia_anio ?? getCorrespondenciaAnioFromVersion(versionPick.versionData);
  const ejercicioLabel = buildEjercicioLabel(versionPick.versionData, articuloMeta, correspondenciaAnio);

  const bolsasResumen = listBolsasResumenForArticulo(merged, articuloId);
  const picked =
    anioActivo != null ? pickBolsaParaConsumo(merged, articuloId, anioActivo) : null;
  const bolsaSeleccionada = mapBolsaSeleccionada(picked);

  /** @type {string[]} */
  const mensajes = [];
  if (!bolsasResumen.length) {
    mensajes.push("No hay bolsas LAO registradas para este artículo. Contactá a RRHH si creés que deberías tener saldo.");
  } else if (sugerido == null) {
    mensajes.push("No tenés días disponibles en ninguna bolsa de este artículo.");
  }
  if (anioActivo != null && sugerido != null && anioActivo > sugerido) {
    mensajes.push(`FIFO: primero consumí la bolsa del año ${sugerido} (saldo pendiente).`);
  }
  if (anioActivo != null && !bolsaSeleccionada) {
    mensajes.push(`No existe bolsa para el año origen ${anioActivo}.`);
  } else if (bolsaSeleccionada && bolsaSeleccionada.disponible <= 0) {
    mensajes.push(`La bolsa ${anioActivo} no tiene días disponibles.`);
  }

  const debeFifo = sugerido != null && anioActivo != null && anioActivo > sugerido;

  return {
    ok: true,
    persona_id: personaId,
    articulo_id: articuloId,
    articulo_nombre: articuloMeta.nombre || null,
    articulo_codigo: articuloMeta.codigo || null,
    version_aplicada_id: versionPick.versionId,
    correspondencia_anio: correspondenciaAnio,
    ejercicio_label: ejercicioLabel,
    anio_origen_bolsa_sugerido: sugerido,
    anio_origen_bolsa_activo: anioActivo,
    bolsa_seleccionada: bolsaSeleccionada,
    bolsas_resumen: bolsasResumen,
    fifo: {
      anio_mas_antiguo_con_saldo: sugerido,
      debe_respetar_fifo: debeFifo,
    },
    mensajes,
  };
}

module.exports = {
  buildResumenDisponibilidadLao,
  buildEjercicioLabel,
  listBolsasResumenForArticulo,
};
