"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { buildPlanMetaPayload } = require("./planTurnoServicioMeta");

const COL_PLANES = "planes_turno_servicio";
const MAX_OPS_TRANSACCION = 450;

/**
 * @param {string} periodoYm "YYYY-MM"
 * @param {string} corteYmd "YYYY-MM-DD"
 */
function compararPeriodoConCorte(periodoYm, corteYmd) {
  const p = String(periodoYm || "").trim();
  const c = String(corteYmd || "").trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(p) || !/^\d{4}-\d{2}$/.test(c)) return "desconocido";
  if (p < c) return "anterior";
  if (p > c) return "posterior";
  return "mes_corte";
}

/**
 * @param {Record<string, object>} dias
 * @param {string} corteYmd inclusive — se conservan días <= corte
 */
function truncarDiasDesdeCorte(dias, corteYmd) {
  const corte = String(corteYmd || "").trim();
  const out = {};
  for (const [ymd, cel] of Object.entries(dias || {})) {
    if (String(ymd) <= corte) out[ymd] = cel;
  }
  return out;
}

/**
 * @param {object[]} agentes
 * @param {{ hlgId: string, personaId?: string }} filtro
 */
function filtrarAgentePorHlg(agentes, { hlgId, personaId }) {
  const hid = String(hlgId || "").trim();
  const pid = personaId ? String(personaId).trim() : "";
  const before = (agentes || []).length;
  const next = (agentes || []).filter((ag) => {
    const agH = String(ag?.hlg_id || "").trim();
    if (hid && agH === hid) return false;
    if (!hid && pid && String(ag?.persona_id || "").trim() === pid) return false;
    return true;
  });
  return { next, removed: before - next.length };
}

/**
 * Aplica purga sobre un documento de plan en memoria.
 * @returns {{ changed: boolean, agentes: object[], eliminado?: boolean, estado?: string, meta: object }}
 */
function aplicarPurgaAgenteEnPlan(plan, { hlgId, personaId, modo, fechaCorteYmd, motivoPurga }) {
  const p = plan || {};
  const agentes = Array.isArray(p.agentes) ? p.agentes : [];
  const hid = String(hlgId || "").trim();
  const pid = String(personaId || "").trim();
  const idx = agentes.findIndex(
    (ag) => String(ag?.hlg_id || "").trim() === hid || (pid && String(ag?.persona_id || "").trim() === pid),
  );
  if (idx < 0) {
    return { changed: false, agentes, meta: buildPlanMetaPayload({ agentes, plan_rol: p.plan_rol, plan_padre_id: p.plan_padre_id }) };
  }

  const modoEfectivo = modo === "cierre_hlg" && fechaCorteYmd ? "cierre_hlg" : "anulacion";
  let nextAgentes = [...agentes];

  if (modoEfectivo === "cierre_hlg" && p.tipo_plan === "mensual" && p.periodo) {
    const rel = compararPeriodoConCorte(p.periodo, fechaCorteYmd);
    if (rel === "anterior") {
      return { changed: false, agentes, meta: buildPlanMetaPayload({ agentes, plan_rol: p.plan_rol, plan_padre_id: p.plan_padre_id }) };
    }
    if (rel === "posterior") {
      const { next, removed } = filtrarAgentePorHlg(agentes, { hlgId: hid, personaId: pid });
      if (removed === 0) return { changed: false, agentes, meta: buildPlanMetaPayload({ agentes, plan_rol: p.plan_rol, plan_padre_id: p.plan_padre_id }) };
      nextAgentes = next;
    } else {
      const ag = { ...agentes[idx] };
      ag.dias = truncarDiasDesdeCorte(ag.dias, fechaCorteYmd);
      nextAgentes = [...agentes];
      nextAgentes[idx] = ag;
    }
  } else {
    const { next, removed } = filtrarAgentePorHlg(agentes, { hlgId: hid, personaId: pid });
    if (removed === 0) {
      return { changed: false, agentes, meta: buildPlanMetaPayload({ agentes, plan_rol: p.plan_rol, plan_padre_id: p.plan_padre_id }) };
    }
    nextAgentes = next;
  }

  const meta = buildPlanMetaPayload({
    agentes: nextAgentes,
    plan_rol: p.plan_rol,
    plan_padre_id: p.plan_padre_id,
  });
  const payload = {
    changed: true,
    agentes: nextAgentes,
    meta,
    purga_hlg_ultima: {
      hlg_id: hid,
      motivo: motivoPurga || null,
      en: new Date().toISOString(),
    },
  };

  if (nextAgentes.length === 0 && p.eliminado !== true) {
    payload.eliminado = true;
    payload.eliminado_motivo = motivoPurga || "purga_hlg_sin_agentes";
    if (p.estado === "HABILITADO") {
      payload.estado = "CERRADO";
    }
  }

  return payload;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} hlgId
 */
