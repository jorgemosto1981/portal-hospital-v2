"use strict";

/**
 * Carga de contexto Firestore para el motor LAO (preview callable + trigger onCreate).
 * @see functions/onCall/solicitudes/simularLaoPreview.js
 */

const { COL_PERSONAS } = require("./constants");
const { civilDateInZonaToUtcAnchorMs, ymdEnZonaDesdeInstante } = require("./fechaInstitucionalBa");
const { parseYmd, anchorFromYmd } = require("./laoPreviewMotor");

const COL_SOLICITUDES = "solicitudes_articulo";
const COL_CFG_OPERADOR = "cfg_operador_comparacion";

function resolveExternosDesdePersona(persona) {
  if (!persona || typeof persona !== "object") return 0;
  const recArrayCandidates = [
    persona.antiguedad_reconocimientos,
    persona.antiguedad_externa_reconocimientos,
    persona.reconocimientos_antiguedad,
  ];
  for (const candidate of recArrayCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  const daysCandidates = [
    persona.antiguedad_reconocida_dias,
    persona.antiguedad_externa_dias,
    persona.dias_antiguedad_reconocida,
  ];
  for (const candidate of daysCandidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function ymdFromFirestoreField(v) {
  if (v == null) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      const d = v.toDate();
      const { year, month, day } = ymdEnZonaDesdeInstante(d.getTime());
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } catch {
      return null;
    }
  }
  return null;
}

function clipIntervalToWindow(inicioUtc, finUtc, t0, t1) {
  const a = Math.max(inicioUtc, t0);
  const b = Math.min(finUtc, t1);
  if (a > b) return null;
  return { inicioUtc: a, finUtc: b };
}

async function loadOperadorCodigoPorId(db) {
  const snap = await db.collection(COL_CFG_OPERADOR).get();
  /** @type {Record<string, string>} */
  const map = {};
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const code = typeof d.codigo_interno === "string" ? d.codigo_interno.trim().toUpperCase() : "";
    if (code) map[doc.id] = code;
  }
  return map;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   personaId: string,
 *   articuloId: string,
 *   versionId: string,
 *   fechaDesde: string,
 *   excludeSolicitudDocId?: string,
 * }} params
 */
async function gatherLaoAltaMotorContext(db, params) {
  const { personaId, articuloId, versionId, fechaDesde, excludeSolicitudDocId } = params;

  const versionRef = db.collection("cfg_articulos").doc(articuloId).collection("versiones").doc(versionId);
  const [personaSnap, versionSnap, solSnap, operadorMap] = await Promise.all([
    db.collection(COL_PERSONAS).doc(personaId).get(),
    versionRef.get(),
    db.collection(COL_SOLICITUDES).where("titular_persona_id", "==", personaId).get().catch(() => ({ docs: [] })),
    loadOperadorCodigoPorId(db).catch(() => ({})),
  ]);

  if (!personaSnap.exists) {
    const err = new Error("La persona no existe.");
    err.code = "not-found";
    throw err;
  }
  if (!versionSnap.exists) {
    const err = new Error("La versión del artículo no existe.");
    err.code = "not-found";
    throw err;
  }

  const persona = personaSnap.data() || {};
  const versionData = versionSnap.data() || {};
  const diasExternos = resolveExternosDesdePersona(persona);

  const hlcSnap = await db.collection("historial_laboral_cargos").where("persona_id", "==", personaId).get();
  const hlcArray = hlcSnap.docs.map((doc) => {
    const row = doc.data() || {};
    return {
      ...row,
      id: doc.id,
      fecha_inicio: row.fecha_inicio || row.fecha_desde || null,
      fecha_fin: row.fecha_fin || row.fecha_hasta || null,
      computa_antiguedad_licencias: row.computa_antiguedad_licencias === false ? false : true,
    };
  });

  const p = parseYmd(fechaDesde);
  if (!p) {
    const err = new Error("fecha_desde inválida.");
    err.code = "invalid-argument";
    throw err;
  }
  const t0 = civilDateInZonaToUtcAnchorMs(p.y, 1, 1);
  const t1 = civilDateInZonaToUtcAnchorMs(p.y, p.mo, p.d);

  /** @type {Map<string, object | null>} */
  const versionCache = new Map();
  async function versionDocFor(artId, verId) {
    const key = `${artId}|${verId}`;
    if (versionCache.has(key)) return versionCache.get(key);
    const snap = await db.collection("cfg_articulos").doc(artId).collection("versiones").doc(verId).get();
    const data = snap.exists ? snap.data() || {} : null;
    versionCache.set(key, data);
    return data;
  }

  const exclusionIntervals = [];
  const excludeId = typeof excludeSolicitudDocId === "string" ? excludeSolicitudDocId.trim() : "";
  for (const doc of solSnap.docs || []) {
    if (excludeId && doc.id === excludeId) continue;
    const s = doc.data() || {};
    const fd = ymdFromFirestoreField(s.fecha_desde ?? s.fecha_inicio ?? s.inicio_en);
    const fhRaw = s.fecha_hasta ?? s.fecha_fin ?? s.fin_en ?? s.fecha_hasta_normativa;
    const fh = ymdFromFirestoreField(fhRaw) || fd;
    if (!fd) continue;
    const a0 = anchorFromYmd(fd);
    const a1 = anchorFromYmd(fh);
    if (a0 == null || a1 == null) continue;
    const clipped = clipIntervalToWindow(a0, a1, t0, t1);
    if (!clipped) continue;

    const sArt = typeof s.articulo_id === "string" ? s.articulo_id.trim() : "";
    const sVer =
      typeof s.version_aplicada_id === "string"
        ? s.version_aplicada_id.trim()
        : typeof s.version_aplicada === "string"
          ? s.version_aplicada.trim()
          : "";
    if (!sArt || !/^art_/i.test(sArt) || !sVer || !/^ver_/i.test(sVer)) {
      continue;
    }

    const vdoc = await versionDocFor(sArt, sVer);
    if (!vdoc) continue;
    const sumaAntiguedadLao = vdoc.bloque_impacto_economico && vdoc.bloque_impacto_economico.suma_antiguedad_lao;
    if (sumaAntiguedadLao !== false) continue;

    exclusionIntervals.push(clipped);
  }

  return {
    persona,
    versionData,
    hlcArray,
    diasExternos,
    exclusionIntervals,
    operadorMap,
    solicitudesEvaluadas: (solSnap.docs || []).length,
    intervalosExcluidosTse: exclusionIntervals.length,
  };
}

module.exports = {
  gatherLaoAltaMotorContext,
  loadOperadorCodigoPorId,
  resolveExternosDesdePersona,
  ymdFromFirestoreField,
  clipIntervalToWindow,
  COL_SOLICITUDES,
};
