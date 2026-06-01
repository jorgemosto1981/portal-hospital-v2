"use strict";

const { FieldValue } = require("./context");
const { COL_VISTAS_GRILLA_MES } = require("./mdcComandosConstants");
const {
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
} = require("./mdcRdaDocumentIds");
const { calcularTieneConflictoDia } = require("./mdcVisConflictoDia");

const COLOR_PENDIENTE = "#F59E0B";
const COLOR_APROBADO = "#3B82F6";
const RX_GDT = /^gdt_/i;

/**
 * Resuelve lista de gdt_* sobre los que proyectar el evento MDC en vis_*.
 * Prioridad: grupos_trabajo_involucrados_ids del snapshot sol_*; fallback ancla.
 * @param {{ grupos_trabajo_involucrados_ids?: string[], grupo_trabajo_id_ancla?: string|null, grupo_de_trabajo_id?: string|null }} opts
 * @returns {string[]}
 */
function resolverGruposFanOut(opts) {
  const fromSnapshot = Array.isArray(opts.grupos_trabajo_involucrados_ids)
    ? opts.grupos_trabajo_involucrados_ids
      .map((g) => String(g || "").trim())
      .filter((g) => RX_GDT.test(g))
    : [];
  const uniq = [...new Set(fromSnapshot)];
  if (uniq.length > 0) return uniq;

  const ancla = String(opts.grupo_trabajo_id_ancla || opts.grupo_de_trabajo_id || "").trim();
  return RX_GDT.test(ancla) ? [ancla] : [];
}

/**
 * Proyecta evento/licencia en un vis_* acotado por bounded context (gdt).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} opts
 * @param {string} opts.grupo_trabajo_id gdt_*
 */
async function fanOutVisDesdeAsiGrupo(db, opts) {
  const personaId = String(opts.persona_id || "").trim();
  const ymd = String(opts.fecha_ymd || "").slice(0, 10);
  const solId = String(opts.sol_id || "").trim();
  const gdt = String(opts.grupo_trabajo_id || "").trim();
  const visId = buildVisDocumentId(personaId, ymd, gdt);
  const diaKey = diaMesKeyDesdeYmd(ymd);
  if (!visId || !diaKey || !solId) return;

  const visRef = db.collection(COL_VISTAS_GRILLA_MES).doc(visId);
  const anio = Number(ymd.slice(0, 4));
  const mes = Number(ymd.slice(5, 7));

  if (opts.modo === "revertir") {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(visRef);
      const data = snap.exists ? snap.data() || {} : {};
      const dias = { ...(data.dias || {}) };
      const prev = dias[diaKey] || { eventos: [] };
      const eventos = (Array.isArray(prev.eventos) ? prev.eventos : []).filter(
        (e) => String(e?.solicitud_id || "") !== solId,
      );
      dias[diaKey] = {
        ...prev,
        eventos,
        tiene_conflicto: calcularTieneConflictoDia(eventos),
      };
      tx.set(
        visRef,
        {
          persona_id: personaId,
          anio,
          mes,
          grupo_de_trabajo_id: gdt,
          dias,
          metadata: {
            generado_en: FieldValue.serverTimestamp(),
            ultima_sync_mdc: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
    });
    return;
  }

  const color = opts.modo === "aprobado" ? COLOR_APROBADO : COLOR_PENDIENTE;
  const nivelOcupacion = String(opts.nivel_ocupacion_dia_id || "").trim() || null;
  const evento = {
    solicitud_id: solId,
    articulo_id: String(opts.articulo_id || "").trim(),
    codigo_grilla: String(opts.codigo_grilla || "").trim(),
    color_ui: color,
    nivel_ocupacion_dia_id: nivelOcupacion,
    estado_solicitud_id: String(opts.estado_solicitud_id || "").trim(),
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(visRef);
    const data = snap.exists ? snap.data() || {} : {};
    const dias = { ...(data.dias || {}) };
    const prev = dias[diaKey] || { eventos: [] };
    const rest = (Array.isArray(prev.eventos) ? prev.eventos : []).filter(
      (e) => String(e?.solicitud_id || "") !== solId,
    );
    const eventos = [...rest, evento];
    dias[diaKey] = {
      ...prev,
      eventos,
      tiene_conflicto: calcularTieneConflictoDia(eventos),
    };
    tx.set(
      visRef,
      {
        persona_id: personaId,
        anio,
        mes,
        grupo_de_trabajo_id: gdt,
        dias,
        metadata: {
          generado_en: FieldValue.serverTimestamp(),
          ultima_sync_mdc: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
  });
}

/**
 * Fan-out MDC: replica el evento en cada vis_* del titular (una por gdt involucrado).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ persona_id: string, fecha_ymd: string, sol_id: string, articulo_id: string, codigo_grilla: string, estado_solicitud_id: string, nivel_ocupacion_dia_id?: string | null, modo: "pendiente"|"aprobado"|"revertir", grupos_trabajo_involucrados_ids?: string[], grupo_trabajo_id_ancla?: string|null }} opts
 */
async function fanOutVisDesdeAsi(db, opts) {
  const grupos = resolverGruposFanOut(opts);
  if (grupos.length === 0) return;

  for (const gdt of grupos) {
    await fanOutVisDesdeAsiGrupo(db, { ...opts, grupo_trabajo_id: gdt });
  }
}

module.exports = { fanOutVisDesdeAsi, fanOutVisDesdeAsiGrupo, resolverGruposFanOut };
