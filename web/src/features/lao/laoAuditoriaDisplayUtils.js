/** Orden pipeline LAO (RFC §6). */
export const FASES_PIPELINE = [
  { id: "A", titulo: "Artículo y versión", subtitulo: "Patrón de saldo y configuración" },
  { id: "E", titulo: "Elegibilidad laboral", subtitulo: "HLC, cargo y filtros" },
  { id: "C", titulo: "Cómputo de fechas", subtitulo: "Rango, calendario y días consumo" },
  { id: "W", titulo: "Preaviso y workflow", subtitulo: "Normativa e institucional" },
  { id: "L", titulo: "Asignación de cupo", subtitulo: "Apertura, TSE y matriz" },
  { id: "S", titulo: "Saldo y mínimos", subtitulo: "Bolsa, FIFO y R3" },
];

const NIVEL_RANK = { bloqueante: 3, advertencia: 2, ok: 1, info: 0 };

/**
 * @param {Record<string, unknown> | null | undefined} snapshot
 */
export function snapshotTieneAdvertencias(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const warns = Array.isArray(snapshot.warnings) ? snapshot.warnings.length : 0;
  const advChecks = (Array.isArray(snapshot.checks) ? snapshot.checks : []).filter(
    (c) => resolveWorstNivel(c?.nivel) === "advertencia",
  ).length;
  return warns + advChecks > 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} snapshot
 */
export function esSnapshotMotorV2(snapshot) {
  return Boolean(
    snapshot &&
      typeof snapshot === "object" &&
      (snapshot.motor_version === "lao-preview-v2" || Array.isArray(snapshot.checks)),
  );
}


/**
 * @param {string} nivel
 */
export function resolveWorstNivel(nivel) {
  const n = String(nivel || "").toLowerCase();
  return NIVEL_RANK[n] != null ? n : "info";
}

/**
 * @param {Array<{ nivel?: string }>} items
 */
export function peorNivelDeLista(items) {
  let worst = "info";
  for (const item of items || []) {
    const n = resolveWorstNivel(item?.nivel);
    if ((NIVEL_RANK[n] ?? 0) > (NIVEL_RANK[worst] ?? 0)) worst = n;
  }
  return worst;
}

/**
 * @param {string} nivel
 */
export function faseAbiertaPorDefecto(nivel) {
  return nivel === "bloqueante" || nivel === "advertencia";
}

/**
 * @param {string} nivel
 */
export function claseShellFase(nivel) {
  if (nivel === "bloqueante") return "border-red-200 bg-red-50/40";
  if (nivel === "advertencia") return "border-amber-200 bg-amber-50/50";
  if (nivel === "ok") return "border-emerald-200 bg-emerald-50/40";
  return "border-slate-200 bg-slate-50/60";
}

/**
 * @param {string} nivel
 */
export function claseBadgeFase(nivel) {
  if (nivel === "bloqueante") return "bg-red-600 text-white";
  if (nivel === "advertencia") return "bg-amber-500 text-white";
  if (nivel === "ok") return "bg-emerald-600 text-white";
  return "bg-slate-500 text-white";
}

/**
 * @param {string} nivel
 */
export function etiquetaNivel(nivel) {
  if (nivel === "bloqueante") return "Bloqueante";
  if (nivel === "advertencia") return "Advertencia";
  if (nivel === "ok") return "OK";
  return "Info";
}

/**
 * @param {string} nivel
 */
export function claseItemCheck(nivel) {
  if (nivel === "bloqueante") return "border-red-200 bg-red-50 text-red-900";
  if (nivel === "advertencia") return "border-amber-200 bg-amber-50 text-amber-900";
  if (nivel === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-slate-200 bg-white text-slate-700";
}

/**
 * Agrupa checks por fase en orden A→E→W→L→S; fases desconocidas al final.
 * @param {Array<{ fase?: string, nivel?: string, codigo?: string, detalle?: string }>} checks
 */
export function groupChecksByFase(checks) {
  const list = Array.isArray(checks) ? checks : [];
  /** @type {Map<string, typeof list>} */
  const byFase = new Map();
  for (const c of list) {
    const id = String(c?.fase || "?").toUpperCase();
    if (!byFase.has(id)) byFase.set(id, []);
    byFase.get(id).push(c);
  }

  const knownIds = new Set(FASES_PIPELINE.map((f) => f.id));
  const grupos = FASES_PIPELINE.map((meta) => {
    const items = byFase.get(meta.id) || [];
    byFase.delete(meta.id);
    return {
      ...meta,
      checks: items,
      peorNivel: peorNivelDeLista(items),
    };
  }).filter((g) => g.checks.length > 0);

  for (const [id, items] of byFase.entries()) {
    grupos.push({
      id,
      titulo: `Fase ${id}`,
      subtitulo: "Otros controles",
      checks: items,
      peorNivel: peorNivelDeLista(items),
    });
  }

  return grupos;
}

/**
 * Resumen ejecutivo para RRHH: qué bloquea primero.
 * @param {Array<{ nivel?: string, codigo?: string, detalle?: string }>} checks
 * @param {Array<{ codigo?: string, copy?: string }>} warnings
 */
export function buildResumenEjecutivo(checks, warnings) {
  const bloqueantes = (checks || []).filter((c) => resolveWorstNivel(c?.nivel) === "bloqueante");
  if (bloqueantes.length > 0) {
    return {
      tipo: "bloqueante",
      titulo: "Trámite bloqueado",
      mensaje: String(bloqueantes[0]?.detalle || bloqueantes[0]?.codigo || "Revisá los gates del motor."),
    };
  }
  const advCount = (warnings || []).length + (checks || []).filter((c) => resolveWorstNivel(c?.nivel) === "advertencia").length;
  if (advCount > 0) {
    return {
      tipo: "advertencia",
      titulo: "Trámite habilitado con advertencias",
      mensaje: `${advCount} advertencia(s) normativa(s) o institucional(es). Podés continuar; quedan registradas en auditoría.`,
    };
  }
  return {
    tipo: "ok",
    titulo: "Trámite habilitado",
    mensaje: "Todos los gates del motor fueron superados sin novedades.",
  };
}
