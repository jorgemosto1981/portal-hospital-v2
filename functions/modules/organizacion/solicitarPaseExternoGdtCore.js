"use strict";

/**
 * Core: solicitarPaseExternoGdt — SPIKE_PASES_GDT_FASE2_V2.md §4.2
 * Solo crea sol_pases_gdt PENDIENTE_RRHH. No muta HLg.
 */

const { ulid } = require("ulid");
const { FieldValue } = require("../shared/context");
const {
  loadHlgRowsPorPersona,
  hlgVigenteEnFecha,
} = require("../shared/solicitudHlgVigencia");
const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd } = require("../shared/fechaLaboralYmd");
const {
  loadNodosGdtActivos,
  resolverRaicesJefe,
} = require("./listarArbolGdtPlantelCore");
const { resolverFechasPaseGdt } = require("./paseGdtFechas");
const {
  COL_SOL_PASES_GDT,
  actorPuedePasarDesdeOrigen,
} = require("./ejecutarPaseInternoGdtCore");

const COL_HLG = "historial_laboral_grupos";
const RX_PER = /^per_/i;
const RX_HLG = /^hlg_/i;
const RX_GDT = /^gdt_/i;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   agentePersonaId: string;
 *   hlgOrigenId: string;
 *   fechaEfectivaYmd: string;
 *   motivo: string;
 *   destinoSugeridoTexto: string;
 *   solicitantePersonaId: string;
 *   esRrhh: boolean;
 * }} input
 */
