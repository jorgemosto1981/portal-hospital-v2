"use strict";

const { db } = require("./context");
const {
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  hldHlgFechaFinYmd,
  hldHlgFechaInicioYmd,
  obtenerYmdHoyInstitucional,
  vigenteEnFechaInclusivaYmd,
} = require("./fechaLaboralYmd");

const COL_HLC = "historial_laboral_cargos";
const COL_HLD = "historial_laboral_datos";
const COL_HLG = "historial_laboral_grupos";

function fechaReferenciaArgentina() {
  return obtenerYmdHoyInstitucional();
}

function hlcVigente(h, fechaRef) {
  if (h.activo === false) return false;
  return vigenteEnFechaInclusivaYmd(hlcFechaDesdeYmd(h), hlcFechaHastaYmd(h) || null, fechaRef);
}

function hldVigente(h, fechaRef) {
  if (h.activo === false) return false;
  return vigenteEnFechaInclusivaYmd(hldHlgFechaInicioYmd(h), hldHlgFechaFinYmd(h) || null, fechaRef);
}

function hlgVigente(h, fechaRef) {
  if (h.activo === false) return false;
  return vigenteEnFechaInclusivaYmd(hldHlgFechaInicioYmd(h), hldHlgFechaFinYmd(h) || null, fechaRef);
}

/**
 * Perfil laboral derivado solo de HLc → HLd → HLg vigentes a fecha Argentina.
 * `rol_id` canónico vive en HLc (`cfg_rol`).
 */
async function computeLaborProfileForPersona(personaId) {
  const fechaRef = fechaReferenciaArgentina();
  if (!personaId || typeof personaId !== "string" || !personaId.trim()) {
    return {
      roles_hlc_vigentes: [],
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

  const roles_hlc_vigentes = Array.from(rolesInChains)
    .map((r) => String(r || "").trim())
    .filter(Boolean)
    .sort();

  let rol_conflicto = false;
  if (roles_hlc_vigentes.length > 1) {
    rol_conflicto = true;
  }

  return {
    roles_hlc_vigentes,
    cargo_activo: cargoActivo,
    rol_conflicto,
    fecha_referencia: fechaRef,
  };
}

/** @param {unknown} token */
function rolesHlcFromAuthToken(token) {
  if (!token || typeof token !== "object") return [];
  const raw = token.roles_hlc_vigentes;
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))];
  }
  const legacy = typeof token.perfil_rol_id === "string" ? token.perfil_rol_id.trim() : "";
  return legacy ? [legacy] : [];
}

/** Acceso panel / callables RRHH desde claims (HLC canónico + legacy dev). */
function tokenHasRrhhLaborAccess(token) {
  if (!token || typeof token !== "object") return false;
  if (rolesHlcFromAuthToken(token).includes("CFG_RRHH")) return true;
  const role = typeof token.portal_role === "string" ? token.portal_role.trim().toLowerCase() : "";
  return role === "rrhh" || role === "admin";
}

module.exports = {
  computeLaborProfileForPersona,
  rolesHlcFromAuthToken,
  tokenHasRrhhLaborAccess,
  fechaReferenciaArgentina,
};
