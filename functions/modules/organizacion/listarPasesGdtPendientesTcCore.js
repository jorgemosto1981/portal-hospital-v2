"use strict";

/**
 * Listados de pases GDT — TC pendiente / histórico, con sort + página 10.
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §5
 */

const { COL_SOL_PASES_GDT } = require("./ejecutarPaseInternoGdtCore");
const { ESTADOS_TC } = require("./tomarConocimientoPaseGdtCore");
const { loadPersonasMap, loadGrupoTrabajoActivo } = require("./obtenerPlantelPorGdtCore");

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 50;
/** Ventana máxima leída de Firestore antes de ordenar/paginar en memoria. */
const FETCH_CAP = 250;
const RX_PER = /^per_/i;

/** @type {readonly string[]} */
const ORDENES = Object.freeze([
  "creado_en",
  "tc_en",
  "agente",
  "gdt_origen",
  "gdt_destino",
  "estado",
]);

/**
 * @param {unknown} raw
 * @param {number} fallback
 * @param {number} max
 */
function resolveInt(raw, fallback, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), max);
}

/**
 * @param {unknown} raw
 */
function resolveOrden(raw) {
  const s = String(raw || "").trim();
  return ORDENES.includes(s) ? s : "creado_en";
}

/**
 * @param {unknown} raw
 */