async function solicitarPaseExternoGdtCore(db, input) {
  const agentePersonaId = String(input.agentePersonaId || "").trim();
  const hlgOrigenId = String(input.hlgOrigenId || "").trim();
  const motivo = String(input.motivo || "").trim();
  const destinoSugeridoTexto = String(input.destinoSugeridoTexto || "").trim();
  const solicitantePersonaId = String(input.solicitantePersonaId || "").trim();
  const esRrhh = input.esRrhh === true;

  if (!RX_PER.test(agentePersonaId)) {
    return { ok: false, code: "invalid-argument", message: "agente_persona_id inválido." };
  }
  if (!RX_HLG.test(hlgOrigenId)) {
    return { ok: false, code: "invalid-argument", message: "hlg_origen_id inválido." };
  }
  if (!motivo || motivo.length < 3) {
    return { ok: false, code: "invalid-argument", message: "motivo obligatorio (mín. 3 caracteres)." };
  }
  if (!destinoSugeridoTexto || destinoSugeridoTexto.length < 3) {
    return {
      ok: false,
      code: "invalid-argument",
      message: "destino_sugerido_texto obligatorio (mín. 3 caracteres).",
    };
  }
  if (!esRrhh && !RX_PER.test(solicitantePersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }
  if (RX_PER.test(solicitantePersonaId) && solicitantePersonaId === agentePersonaId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "No podés solicitarte un pase a vos mismo.",
    };
  }

  const fechas = resolverFechasPaseGdt(input.fechaEfectivaYmd);
  if (!fechas.ok) return fechas;
  const { fecha_efectiva: fechaEfectiva } = fechas;

  const hlgOrigenRef = db.collection(COL_HLG).doc(hlgOrigenId);
  const hlgOrigenSnap = await hlgOrigenRef.get();
  if (!hlgOrigenSnap.exists) {
    return { ok: false, code: "not-found", message: "HLg origen no encontrado." };
  }
  const hlgOrigen = { id: hlgOrigenSnap.id, ...(hlgOrigenSnap.data() || {}) };
  if (String(hlgOrigen.persona_id || "").trim() !== agentePersonaId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "El HLg origen no pertenece al agente indicado.",
    };
  }
  const gdtOrigenId = String(hlgOrigen.grupo_de_trabajo_id || "").trim();
  if (!RX_GDT.test(gdtOrigenId)) {
    return { ok: false, code: "failed-precondition", message: "HLg origen sin grupo_de_trabajo_id válido." };
  }
  if (!hlgVigenteEnFecha(hlgOrigen, fechaEfectiva)) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "El HLg origen no está vigente en la fecha efectiva (último día en el grupo).",
    };
  }

  const inicioOrigen = hldHlgFechaInicioYmd(hlgOrigen);
  if (inicioOrigen && fechaEfectiva < inicioOrigen) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "fecha_efectiva anterior al inicio del HLg origen.",
    };
  }
  const finActual = hldHlgFechaFinYmd(hlgOrigen);
  if (finActual && fechaEfectiva > finActual) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "fecha_efectiva posterior al fin ya cargado del HLg origen.",
    };
  }

  if (!esRrhh) {
    const [nodos, raicesIds, actorHlgs] = await Promise.all([
      loadNodosGdtActivos(db),
      resolverRaicesJefe(db, solicitantePersonaId, fechaEfectiva),
      loadHlgRowsPorPersona(db, solicitantePersonaId),
    ]);
    const raizSet = new Set(raicesIds);
    const byId = new Map(nodos.map((n) => [n.id, n]));
    const actorVigentes = actorHlgs.filter((h) => hlgVigenteEnFecha(h, fechaEfectiva));
    const nivelAgenteRaw = hlgOrigen.nivel_jerarquico;
    const nivelAgente =
      nivelAgenteRaw === null || nivelAgenteRaw === undefined || nivelAgenteRaw === ""
        ? null
        : Number(nivelAgenteRaw);
    if (
      !actorPuedePasarDesdeOrigen({
        byId,
        raizIds: raizSet,
        actorVigentes,
        gdtOrigen: gdtOrigenId,
        nivelAgente: Number.isFinite(nivelAgente) ? nivelAgente : null,
      })
    ) {
      return {
        ok: false,
        code: "permission-denied",
        message: "Sin jurisdicción/subordinación suficiente sobre el agente en el GDT origen.",
      };
    }
  }

  // Evitar duplicar solicitudes externas pendientes del mismo HLg origen.
  const pendSnap = await db
    .collection(COL_SOL_PASES_GDT)
    .where("hlg_origen_id", "==", hlgOrigenId)
    .where("tipo_pase", "==", "EXTERNO")
    .where("estado", "==", "PENDIENTE_RRHH")
    .limit(5)
    .get();
  if (!pendSnap.empty) {
    const existente = pendSnap.docs[0].id;
    return {
      ok: false,
      code: "already-exists",
      message: `Ya hay un pase externo pendiente para este HLg (${existente}).`,
    };
  }

  const paseId = `spg_${ulid()}`;
  const pasePayload = {
    agente_persona_id: agentePersonaId,
    hlg_origen_id: hlgOrigenId,
    gdt_origen_id: gdtOrigenId,
    gdt_destino_id: null,
    solicitante_persona_id: solicitantePersonaId || null,
    tipo_pase: "EXTERNO",
    estado: "PENDIENTE_RRHH",
    motivo,
    destino_sugerido_texto: destinoSugeridoTexto,
    fecha_efectiva: fechaEfectiva,
    hlg_destino_id: null,
    overrides_hlg: {
      nivel_jerarquico: null,
      regimen_horario_id: null,
      regimen_fecha_ancla: null,
    },
    requiere_conocimiento_rrhh: true,
    rrhh_toma_conocimiento_en: null,
    rrhh_toma_conocimiento_por: null,
    jefes_pendientes_conocimiento_ids: [],
    jefes_acuses: {},
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
    resuelto_en: null,
    resuelto_por: null,
    motivo_rechazo: null,
  };

  try {
    await db.collection(COL_SOL_PASES_GDT).doc(paseId).set(pasePayload);
  } catch (err) {
    console.error("solicitarPaseExternoGdtCore.set", err);
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : "Error al crear solicitud de pase externo.",
    };
  }

  return {
    ok: true,
    pase_id: paseId,
    hlg_origen_id: hlgOrigenId,
    gdt_origen_id: gdtOrigenId,
    fecha_efectiva: fechaEfectiva,
    estado: "PENDIENTE_RRHH",
    tipo_pase: "EXTERNO",
  };
}

module.exports = { solicitarPaseExternoGdtCore };
