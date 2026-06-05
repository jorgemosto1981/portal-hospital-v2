"use strict";

/**
 * Job día 5 — ventana M + M+1 (fijo/rotativo). Plan §17.2–17.2.1.
 * Distinto del cierre de liquidación (manual / Scheduler diferido).
 */

const { consultarEstadoPeriodoLiquidacion } = require("./asistenciaPeriodoLiquidacion");
const {
  leerVistaGrillaMesAgente,
  visRequiereMaterializacion,
} = require("../shared/grillaMesAgenteCore");
const { materializarTurnoMesBatch } = require("./rdaTurnoTeoricoWorker");

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const TIPOS_JOB = new Set(["fijo", "rotativo"]);
const CHUNK_SIZE = 5;

/** Motivos que implican rematerializar M en día 5 si ocurrieron después de la última sync. */
const MOTIVOS_CAMBIO_BASE = new Set([
  "materializar_rango",
  "hlg_alta",
  "hlg_deshabilitar",
  "purge_hlg",
  "purge_capa_teorica",
  "regimen",
  "feriado",
  "feriado_institucional",
  "rematerializar",
  "rematerializar_regimen",
  "rematerializar_feriado",
  "materializar_grupo_mes",
  "job_dia5_m_condicional",
  "job_dia5_m_plus_1",
]);

/**
 * @param {unknown} ts Firestore Timestamp | Date | string
 * @returns {number|null}
 */
function tsToMs(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  const d = new Date(String(ts));
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

/**
 * @param {string} ymd
 * @returns {{ anioM: number, mesM: number, anioM1: number, mesM1: number, dia: number }}
 */
function ventanaMesesDesdeReferencia(ymd) {
  const y = Number(String(ymd).slice(0, 4));
  const m = Number(String(ymd).slice(5, 7));
  const dia = Number(String(ymd).slice(8, 10));
  const mesM1 = m === 12 ? 1 : m + 1;
  const anioM1 = m === 12 ? y + 1 : y;
  return { anioM: y, mesM: m, anioM1, mesM1, dia };
}

/**
 * @param {string} fechaInicio
 * @param {string|null|undefined} fechaFin
 * @param {number} anio
 * @param {number} mes
 */
function hlgVigenteEnMes(fechaInicio, fechaFin, anio, mes) {
  const mm = String(mes).padStart(2, "0");
  const ultimo = new Date(anio, mes, 0).getDate();
  const primerDia = `${anio}-${mm}-01`;
  const ultimoDia = `${anio}-${mm}-${String(ultimo).padStart(2, "0")}`;
  const fi = String(fechaInicio || "").slice(0, 10);
  const ff = fechaFin ? String(fechaFin).slice(0, 10) : "9999-12-31";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fi)) return false;
  return fi <= ultimoDia && ff >= primerDia;
}

/**
 * @param {Record<string, unknown>|null|undefined} metadata
 */
function cambioBasePosteriorASync(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  const syncMs = tsToMs(metadata.ultima_sync_teorica);
  const motivoMs = tsToMs(metadata.ultimo_motivo_en);
  if (!motivoMs) return false;
  if (syncMs && motivoMs <= syncMs) return false;
  const motivo = String(metadata.ultimo_motivo || "").trim().toLowerCase();
  if (!motivo) return motivoMs > (syncMs || 0);
  if (MOTIVOS_CAMBIO_BASE.has(motivo)) return true;
  return motivo.startsWith("hlg_") || motivo.startsWith("purge") || motivo.includes("regimen");
}

/**
 * @param {{ existe?: boolean, dias?: Record<string, unknown>, metadata?: Record<string, unknown>|null }} vista
 * @param {'m_plus_1'|'m_actual'} rolMes
 */
