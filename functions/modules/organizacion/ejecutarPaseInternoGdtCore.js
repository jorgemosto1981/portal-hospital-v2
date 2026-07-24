"use strict";

/**
 * Core: ejecutarPaseInternoGdt — SPIKE_PASES_GDT_FASE2_V2.md §3–4.1
 * Cierra HLg origen, abre HLg destino, persiste sol_pases_gdt (APROBADO_INTERNO).
 * Overrides de nivel/régimen: no en MVP interno (D2).
 */

const { ulid } = require("ulid");
const { FieldValue } = require("../shared/context");
const {
  loadHlgRowsPorPersona,
  hlgVigenteEnFecha,
  nivelTitularEnGrupo,
} = require("../shared/solicitudHlgVigencia");
const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd } = require("../shared/fechaLaboralYmd");
const { loadGrupoTrabajoActivo } = require("./obtenerPlantelPorGdtCore");
const {
  loadNodosGdtActivos,
  gdtEnSubarbolDeRaices,
  resolverRaicesJefe,
} = require("./listarArbolGdtPlantelCore");
const { resolverFechasPaseGdt } = require("./paseGdtFechas");

const COL_HLG = "historial_laboral_grupos";
const COL_SOL_PASES_GDT = "sol_pases_gdt";
const RX_PER = /^per_/i;
const RX_HLG = /^hlg_/i;
const RX_GDT = /^gdt_/i;

/**
 * D3: ¿hay otro HLg de la persona vigente en `fechaYmd` distinto de `excludeHlgId`?
 * Tras cerrar origen con fecha_fin=efectiva, en efectiva+1 el origen ya no cuenta.
 *
 * @param {Array<Record<string, unknown>>} hlgRows
 * @param {string} fechaYmd
 * @param {string} excludeHlgId
 * @returns {Record<string, unknown> | null}
 */
function encontrarSolapeHlgEnFecha(hlgRows, fechaYmd, excludeHlgId) {
  const excl = String(excludeHlgId || "").trim();
  for (const h of hlgRows || []) {
    const id = String(h.id || "").trim();
    if (id && id === excl) continue;
    if (!hlgVigenteEnFecha(h, fechaYmd)) continue;
    return h;
  }
  return null;
}

/**
 * ¿El actor puede pasar al agente desde gdtOrigen?
 * - Origen en jurisdicción (subárbol de raíces HLg del actor).
 * - Si el actor tiene HLg en el mismo GDT: nivel_jerarquico actor > agente.
 * - Si el actor solo manda desde un ancestro: OK (jurisdicción).
 *
 * @param {{
 *   byId: Map<string, { id: string, parent_group_id: string | null }>;
 *   raizIds: Set<string>;
 *   actorVigentes: Array<Record<string, unknown>>;
 *   gdtOrigen: string;
 *   nivelAgente: number | null;
 * }} args
 */
function actorPuedePasarDesdeOrigen(args) {
  const { byId, raizIds, actorVigentes, gdtOrigen, nivelAgente } = args;
  if (!gdtEnSubarbolDeRaices(byId, gdtOrigen, raizIds)) return false;

  const nivelActorEnOrigen = nivelTitularEnGrupo(actorVigentes, gdtOrigen);
  if (nivelActorEnOrigen !== null) {
    if (nivelAgente === null || !Number.isFinite(nivelAgente)) return false;
    return nivelActorEnOrigen > nivelAgente;
  }
  // Mando desde ancestro (raíz que cubre el origen sin HLg propio en ese nodo).
  return true;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   agentePersonaId: string;
 *   hlgOrigenId: string;
 *   gdtDestinoId: string;
 *   fechaEfectivaYmd: string;
 *   motivo: string;
 *   solicitantePersonaId: string;
 *   esRrhh: boolean;
 * }} input
 */
