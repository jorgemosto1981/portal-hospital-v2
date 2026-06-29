"use strict";

const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");
const { buildPersonaLabel } = require("./eventosV2");
const { SCHEMA_MED_AVISO } = require("./avisoMedicoProvisoriosVigentesCore");
const { resolverCodigoGrillaAvisoMedico, resolverRangoYmdAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {Map<string, string>} cache
 */
async function resolvePersonaLabel(db, personaId, cache) {
  const id = String(personaId || "").trim();
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  const snap = await db.collection(COL_PERSONAS).doc(id).get();
  const label = snap.exists ? buildPersonaLabel(snap.data()) : id;
  cache.set(id, label);
  return label;
}

/**
 * @param {Record<string, unknown>} sol
 * @param {string} revisorPersonaId
 * @param {{ rrhhBypass?: boolean }} opts
 */
function revisorPuedeVerResumen(sol, revisorPersonaId, opts = {}) {
  const rev = String(revisorPersonaId || "").trim();
  if (!rev) return false;
  if (opts.rrhhBypass === true) return true;
  const titular = String(sol.titular_persona_id || "").trim();
  if (titular && titular === rev) return true;
  const aut = Array.isArray(sol.autorizadores_elegibles_ids) ? sol.autorizadores_elegibles_ids : [];
  if (aut.some((id) => String(id).trim() === rev)) return true;
  if (String(sol.jefe_revision_persona_id || "").trim() === rev) return true;
  if (String(sol.rrhh_toma_conocimiento_persona_id || "").trim() === rev) return true;
  return false;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {{ rrhhBypass?: boolean }} opts
 */
async function obtenerResumenSolicitudArticuloGrilla(db, solId, revisorPersonaId, opts = {}) {
  const id = String(solId || "").trim();
  if (!/^sol_[0-9A-HJKMNP-TV-Z]{26}$/i.test(id)) {
    return { ok: false, codigo: "SOL_ID_INVALIDO", mensaje: "solicitud_id inválido." };
  }

  const snap = await db.collection(COL_SOL).doc(id).get();
  if (!snap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }

  const sol = snap.data() || {};
  if (!revisorPuedeVerResumen(sol, revisorPersonaId, opts)) {
    return { ok: false, codigo: "PERMISO_DENEGADO", mensaje: "No podés ver el detalle de esta solicitud." };
  }

  const artCache = new Map();
  const personaCache = new Map();
  const schemaMed = String(sol.schema_version || "") === SCHEMA_MED_AVISO;
  const artDisplay = schemaMed
    ? {
        codigo_grilla: resolverCodigoGrillaAvisoMedico(sol),
        articulo_label:
          sol.ingreso_medico?.es_licencia_incompleta === true
            ? "Aviso médico provisorio"
            : "Aviso médico (pendiente clasificación)",
      }
    : await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);

  const titularId = String(sol.titular_persona_id || "").trim();
  const jefeId = String(sol.jefe_revision_persona_id || "").trim();
  const rrhhTcId = String(sol.rrhh_toma_conocimiento_persona_id || "").trim();

  const [titularLabel, jefeLabel, rrhhTcLabel] = await Promise.all([
    resolvePersonaLabel(db, titularId, personaCache),
    resolvePersonaLabel(db, jefeId, personaCache),
    resolvePersonaLabel(db, rrhhTcId, personaCache),
  ]);

  const rangoMed = schemaMed ? resolverRangoYmdAvisoMedico(sol) : null;

  return {
    ok: true,
    solicitud_id: id,
    titular_persona_id: titularId || null,
    titular_label: titularLabel,
    estado_solicitud_id: String(sol.estado_solicitud_id || "") || null,
    fecha_desde:
      (schemaMed && rangoMed?.fecha_desde) || String(sol.fecha_desde || "").slice(0, 10) || null,
    fecha_hasta:
      (schemaMed && rangoMed?.fecha_hasta) || String(sol.fecha_hasta || "").slice(0, 10) || null,
    articulo_id: String(sol.articulo_id || "") || null,
    codigo_grilla: artDisplay.codigo_grilla || null,
    articulo_label: artDisplay.articulo_label || null,
    dias_solicitados: sol.dias_solicitados ?? null,
    jefe_revision_persona_id: jefeId || null,
    jefe_revision_label: jefeLabel,
    jefe_motivo: sol.jefe_motivo != null ? String(sol.jefe_motivo) : null,
    rrhh_toma_conocimiento_persona_id: rrhhTcId || null,
    rrhh_toma_conocimiento_label: rrhhTcLabel,
    grupo_trabajo_id_ancla: String(sol.grupo_trabajo_id_ancla || "") || null,
  };
}

module.exports = {
  obtenerResumenSolicitudArticuloGrilla,
  revisorPuedeVerResumen,
};
