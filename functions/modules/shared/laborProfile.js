"use strict";

const { db } = require("./context");

const COL_HLC = "historial_laboral_cargos";
const COL_HLD = "historial_laboral_datos";
const COL_HLG = "historial_laboral_grupos";

const TZ_AR = "America/Argentina/Buenos_Aires";

/** Fecha local Argentina YYYY-MM-DD (vigencias laborales vs «hoy» institucional). */
function fechaReferenciaArgentina() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return new Date().toISOString().slice(0, 10);
  return `${y}-${m}-${d}`;
}

function toDateKey(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && value !== null && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function vigenteEnFechaInclusiva(desde, hasta, fecha) {
  if (!desde || !fecha) return false;
  if (desde > fecha) return false;
  if (hasta && hasta < fecha) return false;
  return true;
}

function hlcVigente(h, fechaRef) {
  if (h.activo === false) return false;
  const desde = toDateKey(h.fecha_desde);
  const hastaRaw = h.fecha_hasta != null && h.fecha_hasta !== "" ? toDateKey(h.fecha_hasta) : "";
  return vigenteEnFechaInclusiva(desde, hastaRaw || null, fechaRef);
}

function hldVigente(h, fechaRef) {
  if (h.activo === false) return false;
  const desde = toDateKey(h.fecha_inicio);
  const hastaRaw = h.fecha_fin != null && h.fecha_fin !== "" ? toDateKey(h.fecha_fin) : "";
  return vigenteEnFechaInclusiva(desde, hastaRaw || null, fechaRef);
}

function hlgVigente(h, fechaRef) {
  if (h.activo === false) return false;
  const desde = toDateKey(h.fecha_inicio);
  const hastaRaw = h.fecha_fin != null && h.fecha_fin !== "" ? toDateKey(h.fecha_fin) : "";
  return vigenteEnFechaInclusiva(desde, hastaRaw || null, fechaRef);
}

/**
 * Perfil laboral derivado solo de HLc → HLd → HLg vigentes a fecha Argentina.
 * `rol_id` canónico vive en HLc (`cfg_rol`).
 */
async function computeLaborProfileForPersona(personaId) {
  const fechaRef = fechaReferenciaArgentina();
  if (!personaId || typeof personaId !== "string" || !personaId.trim()) {
    return {
      perfil_rol_id: null,
      cargo_activo: false,
      rol_conflicto: false,
      fecha_referencia: fechaRef,
    };
  }
  const pid = personaId.trim();
  const [hlcSnap, hldSnap, hlgSnap] = await Promise.all([
    db.collection(COL_HLC).where("persona_id", "==", pid).get(),
    db.collection(COL_HLD).where("persona_id", "==", pid).get(),
    db.collection(COL_HLG).where("persona_id", "==", pid).get(),
  ]);
  const hlcs = hlcSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const hlds = hldSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const hlgs = hlgSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

  const hlcVig = hlcs.filter((h) => hlcVigente(h, fechaRef));
  const hldByCargo = new Map();
  for (const h of hlds) {
    if (!hldVigente(h, fechaRef)) continue;
    const cid = String(h.cargo_id || "").trim();
    if (!cid) continue;
    if (!hldByCargo.has(cid)) hldByCargo.set(cid, []);
    hldByCargo.get(cid).push(h);
  }
  const hlgByDato = new Map();
  for (const h of hlgs) {
    if (!hlgVigente(h, fechaRef)) continue;
    const did = String(h.dato_laboral_id || "").trim();
    if (!did) continue;
    if (!hlgByDato.has(did)) hlgByDato.set(did, []);
    hlgByDato.get(did).push(h);
  }

  const rolesInChains = new Set();
  let cargoActivo = false;
  for (const hlc of hlcVig) {
    const listHld = hldByCargo.get(hlc.id) || [];
    for (const hld of listHld) {
      const listHlg = hlgByDato.get(hld.id) || [];
      if (listHlg.length === 0) continue;
      cargoActivo = true;
      const rid = String(hlc.rol_id || "").trim();
      if (rid) rolesInChains.add(rid);
    }
  }

  let perfil_rol_id = null;
  let rol_conflicto = false;
  if (rolesInChains.size === 1) {
    perfil_rol_id = Array.from(rolesInChains)[0];
  } else if (rolesInChains.size > 1) {
    rol_conflicto = true;
  }

  return {
    perfil_rol_id,
    cargo_activo: cargoActivo,
    rol_conflicto,
    fecha_referencia: fechaRef,
  };
}

function mapCfgRolIdToPortalRole(perfilRolId) {
  if (!perfilRolId || typeof perfilRolId !== "string") return null;
  const u = perfilRolId.trim().toUpperCase();
  if (u === "CFG_RRHH") return "rrhh";
  return null;
}

/**
 * Compatibilidad: panel RRHH en consola (`portal_role`) mientras no exista cadena HL;
 * con cadena vigente manda el catálogo (`perfil_rol_id` en HLc).
 */
function resolvePortalRoleForClaims({ perfilRolId, cargoActivo, prevClaims }) {
  const fromLabor = mapCfgRolIdToPortalRole(perfilRolId);
  if (fromLabor) return fromLabor;
  if (perfilRolId) return null;
  if (cargoActivo) return null;
  const prev =
    prevClaims && typeof prevClaims.portal_role === "string"
      ? prevClaims.portal_role.trim().toLowerCase()
      : "";
  if (prev === "rrhh" || prev === "admin") return prev;
  return null;
}

module.exports = {
  computeLaborProfileForPersona,
  mapCfgRolIdToPortalRole,
  resolvePortalRoleForClaims,
  fechaReferenciaArgentina,
};
