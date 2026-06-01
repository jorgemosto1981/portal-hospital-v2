/**
 * Re-materializa vis_* (turno teórico) para todas las personas con HLG activo.
 * Mes actual + mes siguiente. One-shot, idempotente.
 *
 * Uso:
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/rematerializar-vis-turno-teorico.mjs
 */

import { assertFirestoreSeedAllowed } from "./seed-v2/guard-no-seed.mjs";
assertFirestoreSeedAllowed("rematerializar-vis-turno-teorico");

import { getAdminDb } from "./lib/firestoreAdminBootstrap.mjs";

const db = getAdminDb();

const COL_HLG = "historial_laboral_grupos";
const COL_GDT = "grupos_de_trabajo";
const COL_REGIMEN = "cfg_regimen_horario";
const COL_ASISTENCIA = "asistencia_diaria";
const COL_PLANES = "planes_turno_servicio";
const COL_VIS = "vistas_grilla_mes_agente";

function diasDelMes(anio, mes) {
  const totalDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const out = [];
  const prefix = `${anio}-${String(mes).padStart(2, "0")}`;
  for (let d = 1; d <= totalDias; d++) {
    out.push(`${prefix}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

function buildAsiDocumentId(personaId, fechaYmd) {
  const pid = String(personaId || "").replace(/^per_/i, "");
  const ymd = String(fechaYmd || "").replace(/-/g, "");
  return `asi_per_${pid}_${ymd}`;
}

function buildVisDocumentId(personaId, anio, mes) {
  const pid = String(personaId || "").replace(/^per_/i, "");
  const mm = String(mes).padStart(2, "0");
  return `vis_${anio}_${mm}_per_${pid}`;
}

function diaMesKey(fechaYmd) {
  return String(fechaYmd || "").slice(8, 10);
}

const now = new Date();
const meses = [
  { anio: now.getFullYear(), mes: now.getMonth() + 1 },
];
const nextMonth = now.getMonth() + 2;
if (nextMonth <= 12) {
  meses.push({ anio: now.getFullYear(), mes: nextMonth });
} else {
  meses.push({ anio: now.getFullYear() + 1, mes: 1 });
}

console.log(`Re-materialización de vis_* — meses: ${meses.map((m) => `${m.anio}-${String(m.mes).padStart(2, "0")}`).join(", ")}`);

const hlgSnap = await db.collection(COL_HLG).where("activo", "==", true).get();
console.log(`HLGs activos: ${hlgSnap.size}`);

const personasSet = new Set();
for (const doc of hlgSnap.docs) {
  const pid = String((doc.data() || {}).persona_id || "").trim();
  if (/^per_/i.test(pid)) personasSet.add(pid);
}
const personas = [...personasSet];
console.log(`Personas únicas: ${personas.length}`);

const etiquetaCache = new Map();
async function resolverEtiqueta(gdtId) {
  if (!gdtId) return "";
  if (etiquetaCache.has(gdtId)) return etiquetaCache.get(gdtId);
  const snap = await db.collection(COL_GDT).doc(gdtId).get();
  const d = snap.exists ? (snap.data() || {}) : {};
  const label = String(d.nombre || d.codigo || d.titulo || "").trim() || gdtId;
  etiquetaCache.set(gdtId, label);
  return label;
}

let totalProcesados = 0;
let totalErrores = 0;

for (const persona of personas) {
  for (const { anio, mes } of meses) {
    try {
      const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
      const dias = diasDelMes(anio, mes);
      const primerDia = dias[0];
      const ultimoDia = dias[dias.length - 1];

      const pHlgSnap = await db.collection(COL_HLG)
        .where("persona_id", "==", persona)
        .where("activo", "==", true)
        .get();

      const hlgs = [];
      for (const doc of pHlgSnap.docs) {
        const d = doc.data();
        const fi = d.fecha_inicio || "";
        const ff = d.fecha_fin || "";
        if (fi && fi > ultimoDia) continue;
        if (ff && ff < primerDia) continue;
        hlgs.push({ id: doc.id, ...d });
      }
      if (hlgs.length === 0) continue;

      const regCache = new Map();
      const hlgContextos = [];
      for (const hlg of hlgs) {
        if (!hlg.regimen_horario_id) continue;
        let regimen;
        if (regCache.has(hlg.regimen_horario_id)) {
          regimen = regCache.get(hlg.regimen_horario_id);
        } else {
          const snap = await db.collection(COL_REGIMEN).doc(hlg.regimen_horario_id).get();
          if (!snap.exists) continue;
          regimen = snap.data();
          regCache.set(hlg.regimen_horario_id, regimen);
        }

        let plan = null;
        if (regimen.tipo_patron === "planificado" && hlg.grupo_de_trabajo_id) {
          const planSnap = await db.collection(COL_PLANES)
            .where("grupo_id", "==", hlg.grupo_de_trabajo_id)
            .where("periodo", "==", periodoId)
            .where("estado", "==", "HABILITADO")
            .limit(1)
            .get();
          if (!planSnap.empty) {
            plan = { planId: planSnap.docs[0].id, plan: planSnap.docs[0].data() };
          }
        }
        if (hlg.grupo_de_trabajo_id) {
          await resolverEtiqueta(hlg.grupo_de_trabajo_id);
        }
        hlgContextos.push({ hlg, regimen, plan });
      }
      if (hlgContextos.length === 0) continue;

      const visDias = {};
      for (const fechaYmd of dias) {
        let mejorHlg = null;
        let mejorTipo = null;

        for (const { hlg, regimen, plan } of hlgContextos) {
          const fi = hlg.fecha_inicio || "";
          const ff = hlg.fecha_fin || "";
          if (fi && fi > fechaYmd) continue;
          if (ff && ff < fechaYmd) continue;

          let tipoDia = "franco";
          let turnoId = null;
          if (regimen.tipo_patron === "fijo") {
            const dow = new Date(fechaYmd + "T12:00:00Z").getUTCDay();
            const isoDay = dow === 0 ? 7 : dow;
            const turno = (regimen.turnos_semana || []).find((t) => (t.dia_semana || t.dia) === isoDay);
            tipoDia = turno ? (turno.tipo_dia || "laborable") : "franco";
            turnoId = turno?.turno_id || turno?.ingreso || null;
          } else if (regimen.tipo_patron === "rotativo") {
            const ancla = hlg.regimen_fecha_ancla;
            if (ancla) {
              const anclaMs = new Date(ancla + "T12:00:00Z").getTime();
              const fechaMs = new Date(fechaYmd + "T12:00:00Z").getTime();
              const diff = Math.round((fechaMs - anclaMs) / 86400000);
              const cicloLen = regimen.ciclo_total || (regimen.ciclo || []).length;
              if (cicloLen > 0) {
                const posRaw = ((diff % cicloLen) + cicloLen) % cicloLen;
                const posConf = (regimen.ciclo || []).find((p) => p.posicion === posRaw + 1);
                tipoDia = posConf?.tipo_dia || "franco";
                turnoId = posConf?.turno?.turno_id || posConf?.turno?.ingreso || null;
              }
            }
          } else if (regimen.tipo_patron === "planificado" && plan) {
            const agente = (plan.plan.agentes || []).find((a) => a.persona_id === persona);
            const asig = agente?.dias?.[fechaYmd];
            if (asig && asig.tipo_dia !== "franco") {
              tipoDia = asig.tipo_dia || "laborable";
              turnoId = asig.turno_id || null;
            }
          }

          const esLaboral = tipoDia === "laborable" || tipoDia === "guardia";
          if (esLaboral && !mejorHlg) {
            mejorHlg = hlg;
            mejorTipo = { tipoDia, turnoId };
          }
          if (!mejorHlg) {
            mejorHlg = hlg;
            mejorTipo = { tipoDia, turnoId };
          }
        }

        if (!mejorHlg) continue;
        const diaKey = diaMesKey(fechaYmd);
        const esFranco = mejorTipo.tipoDia === "franco" || mejorTipo.tipoDia === "no_laborable";
        const gdtId = mejorHlg.grupo_de_trabajo_id || null;
        visDias[`dias.${diaKey}.rda_turno_id`] = esFranco ? null : (mejorTipo.turnoId || mejorTipo.tipoDia);
        visDias[`dias.${diaKey}.es_franco`] = esFranco;
        visDias[`dias.${diaKey}.grupo_de_trabajo_id`] = gdtId;
        visDias[`dias.${diaKey}.etiqueta_grupo_corta`] = gdtId ? (etiquetaCache.get(gdtId) || gdtId) : null;
      }

      if (Object.keys(visDias).length === 0) continue;

      const { FieldValue } = await import("firebase-admin/firestore");
      const visDocId = buildVisDocumentId(persona, anio, mes);
      const visRef = db.collection(COL_VIS).doc(visDocId);

      try {
        await visRef.update({
          ...visDias,
          "metadata.ultima_sync_teorica": FieldValue.serverTimestamp(),
        });
      } catch (e) {
        if (e.code === 5 || (e.message && e.message.includes("NOT_FOUND"))) {
          const nestedDias = {};
          for (const [key, value] of Object.entries(visDias)) {
            const parts = key.split(".");
            if (!nestedDias[parts[1]]) nestedDias[parts[1]] = {};
            nestedDias[parts[1]][parts[2]] = value;
          }
          await visRef.set({
            persona_id: persona,
            anio,
            mes,
            dias: nestedDias,
            metadata: { ultima_sync_teorica: FieldValue.serverTimestamp() },
          });
        } else {
          throw e;
        }
      }

      totalProcesados++;
    } catch (err) {
      totalErrores++;
      console.error(`Error ${persona} ${anio}-${mes}:`, err.message);
    }
  }
}

console.log(`\nCompletado. Procesados: ${totalProcesados}, errores: ${totalErrores}`);
process.exit(totalErrores > 0 ? 1 : 0);