async function buscarPlanesConHlgId(db, hlgId) {
  const hid = String(hlgId || "").trim();
  if (!hid) return [];
  const snap = await db
    .collection(COL_PLANES)
    .where("agentes_hlg_ids", "array-contains", hid)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((p) => p.eliminado !== true);
}

/**
 * Transacción: actualiza todos los planes que referencian hlg_id. Falla antes de tocar HLg si excede límite u op falla.
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function ejecutarPurgaAgentePlanesPorHlg(db, opts) {
  const hlgId = String(opts?.hlgId || "").trim();
  const personaId = String(opts?.personaId || "").trim();
  const modo = opts?.modo === "cierre_hlg" ? "cierre_hlg" : "anulacion";
  const fechaCorteYmd = opts?.fechaCorteYmd || null;
  const motivoPurga = opts?.motivoPurga || "purga_hlg";

  if (!hlgId) {
    return { ok: false, code: "PLT-PURGE-001", message: "[PLT-PURGE-001] hlg_id requerido." };
  }

  const planes = await buscarPlanesConHlgId(db, hlgId);
  const updates = [];
  for (const plan of planes) {
    const result = aplicarPurgaAgenteEnPlan(plan, {
      hlgId,
      personaId,
      modo,
      fechaCorteYmd,
      motivoPurga,
    });
    if (!result.changed) continue;
    updates.push({ id: plan.id, ref: plan.ref, result });
  }

  if (updates.length > MAX_OPS_TRANSACCION) {
    return {
      ok: false,
      code: "PLT-PURGE-002",
      message: `[PLT-PURGE-002] Demasiados planes afectados (${updates.length}). Límite ${MAX_OPS_TRANSACCION}.`,
      plan_ids: updates.map((u) => u.id),
    };
  }

  if (updates.length === 0) {
    return { ok: true, planes_actualizados: 0, plan_ids: [] };
  }

  await db.runTransaction(async (tx) => {
    for (const u of updates) {
      const snap = await tx.get(u.ref);
      if (!snap.exists) continue;
      const fresh = snap.data() || {};
      const recheck = aplicarPurgaAgenteEnPlan(
        { ...fresh, id: u.id },
        { hlgId, personaId, modo, fechaCorteYmd, motivoPurga },
      );
      if (!recheck.changed) continue;
      const patch = {
        agentes: recheck.agentes,
        ...recheck.meta,
        actualizado_en: FieldValue.serverTimestamp(),
        purga_hlg_ultima: recheck.purga_hlg_ultima,
      };
      if (recheck.eliminado === true) {
        patch.eliminado = true;
        patch.eliminado_motivo = recheck.eliminado_motivo;
        if (recheck.estado) patch.estado = recheck.estado;
      }
      tx.set(u.ref, patch, { merge: true });
    }
  });

  return {
    ok: true,
    planes_actualizados: updates.length,
    plan_ids: updates.map((u) => u.id),
  };
}

module.exports = {
  COL_PLANES,
  MAX_OPS_TRANSACCION,
  compararPeriodoConCorte,
  truncarDiasDesdeCorte,
  filtrarAgentePorHlg,
  aplicarPurgaAgenteEnPlan,
  buscarPlanesConHlgId,
  ejecutarPurgaAgentePlanesPorHlg,
};
