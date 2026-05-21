"use strict";

const { COL_VISTAS_GRILLA_MES } = require("./mdcComandosConstants");
const { buildVisDocumentId } = require("./mdcRdaDocumentIds");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ personaId: string, anio: number, mes: number }} opts
 */
async function obtenerVistaGrillaMesAgente(db, { personaId, anio, mes }) {
  const pid = String(personaId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^per_/i.test(pid) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "persona_id, anio o mes inválidos." };
  }

  const mm = String(m).padStart(2, "0");
  const fechaRef = `${y}-${mm}-01`;
  const visId = buildVisDocumentId(pid, fechaRef);
  if (!visId) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "No se pudo resolver id de vista." };
  }

  const snap = await db.collection(COL_VISTAS_GRILLA_MES).doc(visId).get();
  if (!snap.exists) {
    return {
      ok: true,
      existe: false,
      vis_id: visId,
      persona_id: pid,
      anio: y,
      mes: m,
      dias: {},
    };
  }

  const data = snap.data() || {};
  return {
    ok: true,
    existe: true,
    vis_id: visId,
    persona_id: String(data.persona_id || pid),
    anio: data.anio ?? y,
    mes: data.mes ?? m,
    dias: data.dias && typeof data.dias === "object" ? data.dias : {},
    metadata: data.metadata || null,
  };
}

module.exports = { obtenerVistaGrillaMesAgente };