function decidirAccionMesDia5(vista, rolMes) {
  const meta = vista.metadata && typeof vista.metadata === "object" ? vista.metadata : null;
  const requiere = visRequiereMaterializacion(vista);

  if (rolMes === "m_plus_1") {
    if (!requiere) {
      return { accion: "omitir", motivo: "m_plus_1_ya_materializado" };
    }
    return { accion: "materializar", motivo: "job_dia5_m_plus_1" };
  }

  if (requiere) {
    return { accion: "materializar", motivo: "job_dia5_m_condicional" };
  }
  if (cambioBasePosteriorASync(meta)) {
    return { accion: "materializar", motivo: "job_dia5_m_cambio_base" };
  }
  return { accion: "omitir", motivo: "m_sin_cambio_base" };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarAsignacionesFijoRotativo(db, { refYmd, soloPersonaId, soloGrupoId }) {
  const snap = await db.collection(COL_HLG).where("activo", "==", true).get();
  const { anioM, mesM, anioM1, mesM1 } = ventanaMesesDesdeReferencia(refYmd);

  const regimenCache = new Map();
  /** @type {Map<string, { personaId: string, grupoId: string, regimenId: string, fechaInicio: string, fechaFin: string|null }>} */
  const porPar = new Map();

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const personaId = String(d.persona_id || "").trim();
    const grupoId = String(d.grupo_de_trabajo_id || "").trim();
    const regimenId = String(d.regimen_horario_id || "").trim();
    if (!/^per_/i.test(personaId) || !/^gdt_/i.test(grupoId) || !regimenId) continue;
    if (soloPersonaId && personaId !== soloPersonaId) continue;
    if (soloGrupoId && grupoId !== soloGrupoId) continue;

    const fi = String(d.fecha_inicio || "").slice(0, 10);
    const ff = d.fecha_fin ? String(d.fecha_fin).slice(0, 10) : null;
    const vigenteM = hlgVigenteEnMes(fi, ff, anioM, mesM);
    const vigenteM1 = hlgVigenteEnMes(fi, ff, anioM1, mesM1);
    if (!vigenteM && !vigenteM1) continue;

    if (!regimenCache.has(regimenId)) {
      const regSnap = await db.collection(COL_REGIMEN).doc(regimenId).get();
      regimenCache.set(regimenId, regSnap.exists ? regSnap.data() : null);
    }
    const reg = regimenCache.get(regimenId);
    const tipo = String(reg?.tipo_patron || "").trim();
    if (!TIPOS_JOB.has(tipo)) continue;

    const key = `${personaId}|${grupoId}`;
    const prev = porPar.get(key);
    const row = { personaId, grupoId, regimenId, fechaInicio: fi, fechaFin: ff };
    if (!prev || fi > prev.fechaInicio) porPar.set(key, row);
  }

  return [...porPar.values()];
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   fechaReferenciaYmd?: string,
 *   dryRun?: boolean,
 *   force?: boolean,
 *   soloPersonaId?: string|null,
 *   soloGrupoId?: string|null,
 *   origen?: string,
 * }} [options]
 */
