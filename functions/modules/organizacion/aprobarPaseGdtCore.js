"use strict";

/**
 * Core: aprobarPaseGdt — SPIKE_PASES_GDT_FASE2_V2.md §4.3
 * Solo RRHH. Tx: cierra HLg origen, abre destino, marca pase APROBADO.
 * D1: puede ajustar fecha_efectiva (default = la de la solicitud).
 * Overrides nivel/régimen opcionales.
 */

const { ulid } = require("ulid");
const { FieldValue } = require("../shared/context");
const {
  loadHlgRowsPorPersona,
  hlgVigenteEnFecha,
} = require("../shared/solicitudHlgVigencia");
const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd } = require("../shared/fechaLaboralYmd");
const { loadGrupoTrabajoActivo } = require("./obtenerPlantelPorGdtCore");
const { resolverFechasPaseGdt } = require("./paseGdtFechas");
const {
  COL_SOL_PASES_GDT,
  encontrarSolapeHlgEnFecha,
} = require("./ejecutarPaseInternoGdtCore");

const COL_HLG = "historial_laboral_grupos";
const RX_SPG = /^spg_/i;
const RX_PER = /^per_/i;
const RX_GDT = /^gdt_/i;
const RX_HLG = /^hlg_/i;
const RX_REG = /^CFG_REG_HOR_/i;

/**
 * @param {unknown} raw
 */
function parseOverrides(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  let nivel = null;
  if (o.nivel_jerarquico !== null && o.nivel_jerarquico !== undefined && o.nivel_jerarquico !== "") {
    const n = Number(o.nivel_jerarquico);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, code: "invalid-argument", message: "overrides_hlg.nivel_jerarquico inválido." };
    }
    nivel = n;
  }
  let regimenId = null;
  if (o.regimen_horario_id !== null && o.regimen_horario_id !== undefined && o.regimen_horario_id !== "") {
    const s = String(o.regimen_horario_id).trim();
    if (!RX_REG.test(s) && !/^cfg_reg_hor_/i.test(s)) {
      // Aceptar id de régimen tal cual si no vacío (catálogo no siempre CFG_REG_HOR_).
      if (s.length < 3) {
        return { ok: false, code: "invalid-argument", message: "overrides_hlg.regimen_horario_id inválido." };
      }
    }
    regimenId = s;
  }
  let ancla = null;
  if (o.regimen_fecha_ancla !== null && o.regimen_fecha_ancla !== undefined && o.regimen_fecha_ancla !== "") {
    const ymd = String(o.regimen_fecha_ancla).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return { ok: false, code: "invalid-argument", message: "overrides_hlg.regimen_fecha_ancla inválida." };
    }
    ancla = ymd;
  }
  return {
    ok: true,
    overrides: {
      nivel_jerarquico: nivel,
      regimen_horario_id: regimenId,
      regimen_fecha_ancla: ancla,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   paseId: string;
 *   gdtDestinoId: string;
 *   fechaEfectivaYmd?: string | null;
 *   overridesHlg?: Record<string, unknown> | null;
 *   motivoRrhh?: string | null;
 *   resolventePersonaId: string;
 * }} input
 */