function resolveDireccion(raw) {
  return String(raw || "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

/**
 * @param {unknown} raw
 */
function resolveVista(raw) {
  return String(raw || "").trim().toLowerCase() === "historico" ? "historico" : "pendiente";
}

/**
 * @param {FirebaseFirestore.Timestamp | null | undefined} ts
 */
function tsMillis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} acuses
 * @param {string} actorPersonaId
 */
function acuseJefeMs(acuses, actorPersonaId) {
  if (!acuses || typeof acuses !== "object" || Array.isArray(acuses)) return null;
  const row = /** @type {Record<string, unknown>} */ (acuses)[actorPersonaId];
  if (!row || typeof row !== "object") return null;
  return tsMillis(/** @type {{ en?: unknown }} */ (row).en);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Array<Record<string, unknown>>} rawItems
 * @param {{ actorPersonaId?: string }} [opts]
 */
async function enriquecerItemsPaseGdt(db, rawItems, opts = {}) {
  const actorPersonaId = String(opts.actorPersonaId || "").trim();
  const personaIds = [];
  const gdtIds = [];
  for (const it of rawItems) {
    if (it.agente_persona_id) personaIds.push(/** @type {string} */ (it.agente_persona_id));
    if (it.solicitante_persona_id) personaIds.push(/** @type {string} */ (it.solicitante_persona_id));
    if (it.rrhh_toma_conocimiento_por) personaIds.push(/** @type {string} */ (it.rrhh_toma_conocimiento_por));
    if (it.gdt_origen_id) gdtIds.push(/** @type {string} */ (it.gdt_origen_id));
    if (it.gdt_destino_id) gdtIds.push(/** @type {string} */ (it.gdt_destino_id));
  }

  const uniqueGdt = [...new Set(gdtIds)];
  const [personas, ...gdtResults] = await Promise.all([
    loadPersonasMap(db, personaIds),
    ...uniqueGdt.map((id) => loadGrupoTrabajoActivo(db, id)),
  ]);

  /** @type {Map<string, string>} */
  const gdtNombre = new Map();
  for (const r of gdtResults) {
    if (r && r.ok && r.gdt) gdtNombre.set(r.gdt.id, r.gdt.nombre);
  }

  return rawItems.map((it) => {
    const agente = personas.get(/** @type {string} */ (it.agente_persona_id));
    const solicitante = it.solicitante_persona_id
      ? personas.get(/** @type {string} */ (it.solicitante_persona_id))
      : undefined;
    const rrhhPor = it.rrhh_toma_conocimiento_por
      ? personas.get(/** @type {string} */ (it.rrhh_toma_conocimiento_por))
      : undefined;
    const agenteLabel = [agente?.apellido || "", agente?.nombre || ""]
      .filter(Boolean)
      .join(", ")
      .toLowerCase();
    const jefeTcMs =
      actorPersonaId && RX_PER.test(actorPersonaId)
        ? acuseJefeMs(/** @type {Record<string, unknown>} */ (it.jefes_acuses), actorPersonaId)
        : null;
    const tcEnMs = it.rrhh_toma_conocimiento_en_ms || jefeTcMs || null;

    return {
      pase_id: it.pase_id,
      agente_persona_id: it.agente_persona_id,
      agente_apellido: agente?.apellido || "",
      agente_nombre: agente?.nombre || "",
      agente_dni: agente?.dni || "",
      agente_sort: agenteLabel,
      hlg_origen_id: it.hlg_origen_id,
      hlg_destino_id: it.hlg_destino_id,
      gdt_origen_id: it.gdt_origen_id,
      gdt_origen_nombre: gdtNombre.get(/** @type {string} */ (it.gdt_origen_id)) || it.gdt_origen_id,
      gdt_destino_id: it.gdt_destino_id,
      gdt_destino_nombre: it.gdt_destino_id
        ? gdtNombre.get(/** @type {string} */ (it.gdt_destino_id)) || it.gdt_destino_id
        : null,
      solicitante_persona_id: it.solicitante_persona_id,
      solicitante_apellido: solicitante?.apellido || "",
      solicitante_nombre: solicitante?.nombre || "",
      tipo_pase: it.tipo_pase,
      estado: it.estado,
      motivo: it.motivo,
      destino_sugerido_texto: it.destino_sugerido_texto,
      fecha_efectiva: it.fecha_efectiva,
      requiere_conocimiento_rrhh: it.requiere_conocimiento_rrhh === true,
      rrhh_toma_conocimiento_en_ms: it.rrhh_toma_conocimiento_en_ms,
      rrhh_toma_conocimiento_por: it.rrhh_toma_conocimiento_por || null,
      rrhh_toma_conocimiento_por_apellido: rrhhPor?.apellido || "",
      rrhh_toma_conocimiento_por_nombre: rrhhPor?.nombre || "",
      jefe_toma_conocimiento_en_ms: jefeTcMs,
      tc_en_ms: tcEnMs,
      jefes_pendientes_conocimiento_ids: it.jefes_pendientes_conocimiento_ids,
      creado_en_ms: it.creado_en_ms,
      resuelto_en_ms: it.resuelto_en_ms,
    };
  });
}

/**
 * @param {FirebaseFirestore.QueryDocumentSnapshot} doc
 */
function mapDocBase(doc) {
  const d = doc.data() || {};
  const acuses =
    d.jefes_acuses && typeof d.jefes_acuses === "object" && !Array.isArray(d.jefes_acuses)
      ? d.jefes_acuses
      : {};
  return {
    pase_id: doc.id,
    agente_persona_id: String(d.agente_persona_id || "").trim(),
    hlg_origen_id: String(d.hlg_origen_id || "").trim(),
    hlg_destino_id: d.hlg_destino_id ? String(d.hlg_destino_id).trim() : null,
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
    requiere_conocimiento_rrhh: d.requiere_conocimiento_rrhh === true,
    rrhh_toma_conocimiento_en: d.rrhh_toma_conocimiento_en || null,
    rrhh_toma_conocimiento_en_ms: tsMillis(d.rrhh_toma_conocimiento_en),
    rrhh_toma_conocimiento_por: d.rrhh_toma_conocimiento_por
      ? String(d.rrhh_toma_conocimiento_por).trim()
      : null,
    jefes_pendientes_conocimiento_ids: Array.isArray(d.jefes_pendientes_conocimiento_ids)
      ? d.jefes_pendientes_conocimiento_ids.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    jefes_acuses_ids: Array.isArray(d.jefes_acuses_ids)
      ? d.jefes_acuses_ids.map((x) => String(x || "").trim()).filter(Boolean)
      : Object.keys(acuses),
    jefes_acuses: acuses,
    creado_en: d.creado_en || null,
    creado_en_ms: tsMillis(d.creado_en),
    resuelto_en: d.resuelto_en || null,
    resuelto_en_ms: tsMillis(d.resuelto_en),
  };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {string} orden
 * @param {"asc"|"desc"} direccion
 */
function ordenarItems(items, orden, direccion) {
  const dir = direccion === "asc" ? 1 : -1;
  const copy = [...items];
  copy.sort((a, b) => {
    /** @type {string|number|null} */
    let va = null;
    /** @type {string|number|null} */
    let vb = null;
    switch (orden) {
      case "tc_en":
        va = /** @type {number|null} */ (a.tc_en_ms ?? a.rrhh_toma_conocimiento_en_ms ?? 0);
        vb = /** @type {number|null} */ (b.tc_en_ms ?? b.rrhh_toma_conocimiento_en_ms ?? 0);
        break;
      case "agente":
        va = String(a.agente_sort || "");
        vb = String(b.agente_sort || "");
        break;
      case "gdt_origen":
        va = String(a.gdt_origen_nombre || a.gdt_origen_id || "").toLowerCase();
        vb = String(b.gdt_origen_nombre || b.gdt_origen_id || "").toLowerCase();
        break;
      case "gdt_destino":
        va = String(a.gdt_destino_nombre || a.gdt_destino_id || "").toLowerCase();
        vb = String(b.gdt_destino_nombre || b.gdt_destino_id || "").toLowerCase();
        break;
      case "estado":
        va = String(a.estado || "").toLowerCase();
        vb = String(b.estado || "").toLowerCase();
        break;
      case "creado_en":
      default:
        va = /** @type {number} */ (a.creado_en_ms || a.resuelto_en_ms || 0);
        vb = /** @type {number} */ (b.creado_en_ms || b.resuelto_en_ms || 0);
        break;
    }
    if (typeof va === "string" && typeof vb === "string") {
      const cmp = va.localeCompare(vb, "es");
      if (cmp !== 0) return cmp * dir;
    } else {
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      if (na !== nb) return (na < nb ? -1 : 1) * dir;
    }
    // Tie-break estable por pase_id
    return String(a.pase_id || "").localeCompare(String(b.pase_id || "")) * dir;
  });
  return copy;
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {number} page
 * @param {number} pageSize
 */
function paginarItems(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const pagina = Math.min(Math.max(page, 1), totalPages);
  const start = (pagina - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    total,
    page: pagina,
    page_size: pageSize,
    total_pages: totalPages,
    has_prev: pagina > 1,
    has_next: pagina < totalPages,
    truncated: total >= FETCH_CAP,
  };
}

/**
 * @param {Record<string, unknown>} opts
 */
function parseListOpts(opts = {}) {
  return {
    vista: resolveVista(opts.vista),
    orden: resolveOrden(opts.orden),
    direccion: resolveDireccion(opts.direccion),
    page: resolveInt(opts.page, 1, 10_000),
    pageSize: resolveInt(opts.pageSize ?? opts.page_size ?? opts.limite, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX),
  };
}

/**
 * RRHH — pendiente o histórico de TC.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   vista?: string;
 *   orden?: string;
 *   direccion?: string;
 *   page?: number;
 *   pageSize?: number;
 *   limite?: number;
 * }} [opts]
 */
async function listarPasesGdtPendientesTcRrhhCore(db, opts = {}) {
  const { vista, orden, direccion, page, pageSize } = parseListOpts(opts);

  let snap;
  try {
    if (vista === "historico") {
      // Equality + cap. Filtro de acuse en memoria (índice auto).
      snap = await db
        .collection(COL_SOL_PASES_GDT)
        .where("requiere_conocimiento_rrhh", "==", true)
        .limit(FETCH_CAP)
        .get();
    } else {
      snap = await db
        .collection(COL_SOL_PASES_GDT)
        .where("estado", "==", "APROBADO_INTERNO")
        .limit(FETCH_CAP)
        .get();
    }
  } catch (err) {
    console.error("listarPasesGdtPendientesTcRrhhCore.query", err);
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : "Error al listar pases TC RRHH.",
    };
  }

  const rawItems = snap.docs
    .map(mapDocBase)
    .filter((it) => {
      if (!ESTADOS_TC.has(it.estado)) return false;
      if (it.requiere_conocimiento_rrhh !== true) return false;
      if (vista === "historico") return Boolean(it.rrhh_toma_conocimiento_en);
      return !it.rrhh_toma_conocimiento_en;
    });

  const enriched = await enriquecerItemsPaseGdt(db, rawItems);
  const sorted = ordenarItems(enriched, orden, direccion);
  const pageResult = paginarItems(sorted, page, pageSize);

  return {
    ok: true,
    vista,
    orden,
    direccion,
    ...pageResult,
  };
}

/**
 * Jefe — pendiente (array-contains pendientes) o histórico (array-contains acuses_ids).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   actorPersonaId: string;
 *   vista?: string;
 *   orden?: string;
 *   direccion?: string;
 *   page?: number;
 *   pageSize?: number;
 *   limite?: number;
 * }} opts
 */
async function listarPasesGdtPendientesTcJefeCore(db, opts) {
  const actorPersonaId = String(opts.actorPersonaId || "").trim();
  const { vista, orden, direccion, page, pageSize } = parseListOpts(opts);

  if (!RX_PER.test(actorPersonaId)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }

  const field =
    vista === "historico" ? "jefes_acuses_ids" : "jefes_pendientes_conocimiento_ids";

  let snap;
  try {
    snap = await db
      .collection(COL_SOL_PASES_GDT)
      .where(field, "array-contains", actorPersonaId)
      .limit(FETCH_CAP)
      .get();
  } catch (err) {
    console.error("listarPasesGdtPendientesTcJefeCore.query", err);
    // Fallback histórico: docs viejos sin jefes_acuses_ids — no rompe pendientes.
    if (vista === "historico") {
      return {
        ok: true,
        vista,
        orden,
        direccion,
        items: [],
        total: 0,
        page: 1,
        page_size: pageSize,
        total_pages: 1,
        has_prev: false,
        has_next: false,
        truncated: false,
        warning: "Índice/campo jefes_acuses_ids no disponible aún; sin histórico.",
      };
    }
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : "Error al listar pases TC jefe.",
    };
  }

  let rawItems = snap.docs.map(mapDocBase).filter((it) => ESTADOS_TC.has(it.estado));

  if (vista === "historico") {
    // Docs con array o solo map legacy
    rawItems = rawItems.filter(
      (it) =>
        (Array.isArray(it.jefes_acuses_ids) && it.jefes_acuses_ids.includes(actorPersonaId)) ||
        Boolean(acuseJefeMs(/** @type {Record<string, unknown>} */ (it.jefes_acuses), actorPersonaId)),
    );
  } else {
    rawItems = rawItems.filter((it) =>
      (it.jefes_pendientes_conocimiento_ids || []).includes(actorPersonaId),
    );
  }

  const enriched = await enriquecerItemsPaseGdt(db, rawItems, { actorPersonaId });
  const sorted = ordenarItems(enriched, orden, direccion);
  const pageResult = paginarItems(sorted, page, pageSize);

  return {
    ok: true,
    vista,
    orden,
    direccion,
    ...pageResult,
  };
}

module.exports = {
  PAGE_SIZE_DEFAULT,
  FETCH_CAP,
  ORDENES,
  parseListOpts,
  ordenarItems,
  paginarItems,
  listarPasesGdtPendientesTcRrhhCore,
  listarPasesGdtPendientesTcJefeCore,
};