async function ejecutarJobMaterializacionVentanaDia5(db, options = {}) {
  const refYmd = String(options.fechaReferenciaYmd || "").slice(0, 10)
    || new Date().toISOString().slice(0, 10);
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const { anioM, mesM, anioM1, mesM1, dia } = ventanaMesesDesdeReferencia(refYmd);

  if (dia !== 5 && !force) {
    return {
      ok: false,
      codigo: "NO_ES_DIA_5",
      mensaje: "El job ventana día 5 solo corre el día 5 del mes (usar force=true en callable RRHH).",
      fecha_referencia: refYmd,
    };
  }

  const asignaciones = await listarAsignacionesFijoRotativo(db, {
    refYmd,
    soloPersonaId: options.soloPersonaId || null,
    soloGrupoId: options.soloGrupoId || null,
  });

  const resumen = {
    fecha_referencia: refYmd,
    ventana: { mes_m: { anio: anioM, mes: mesM }, mes_m_plus_1: { anio: anioM1, mes: mesM1 } },
    origen: options.origen || "job",
    dry_run: dryRun,
    asignaciones_evaluadas: asignaciones.length,
    omitidos: 0,
    materializados: 0,
    errores: [],
    muestra: [],
  };

  const mesesEval = [
    { anio: anioM1, mes: mesM1, rol: "m_plus_1" },
    { anio: anioM, mes: mesM, rol: "m_actual" },
  ];

  for (let i = 0; i < asignaciones.length; i += CHUNK_SIZE) {
    const chunk = asignaciones.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (asig) => {
        for (const mesJob of mesesEval) {
          if (!hlgVigenteEnMes(asig.fechaInicio, asig.fechaFin, mesJob.anio, mesJob.mes)) continue;

          const probeYmd = `${mesJob.anio}-${String(mesJob.mes).padStart(2, "0")}-01`;
          const { cerrado } = await consultarEstadoPeriodoLiquidacion(
            db,
            asig.personaId,
            probeYmd,
            asig.grupoId,
          );
          if (cerrado) {
            resumen.omitidos += 1;
            if (resumen.muestra.length < 40) {
              resumen.muestra.push({
                persona_id: asig.personaId,
                grupo_id: asig.grupoId,
                anio: mesJob.anio,
                mes: mesJob.mes,
                accion: "omitir",
                motivo: "periodo_cerrado",
              });
            }
            continue;
          }

          const vista = await leerVistaGrillaMesAgente(db, {
            personaId: asig.personaId,
            grupoTrabajoId: asig.grupoId,
            anio: mesJob.anio,
            mes: mesJob.mes,
          });
          const decision = decidirAccionMesDia5(vista, mesJob.rol);

          if (decision.accion === "omitir") {
            resumen.omitidos += 1;
            if (resumen.muestra.length < 40) {
              resumen.muestra.push({
                persona_id: asig.personaId,
                grupo_id: asig.grupoId,
                anio: mesJob.anio,
                mes: mesJob.mes,
                ...decision,
              });
            }
            continue;
          }

          if (dryRun) {
            resumen.materializados += 1;
            if (resumen.muestra.length < 40) {
              resumen.muestra.push({
                persona_id: asig.personaId,
                grupo_id: asig.grupoId,
                anio: mesJob.anio,
                mes: mesJob.mes,
                accion: "materializar",
                motivo: decision.motivo,
                dry_run: true,
              });
            }
            continue;
          }

          const mm = String(mesJob.mes).padStart(2, "0");
          const ultimo = new Date(mesJob.anio, mesJob.mes, 0).getDate();
          const primerDia = `${mesJob.anio}-${mm}-01`;
          const ultimoDia = `${mesJob.anio}-${mm}-${String(ultimo).padStart(2, "0")}`;

          try {
            const batch = await materializarTurnoMesBatch({
              personaId: asig.personaId,
              grupoId: asig.grupoId,
              anio: mesJob.anio,
              mes: mesJob.mes,
              fechaDesdeYmd: primerDia,
              fechaHastaYmd: ultimoDia,
              materializacionMotivo: decision.motivo,
              materializacionRangoDesde: primerDia,
              materializacionRangoHasta: ultimoDia,
            });
            if (batch.ok) {
              resumen.materializados += 1;
            } else {
              resumen.errores.push({
                persona_id: asig.personaId,
                grupo_id: asig.grupoId,
                periodo: `${mesJob.anio}-${mm}`,
                error: batch.error || "materializar_fallo",
              });
            }
          } catch (e) {
            resumen.errores.push({
              persona_id: asig.personaId,
              grupo_id: asig.grupoId,
              periodo: `${mesJob.anio}-${mm}`,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }),
    );
  }

  return {
    ok: resumen.errores.length === 0,
    ...resumen,
  };
}

module.exports = {
  MOTIVOS_CAMBIO_BASE,
  ventanaMesesDesdeReferencia,
  hlgVigenteEnMes,
  cambioBasePosteriorASync,
  decidirAccionMesDia5,
  listarAsignacionesFijoRotativo,
  ejecutarJobMaterializacionVentanaDia5,
};