async function aprobarPaseGdtCore(db, input) {
  const paseId = String(input.paseId || "").trim();
  const gdtDestinoId = String(input.gdtDestinoId || "").trim();
  const resolventePersonaId = String(input.resolventePersonaId || "").trim();
  const motivoRrhh = String(input.motivoRrhh || "").trim() || null;

  if (!RX_SPG.test(paseId)) {
    return { ok: false, code: "invalid-argument", message: "pase_id inválido." };
  }
  if (!RX_GDT.test(gdtDestinoId)) {
    return { ok: false, code: "invalid-argument", message: "gdt_destino_id inválido." };
  }
  if (!RX_PER.test(resolventePersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }

  const ovParsed = parseOverrides(input.overridesHlg);
  if (!ovParsed.ok) return ovParsed;
  const overrides = ovParsed.overrides;

  const paseRef = db.collection(COL_SOL_PASES_GDT).doc(paseId);
  const paseSnap = await paseRef.get();
  if (!paseSnap.exists) {
    return { ok: false, code: "not-found", message: "Pase no encontrado." };
  }
  const pase = paseSnap.data() || {};
  if (String(pase.estado || "").trim() !== "PENDIENTE_RRHH") {
    return {
      ok: false,
      code: "failed-precondition",
      message: `El pase no está pendiente (estado: ${String(pase.estado || "—")}).`,
    };
  }
  if (String(pase.tipo_pase || "").trim() !== "EXTERNO") {
    return {
      ok: false,
      code: "failed-precondition",
      message: "Solo se aprueban pases externos pendientes.",
    };
  }

  const agentePersonaId = String(pase.agente_persona_id || "").trim();
  const hlgOrigenId = String(pase.hlg_origen_id || "").trim();
  if (!RX_PER.test(agentePersonaId) || !RX_HLG.test(hlgOrigenId)) {
    return { ok: false, code: "failed-precondition", message: "Pase sin agente/HLg origen válidos." };
  }
  if (agentePersonaId === resolventePersonaId) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "No podés resolver un pase sobre vos mismo.",
    };
  }

  const fechaInput =
    typeof input.fechaEfectivaYmd === "string" && input.fechaEfectivaYmd.trim()
      ? input.fechaEfectivaYmd.trim()
      : String(pase.fecha_efectiva || "").trim();
  const fechas = resolverFechasPaseGdt(fechaInput);
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
      message: "El HLg origen no pertenece al agente del pase.",
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

  const regimenHeredado = String(hlgOrigen.regimen_horario_id || "").trim();
  const datoLaboralId = String(hlgOrigen.dato_laboral_id || "").trim();
  const regimenFinal = overrides.regimen_horario_id || regimenHeredado;
  if (!regimenFinal) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "Sin regimen_horario_id (origen ni override).",
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

  const nivelOrigen =
    hlgOrigen.nivel_jerarquico === null || hlgOrigen.nivel_jerarquico === undefined
      ? null
      : Number(hlgOrigen.nivel_jerarquico);
  const nivelFinal =
    overrides.nivel_jerarquico !== null && overrides.nivel_jerarquico !== undefined
      ? overrides.nivel_jerarquico
      : Number.isFinite(nivelOrigen)
        ? nivelOrigen
        : null;
  const anclaFinal =
    overrides.regimen_fecha_ancla !== null
      ? overrides.regimen_fecha_ancla
      : hlgOrigen.regimen_fecha_ancla ?? null;

  const agenteHlgs = await loadHlgRowsPorPersona(db, agentePersonaId);
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
  const hlgDestinoPayload = {
    id: hlgDestinoId,
    persona_id: agentePersonaId,
    dato_laboral_id: datoLaboralId,
    grupo_de_trabajo_id: gdtDestinoId,
    nivel_jerarquico: nivelFinal,
    regimen_horario_id: regimenFinal,
    regimen_fecha_ancla: anclaFinal,
    fecha_inicio: fechaInicioDestino,
    fecha_fin: null,
    activo: true,
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };

  try {
    await db.runTransaction(async (tx) => {
      const freshPase = await tx.get(paseRef);
      if (!freshPase.exists) {
        throw Object.assign(new Error("Pase no encontrado."), { code: "not-found" });
      }
      const freshPaseData = freshPase.data() || {};
      if (String(freshPaseData.estado || "").trim() !== "PENDIENTE_RRHH") {
        throw Object.assign(new Error("El pase ya no está pendiente."), {
          code: "failed-precondition",
        });
      }

      const freshHlg = await tx.get(hlgOrigenRef);
      if (!freshHlg.exists) {
        throw Object.assign(new Error("HLg origen no encontrado."), { code: "not-found" });
      }
      const freshData = freshHlg.data() || {};
      if (String(freshData.persona_id || "").trim() !== agentePersonaId) {
        throw Object.assign(new Error("HLg origen inconsistente."), { code: "aborted" });
      }
      if (String(freshData.grupo_de_trabajo_id || "").trim() !== gdtOrigenId) {
        throw Object.assign(new Error("GDT origen inconsistente."), { code: "aborted" });
      }
      const freshRow = { id: freshHlg.id, ...freshData };
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
      /** @type {Record<string, unknown>} */
      const paseUpdate = {
        gdt_destino_id: gdtDestinoId,
        gdt_origen_id: gdtOrigenId,
        fecha_efectiva: fechaEfectiva,
        hlg_destino_id: hlgDestinoId,
        estado: "APROBADO",
        overrides_hlg: {
          nivel_jerarquico: overrides.nivel_jerarquico,
          regimen_horario_id: overrides.regimen_horario_id,
          regimen_fecha_ancla: overrides.regimen_fecha_ancla,
        },
        resuelto_en: FieldValue.serverTimestamp(),
        resuelto_por: resolventePersonaId,
        actualizado_en: FieldValue.serverTimestamp(),
        motivo_rechazo: null,
        requiere_conocimiento_rrhh: true,
      };
      if (motivoRrhh) paseUpdate.motivo_rrhh = motivoRrhh;
      tx.update(paseRef, paseUpdate);
    });
  } catch (err) {
    const code = err && typeof err === "object" && err.code ? String(err.code) : "internal";
    const message = err instanceof Error ? err.message : "Error en transacción de aprobación.";
    if (
      code === "not-found" ||
      code === "aborted" ||
      code === "failed-precondition" ||
      code === "permission-denied" ||
      code === "invalid-argument"
    ) {
      return { ok: false, code, message };
    }
    console.error("aprobarPaseGdtCore.tx", err);
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
    estado: "APROBADO",
  };
}

module.exports = { aprobarPaseGdtCore, parseOverrides };
