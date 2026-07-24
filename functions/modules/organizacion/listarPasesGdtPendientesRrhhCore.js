"use strict";

/**
 * Core: listarPasesGdtPendientesRrhh — bandeja RRHH (PENDIENTE_RRHH).
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.3 / §6
 */

const { COL_SOL_PASES_GDT } = require("./ejecutarPaseInternoGdtCore");
const { loadPersonasMap, loadGrupoTrabajoActivo } = require("./obtenerPlantelPorGdtCore");

const LIMITE_DEFAULT = 80;
const LIMITE_MAX = 150;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ limite?: number }} [opts]
 */
async function listarPasesGdtPendientesRrhhCore(db, opts = {}) {
  const limRaw = Number(opts.limite);
  const limite = Number.isFinite(limRaw)
    ? Math.min(Math.max(Math.trunc(limRaw), 1), LIMITE_MAX)
    : LIMITE_DEFAULT;

  let snap;
  try {
    // Equality sola (índice automático). Orden en memoria para no depender del composite.
    snap = await db
      .collection(COL_SOL_PASES_GDT)
      .where("estado", "==", "PENDIENTE_RRHH")
      .limit(limite)
      .get();
  } catch (err) {
    console.error("listarPasesGdtPendientesRrhhCore.query", err);
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : "Error al listar pases pendientes.",
    };
  }

  /** @type {Array<Record<string, unknown>>} */
  const rawItems = snap.docs.map((doc) => {
    const d = doc.data() || {};
    return {
      pase_id: doc.id,
      agente_persona_id: String(d.agente_persona_id || "").trim(),
      hlg_origen_id: String(d.hlg_origen_id || "").trim(),
      gdt_origen_id: String(d.gdt_origen_id || "").trim(),
      gdt_destino_id: d.gdt_destino_id ? String(d.gdt_destino_id).trim() : null,
      solicitante_persona_id: d.solicitante_persona_id
        ? String(d.solicitante_persona_id).trim()
        : null,
      tipo_pase: String(d.tipo_pase || "").trim() || null,
      estado: String(d.estado || "").trim(),
      motivo: String(d.motivo || "").trim(),
      destino_sugerido_texto: d.destino_sugerido_texto
        ? String(d.destino_sugerido_texto).trim()
        : null,
      fecha_efectiva: d.fecha_efectiva ? String(d.fecha_efectiva).trim().slice(0, 10) : null,
      creado_en: d.creado_en || null,
    };
  });

  rawItems.sort((a, b) => {
    const ta = a.creado_en && typeof a.creado_en.toMillis === "function" ? a.creado_en.toMillis() : 0;
    const tb = b.creado_en && typeof b.creado_en.toMillis === "function" ? b.creado_en.toMillis() : 0;
    return tb - ta;
  });

  const personaIds = [];
  const gdtIds = [];
  for (const it of rawItems) {
    if (it.agente_persona_id) personaIds.push(/** @type {string} */ (it.agente_persona_id));
    if (it.solicitante_persona_id) personaIds.push(/** @type {string} */ (it.solicitante_persona_id));
    if (it.gdt_origen_id) gdtIds.push(/** @type {string} */ (it.gdt_origen_id));
  }

  const [personas, ...gdtResults] = await Promise.all([
    loadPersonasMap(db, personaIds),
    ...[...new Set(gdtIds)].map((id) => loadGrupoTrabajoActivo(db, id)),
  ]);

  /** @type {Map<string, string>} */
  const gdtNombre = new Map();
  for (const r of gdtResults) {
    if (r && r.ok && r.gdt) gdtNombre.set(r.gdt.id, r.gdt.nombre);
  }

  const items = rawItems.map((it) => {
    const agente = personas.get(/** @type {string} */ (it.agente_persona_id));
    const solicitante = it.solicitante_persona_id
      ? personas.get(/** @type {string} */ (it.solicitante_persona_id))
      : undefined;
    const creadoMs =
      it.creado_en && typeof it.creado_en.toMillis === "function" ? it.creado_en.toMillis() : null;
    return {
      pase_id: it.pase_id,
      agente_persona_id: it.agente_persona_id,
      agente_apellido: agente?.apellido || "",
      agente_nombre: agente?.nombre || "",
      agente_dni: agente?.dni || "",
      hlg_origen_id: it.hlg_origen_id,
      gdt_origen_id: it.gdt_origen_id,
      gdt_origen_nombre: gdtNombre.get(/** @type {string} */ (it.gdt_origen_id)) || it.gdt_origen_id,
      solicitante_persona_id: it.solicitante_persona_id,
      solicitante_apellido: solicitante?.apellido || "",
      solicitante_nombre: solicitante?.nombre || "",
      tipo_pase: it.tipo_pase,
      estado: it.estado,
      motivo: it.motivo,
      destino_sugerido_texto: it.destino_sugerido_texto,
      fecha_efectiva: it.fecha_efectiva,
      creado_en_ms: creadoMs,
    };
  });

  return { ok: true, items, total: items.length };
}

module.exports = { listarPasesGdtPendientesRrhhCore };
