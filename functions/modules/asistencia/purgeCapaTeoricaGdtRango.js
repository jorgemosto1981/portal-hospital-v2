"use strict";

function purgeMetadataNow() {
  return new Date().toISOString();
}
const {
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
  iterarYmdInclusive,
} = require("../shared/mdcRdaDocumentIds");

const COL_ASISTENCIA = "asistencia_diaria";
const COL_VIS = "vistas_grilla_mes_agente";
const COL_HLG = "historial_laboral_grupos";
const MAX_BATCH_OPS = 450;

/**
 * @param {string} ymd
 * @param {number} deltaDays
 * @returns {string}
 */
function ymdAddDays(ymd, deltaDays) {
  const base = String(ymd || "").slice(0, 10);
  const d = new Date(`${base}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return base;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fin del mes siguiente al de referencia (ventana M+M+1).
 * @param {string} refYmd
 */
function ymdFinMesSiguiente(refYmd) {
  const base = String(refYmd || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!m) return base;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const ultimo = new Date(Date.UTC(y, mo + 1, 0));
  const yy = ultimo.getUTCFullYear();
  const mm = String(ultimo.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ultimo.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Tope de purge tras deshabilitar HLg: ventana M+M+1, sin pisar otra HLg activa del mismo gdt.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ personaId: string; gdt: string; desdeCorteYmd: string; excludeHlgId?: string }} opts
 * @returns {Promise<string>}
 */
async function resolveHastaPurgeTrasDeshabilitarHlg(db, { personaId, gdt, desdeCorteYmd, excludeHlgId }) {
  const pid = String(personaId || "").trim();
  const gdtId = String(gdt || "").trim();
  const desde = String(desdeCorteYmd || "").slice(0, 10);
  let hasta = ymdFinMesSiguiente(desde);
  if (!/^per_/i.test(pid) || !/^gdt_/i.test(gdtId) || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return hasta;
  }

  const snap = await db
    .collection(COL_HLG)
    .where("persona_id", "==", pid)
    .where("grupo_de_trabajo_id", "==", gdtId)
    .get();

  let siguienteInicio = null;
  for (const doc of snap.docs) {
    if (excludeHlgId && doc.id === excludeHlgId) continue;
    const row = doc.data() || {};
    if (row.activo === false) continue;
    const ini = String(row.fecha_inicio || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ini) || ini <= desde) continue;
    if (!siguienteInicio || ini < siguienteInicio) siguienteInicio = ini;
  }

  if (siguienteInicio) {
    const hastaAntesSucesor = ymdAddDays(siguienteInicio, -1);
    if (hastaAntesSucesor < hasta) hasta = hastaAntesSucesor;
  }
  if (hasta < desde) return desde;
  return hasta;
}

/**
 * Elimina capa teórica scoped (solo capa 1) desde `desdeYmd` hasta `hastaYmd` inclusive.
 * No toca overrides ni eventos MDC en vis_*.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ personaId: string; gdt: string; desdeYmd: string; hastaYmd: string; motivo?: string }} params
 */
async function purgeCapaTeoricaGdtRango(db, { personaId, gdt, desdeYmd, hastaYmd, motivo }) {
  const pid = String(personaId || "").trim();
  const gdtId = String(gdt || "").trim();
  const desde = String(desdeYmd || "").slice(0, 10);
  const hasta = String(hastaYmd || desde).slice(0, 10);
  if (!/^per_/i.test(pid) || !/^gdt_/i.test(gdtId)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", dias_purge: 0 };
  }
  const dias = iterarYmdInclusive(desde, hasta);
  if (dias.length === 0) {
    return { ok: true, dias_purge: 0, motivo: motivo || null };
  }

  let batch = db.batch();
  let ops = 0;
  let diasPurge = 0;

  const visUpdatesByDoc = new Map();

  for (const ymd of dias) {
    const asiId = buildAsiDocumentId(pid, ymd);
    if (asiId) {
      const asiRef = db.collection(COL_ASISTENCIA).doc(asiId);
      const asiSnap = await asiRef.get();
      if (asiSnap.exists) {
        const capaPorGrupo = { ...(asiSnap.data().capa_teorica_por_grupo || {}) };
        if (Object.hasOwn(capaPorGrupo, gdtId)) {
          delete capaPorGrupo[gdtId];
          batch.update(asiRef, {
            capa_teorica_por_grupo: capaPorGrupo,
            "metadata.ultimo_purge_teorico": purgeMetadataNow(),
            "metadata.ultimo_purge_motivo": motivo || "purge_capa_teorica_gdt",
          });
          ops += 1;
          diasPurge += 1;
        }
      }
    }

    let visId;
    try {
      visId = buildVisDocumentId(pid, ymd, gdtId);
    } catch {
      visId = null;
    }
    if (visId) {
      const diaKey = diaMesKeyDesdeYmd(ymd);
      if (!visUpdatesByDoc.has(visId)) visUpdatesByDoc.set(visId, {});
      const patch = visUpdatesByDoc.get(visId);
      patch[`dias.${diaKey}.rda_turno_id`] = null;
      patch[`dias.${diaKey}.rda_ingreso`] = null;
      patch[`dias.${diaKey}.rda_egreso`] = null;
      patch[`dias.${diaKey}.tipo_dia`] = "no_laborable";
      patch[`dias.${diaKey}.es_franco`] = false;
      patch[`dias.${diaKey}.segmentos`] = null;
    }

    if (ops >= MAX_BATCH_OPS) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  for (const [visId, patch] of visUpdatesByDoc) {
    const visRef = db.collection(COL_VIS).doc(visId);
    const visSnap = await visRef.get();
    if (!visSnap.exists) continue;
    batch.update(visRef, {
      ...patch,
      "metadata.ultima_sync_teorica": purgeMetadataNow(),
      "metadata.ultimo_purge_motivo": motivo || "purge_capa_teorica_gdt",
      "metadata.ultimo_purge_en": purgeMetadataNow(),
      "metadata.ultimo_rango_purged": { desde, hasta },
    });
    ops += 1;
    if (ops >= MAX_BATCH_OPS) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  return { ok: true, dias_purge: diasPurge, motivo: motivo || null };
}

module.exports = {
  purgeCapaTeoricaGdtRango,
  resolveHastaPurgeTrasDeshabilitarHlg,
  ymdAddDays,
  ymdFinMesSiguiente,
};
