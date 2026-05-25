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

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ persona_id: string, fecha_ymd: string, sol_id: string, articulo_id: string, codigo_grilla: string, estado_solicitud_id: string, nivel_ocupacion_dia_id?: string | null, modo: "pendiente"|"aprobado"|"revertir" }} opts
 */
async function fanOutVisDesdeAsi(db, opts) {
  const personaId = String(opts.persona_id || "").trim();
  const ymd = String(opts.fecha_ymd || "").slice(0, 10);
  const solId = String(opts.sol_id || "").trim();
  const visId = buildVisDocumentId(personaId, ymd);
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

module.exports = { fanOutVisDesdeAsi };