async function ejecutarPaseInternoGdtCore(db, input) {
  const agentePersonaId = String(input.agentePersonaId || "").trim();
  const hlgOrigenId = String(input.hlgOrigenId || "").trim();
  const gdtDestinoId = String(input.gdtDestinoId || "").trim();
  const motivo = String(input.motivo || "").trim();
  const solicitantePersonaId = String(input.solicitantePersonaId || "").trim();
  const esRrhh = input.esRrhh === true;

  if (!RX_PER.test(agentePersonaId)) {
    return { ok: false, code: "invalid-argument", message: "agente_persona_id inválido." };
  }
  if (!RX_HLG.test(hlgOrigenId)) {
    return { ok: false, code: "invalid-argument", message: "hlg_origen_id inválido." };
  }
  if (!RX_GDT.test(gdtDestinoId)) {
    return { ok: false, code: "invalid-argument", message: "gdt_destino_id inválido." };
  }
  if (!motivo || motivo.length < 3) {
    return { ok: false, code: "invalid-argument", message: "motivo obligatorio (mín. 3 caracteres)." };
  }
  if (!esRrhh && !RX_PER.test(solicitantePersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }
  if (RX_PER.test(solicitantePersonaId) && solicitantePersonaId === agentePersonaId && !esRrhh) {
    return { ok: false, code: "failed-precondition", message: "No podés ejecutarte un pase a vos mismo." };
  }

  const fechas = resolverFechasPaseGdt(input.fechaEfectivaYmd);
  if (!fechas.ok) return fechas;
  const { fecha_efectiva: fechaEfectiva, fecha_inicio_destino: fechaInicioDestino } = fechas;

  const destinoCheck = await loadGrupoTrabajoActivo(db, gdtDestinoId);
  if (!destinoCheck.ok) {
    return { ok: false, code: destinoCheck.code, message: destinoCheck.message };
  }

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
  if (gdtOrigenId === gdtDestinoId) {
    return { ok: false, code: "failed-precondition", message: "El GDT destino debe ser distinto del origen." };
  }
  if (!hlgVigenteEnFecha(hlgOrigen, fechaEfectiva)) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "El HLg origen no está vigente en la fecha efectiva (último día en el grupo).",
    };
  }

  const regimenHorarioId = String(hlgOrigen.regimen_horario_id || "").trim();
  const datoLaboralId = String(hlgOrigen.dato_laboral_id || "").trim();
  if (!regimenHorarioId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "El HLg origen no tiene regimen_horario_id; no se puede heredar.",
    };
  }
  if (!datoLaboralId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "El HLg origen no tiene dato_laboral_id; no se puede heredar.",
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

  // Jurisdicción + subordinación (jefe). RRHH bypasea.
  if (!esRrhh) {
    const [nodos, raicesIds, actorHlgs] = await Promise.all([
      loadNodosGdtActivos(db),
      resolverRaicesJefe(db, solicitantePersonaId, fechaEfectiva),
      loadHlgRowsPorPersona(db, solicitantePersonaId),
    ]);
    const raizSet = new Set(raicesIds);
    const byId = new Map(nodos.map((n) => [n.id, n]));
    if (!gdtEnSubarbolDeRaices(byId, gdtDestinoId, raizSet)) {
      return {
        ok: false,
        code: "permission-denied",
        message: "El GDT destino no está en tu jurisdicción de plantel.",
      };
    }
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

  const agenteHlgs = await loadHlgRowsPorPersona(db, agentePersonaId);
  // Simular cierre del origen para evaluar solape el día de apertura destino.
  const agenteHlgsTrasCierre = agenteHlgs.map((h) => {
    if (String(h.id || "").trim() !== hlgOrigenId) return h;
    return { ...h, fecha_fin: fechaEfectiva };
  });
  const solape = encontrarSolapeHlgEnFecha(agenteHlgsTrasCierre, fechaInicioDestino, hlgOrigenId);
  if (solape) {
    return {
      ok: false,
      code: "failed-precondition",
      message: `Solape HLg: el agente ya tiene asignación vigente el ${fechaInicioDestino} (${solape.id}).`,
    };
  }

  const hlgDestinoId = `hlg_${ulid()}`;
  const paseId = `spg_${ulid()}`;
  const nivelOrigen =
    hlgOrigen.nivel_jerarquico === null || hlgOrigen.nivel_jerarquico === undefined
      ? null
      : Number(hlgOrigen.nivel_jerarquico);

  const hlgDestinoPayload = {
    id: hlgDestinoId,
    persona_id: agentePersonaId,
    dato_laboral_id: datoLaboralId,
    grupo_de_trabajo_id: gdtDestinoId,
    nivel_jerarquico: Number.isFinite(nivelOrigen) ? nivelOrigen : null,
    regimen_horario_id: regimenHorarioId,
    regimen_fecha_ancla: hlgOrigen.regimen_fecha_ancla ?? null,
    fecha_inicio: fechaInicioDestino,
    fecha_fin: null,
    activo: true,
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };

  const pasePayload = {
    agente_persona_id: agentePersonaId,
    hlg_origen_id: hlgOrigenId,
    gdt_origen_id: gdtOrigenId,
    gdt_destino_id: gdtDestinoId,
    solicitante_persona_id: solicitantePersonaId || null,
    tipo_pase: "INTERNO",
    estado: "APROBADO_INTERNO",
    motivo,
    destino_sugerido_texto: null,
    fecha_efectiva: fechaEfectiva,
    hlg_destino_id: hlgDestinoId,
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
    resuelto_en: FieldValue.serverTimestamp(),
    resuelto_por: solicitantePersonaId || null,
    motivo_rechazo: null,
  };

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(hlgOrigenRef);
      if (!fresh.exists) {
        throw Object.assign(new Error("HLg origen no encontrado."), { code: "not-found" });
      }
      const freshData = fresh.data() || {};
      if (String(freshData.persona_id || "").trim() !== agentePersonaId) {
        throw Object.assign(new Error("HLg origen inconsistente."), { code: "aborted" });
      }
      if (String(freshData.grupo_de_trabajo_id || "").trim() !== gdtOrigenId) {
        throw Object.assign(new Error("GDT origen inconsistente."), { code: "aborted" });
      }
      const freshRow = { id: fresh.id, ...freshData };
      if (!hlgVigenteEnFecha(freshRow, fechaEfectiva)) {
        throw Object.assign(new Error("HLg origen dejó de estar vigente."), {
          code: "failed-precondition",
        });
      }

      tx.update(hlgOrigenRef, {
        fecha_fin: fechaEfectiva,
        actualizado_en: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection(COL_HLG).doc(hlgDestinoId), hlgDestinoPayload);
      tx.set(db.collection(COL_SOL_PASES_GDT).doc(paseId), pasePayload);
    });
  } catch (err) {
    const code = err && typeof err === "object" && err.code ? String(err.code) : "internal";
    const message =
      err instanceof Error ? err.message : "Error en transacción de pase interno.";
    if (
      code === "not-found" ||
      code === "aborted" ||
      code === "failed-precondition" ||
      code === "permission-denied" ||
      code === "invalid-argument"
    ) {
      return { ok: false, code, message };
    }
    console.error("ejecutarPaseInternoGdtCore.tx", err);
    return { ok: false, code: "internal", message };
  }

  return {
    ok: true,
    pase_id: paseId,
    hlg_destino_id: hlgDestinoId,
    hlg_origen_id: hlgOrigenId,
    gdt_origen_id: gdtOrigenId,
    gdt_destino_id: gdtDestinoId,
    fecha_efectiva: fechaEfectiva,
    fecha_inicio_destino: fechaInicioDestino,
    estado: "APROBADO_INTERNO",
  };
}

module.exports = {
  COL_SOL_PASES_GDT,
  encontrarSolapeHlgEnFecha,
  actorPuedePasarDesdeOrigen,
  ejecutarPaseInternoGdtCore,
};
