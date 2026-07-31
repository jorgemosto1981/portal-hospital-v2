"use strict";

/**
 * Resumen informativo Art. 64 (con/sin goce) + trámites pendientes del ciclo.
 * El par se toma de cfg (`familia_64_par_articulo_id`) según el artículo de contexto.
 */

const {
  ESTADOS_CUENTAN_FRECUENCIA_MES_64,
  resolveFamilia64PairAsync,
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
} = require("./solicitudPatronBCruceModalidad64");
const { saldoAnualDocId, pickBolsaParaConsumo } = require("./laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";
const COL_SOL = "solicitudes_articulo";

const ESTADOS_PENDIENTE = new Set([
  "cfg_esa_borrador",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
  "cfg_esa_aprobada_pendiente_aplicacion",
]);

/**
 * @param {Record<string, unknown>} sol
 * @param {{ conGoceId: string, sinGoceId: string }} pair
 */
function modalidadLabelSol64(sol, pair) {
  const modalidad = String(sol.modalidad_goce_jefe || "").trim().toLowerCase();
  if (modalidad === "sin_goce") return "sin goce de haberes";
  if (modalidad === "con_goce") return "con goce de haberes";
  const art = String(sol.articulo_id || "").trim();
  if (art === pair.sinGoceId) return "sin goce de haberes";
  const cod = String(sol.codigo_grilla || "").trim().toUpperCase();
  if (cod.includes("B") && cod.startsWith("64")) return "sin goce de haberes";
  return "con goce de haberes";
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {number} [anioCiclo]
 * @param {string} [articuloIdContexto] — art. del chip (con goce); define el par cfg
 */
async function obtenerResumenSaldoFamilia64Agente(db, personaId, anioCiclo, articuloIdContexto) {
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) {
    return { ok: false, codigo: "PERSONA_INVALIDA", mensaje: "persona_id inválido." };
  }

  const anio =
    Number.isInteger(Number(anioCiclo)) && Number(anioCiclo) >= 1900
      ? Number(anioCiclo)
      : Number(
          new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4),
        );

  const artCtx = String(articuloIdContexto || ARTICULO_64A_ETAPA1_ID).trim();
  const pairResolved = await resolveFamilia64PairAsync(db, artCtx, null);
  if (!pairResolved.enFamilia || !pairResolved.conGoceId || !pairResolved.sinGoceId) {
    return {
      ok: false,
      codigo: "NO_FAMILIA_64",
      mensaje: "El artículo no integra un par familia 64 configurado.",
    };
  }
  const pair = { conGoceId: pairResolved.conGoceId, sinGoceId: pairResolved.sinGoceId };

  const salId = saldoAnualDocId(pid, anio);
  let conGoce = null;
  let sinGoce = null;
  if (salId) {
    const salSnap = await db.collection(COL_SALDOS).doc(salId).get();
    const salData = salSnap.exists ? salSnap.data() || {} : {};
    const bA = pickBolsaParaConsumo(salData, pair.conGoceId, anio);
    const bB = pickBolsaParaConsumo(salData, pair.sinGoceId, anio);
    conGoce = bA && Number.isFinite(Number(bA.bolsa.disponible)) ? Number(bA.bolsa.disponible) : null;
    sinGoce = bB && Number.isFinite(Number(bB.bolsa.disponible)) ? Number(bB.bolsa.disponible) : null;
  }

  const [snapA, snapB] = await Promise.all([
    db.collection(COL_SOL).where("titular_persona_id", "==", pid).where("articulo_id", "==", pair.conGoceId).get(),
    db.collection(COL_SOL).where("titular_persona_id", "==", pid).where("articulo_id", "==", pair.sinGoceId).get(),
  ]);

  /** @type {Array<Record<string, unknown>>} */
  const pendientes = [];
  for (const doc of [...snapA.docs, ...snapB.docs]) {
    const s = doc.data() || {};
    const estado = String(s.estado_solicitud_id || "").trim();
    if (!ESTADOS_PENDIENTE.has(estado)) continue;
    const fd = String(s.fecha_desde || "").slice(0, 10);
    if (!fd.startsWith(String(anio))) continue;
    if (!ESTADOS_CUENTAN_FRECUENCIA_MES_64.has(estado) && estado !== "cfg_esa_aprobada_pendiente_aplicacion") {
      // keep
    }
    const dias = Math.max(1, Math.floor(Number(s.dias_solicitados) || Number(s.motor_dias_descontados) || 1));
    pendientes.push({
      solicitud_id: doc.id,
      fecha_desde: fd,
      modalidad_label: modalidadLabelSol64(s, pair),
      estado_solicitud_id: estado,
      dias,
      saldo_reservado: s.motor_descuento_aplicado === true,
    });
  }

  pendientes.sort((a, b) => String(a.fecha_desde).localeCompare(String(b.fecha_desde)));

  return {
    ok: true,
    anio_ciclo: anio,
    con_goce_disponible: conGoce,
    sin_goce_disponible: sinGoce,
    articulo_id_con_goce: pair.conGoceId,
    articulo_id_sin_goce: pair.sinGoceId,
    pendientes,
  };
}

module.exports = {
  obtenerResumenSaldoFamilia64Agente,
  modalidadLabelSol64,
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
};
