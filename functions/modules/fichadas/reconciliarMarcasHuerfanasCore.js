"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { buildVisDocumentId, diaMesKeyDesdeYmd } = require("../shared/mdcRdaDocumentIds");
const { leerVistaGrillaMesAgente } = require("../shared/grillaMesAgenteCore");
const { alinearMarcasConTeoriaEnCalendario } = require("../shared/fichadasAlineacionTeoria");
const { evaluarDeltaCeldaDia } = require("../shared/fichadasDeltaCeldaDia");
const { marcasDesdeFichadasRealesExistentes } = require("./fichadasMarcasUtils");
const { assertPeriodoNoCerrado } = require("../asistencia/asistenciaPeriodoLiquidacion");

const COL_FMH = "fichadas_marca_huerfana";
const COL_VIS = "vistas_grilla_mes_agente";
const ESTADO_PENDIENTE = "PENDIENTE_ENROLAMIENTO";
const ESTADO_RESUELTA = "RESUELTA";

/**
 * @param {string} fechaYmd
 */
function anioMesDesdeYmd(fechaYmd) {
  const ymd = String(fechaYmd || "").slice(0, 10);
  const [y, m] = ymd.split("-").map(Number);
  return { anio: y, mes: m };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} params
 * @param {string} params.reloj_id
 * @param {string} params.numero_tarjeta
 * @param {string} params.persona_id
 * @param {string} params.grupo_trabajo_id
 */
async function listarMarcasHuerfanasPendientes(db, { reloj_id, numero_tarjeta }) {
  const rel = String(reloj_id || "").trim();
  const tarjeta = String(numero_tarjeta || "").trim();
  if (!rel || !tarjeta) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "reloj_id y numero_tarjeta son obligatorios." };
  }

  const snap = await db
    .collection(COL_FMH)
    .where("reloj_id", "==", rel)
    .where("numero_tarjeta", "==", tarjeta)
    .where("estado", "==", ESTADO_PENDIENTE)
    .orderBy("fecha_ymd")
    .get();

  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { ok: true, marcas: docs };
}

const { instanteMarcaInstitucionalMs } = require("../shared/fichadasValidacionMarcas");

function fmhAMarcasCrudas(fmhDocs) {
  return fmhDocs.map((d) => {
    const fecha_ymd = String(d.fecha_ymd || "").trim();
    const hora_hm = String(d.hora_hm || "").trim();
    return {
      fmh_id: d.id,
      fecha_ymd,
      hora_hm,
      instante_ms: instanteMarcaInstitucionalMs(fecha_ymd, hora_hm),
      codigo_dispositivo: d.codigo_dispositivo || null,
    };
  });
}

/**
 * @param {Array<object>} marcas
 */
function agruparMarcasPorVisPeriodo(marcas, persona_id, grupo_trabajo_id) {
  /** @type {Map<string, { anio: number, mes: number, marcas: object[] }>} */
  const map = new Map();
  for (const m of marcas) {
    const { anio, mes } = anioMesDesdeYmd(m.fecha_ymd);
    if (!Number.isFinite(anio) || !Number.isFinite(mes)) continue;
    const visId = buildVisDocumentId(persona_id, `${anio}-${String(mes).padStart(2, "0")}-01`, grupo_trabajo_id);
    if (!map.has(visId)) map.set(visId, { anio, mes, marcas: [] });
    map.get(visId).marcas.push(m);
  }
  return map;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} params
 */
async function reconciliarMarcasHuerfanasReloj(db, params) {
  const persona_id = String(params.persona_id || "").trim();
  const grupo_trabajo_id = String(params.grupo_trabajo_id || "").trim();
  const reloj_id = String(params.reloj_id || "").trim();
  const numero_tarjeta = String(params.numero_tarjeta || "").trim();

  if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(grupo_trabajo_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "persona_id y grupo_trabajo_id inválidos." };
  }

  const listado = await listarMarcasHuerfanasPendientes(db, { reloj_id, numero_tarjeta });
  if (!listado.ok) return listado;
  if (listado.marcas.length === 0) {
    return { ok: true, procesadas: 0, vis_actualizados: 0, write_skipped: 0 };
  }

  const marcas = fmhAMarcasCrudas(listado.marcas);
  const porVis = agruparMarcasPorVisPeriodo(marcas, persona_id, grupo_trabajo_id);

  let visActualizados = 0;
  let writeSkipped = 0;
  const fmhResueltos = [];

  for (const [visId, bucket] of porVis.entries()) {
    const { anio, mes, marcas: marcasVis } = bucket;
    const fechas = [...new Set(marcasVis.map((m) => m.fecha_ymd))];

    for (const fecha_ymd of fechas) {
      await assertPeriodoNoCerrado(db, persona_id, fecha_ymd, grupo_trabajo_id);
    }

    const vista = await leerVistaGrillaMesAgente(db, {
      personaId: persona_id,
      grupoTrabajoId: grupo_trabajo_id,
      anio,
      mes,
    });
    if (vista.ok === false) {
      return { ok: false, codigo: vista.codigo || "ERROR", mensaje: vista.mensaje || "Error leyendo vis." };
    }

    const dias = vista.dias || {};
    /** @type {Record<string, object>} */
    const celdas_por_fecha = {};
    for (const f of fechas) {
      const dk = diaMesKeyDesdeYmd(f);
      celdas_por_fecha[f] = (dk && dias[dk]) || {};
      const fPlus = (() => {
        const [y, mo, d] = f.split("-").map(Number);
        const t = new Date(Date.UTC(y, mo - 1, d + 1));
        return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
      })();
      const dkPlus = diaMesKeyDesdeYmd(fPlus);
      if (dkPlus && dias[dkPlus]) celdas_por_fecha[fPlus] = dias[dkPlus];
    }

    const marcasConMerge = [];
    const seenMs = new Set();
    for (const f of fechas) {
      const dk = diaMesKeyDesdeYmd(f);
      const existentes = marcasDesdeFichadasRealesExistentes(dias[dk]?.fichadas_reales, f);
      for (const m of [...existentes, ...marcasVis.filter((x) => x.fecha_ymd === f)]) {
        const k = String(m.instante_ms);
        if (seenMs.has(k)) continue;
        seenMs.add(k);
        marcasConMerge.push(m);
      }
    }
    for (const m of marcasVis) {
      const k = String(m.instante_ms);
      if (!seenMs.has(k)) {
        seenMs.add(k);
        marcasConMerge.push(m);
      }
    }

    const alineado = alinearMarcasConTeoriaEnCalendario({
      marcas: marcasConMerge,
      celdas_por_fecha,
    });

    const txResult = await db.runTransaction(async (tx) => {
      const ref = db.collection(COL_VIS).doc(visId);
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      const diasTx = data.dias && typeof data.dias === "object" ? { ...data.dias } : {};

      let huboWrite = false;
      for (const [fecha_ymd, resultado] of Object.entries(alineado.dias || {})) {
        const diaKey = diaMesKeyDesdeYmd(fecha_ymd);
        if (!diaKey) continue;
        const celdaAntes = diasTx[diaKey] || {};
        const fichadasNuevas = resultado.fichadas_reales || [];
        const advNuevas = resultado.advertencias_fichada_abiertas || [];

        const delta = evaluarDeltaCeldaDia({
          fichadas_reales_antes: celdaAntes.fichadas_reales,
          fichadas_reales_despues: fichadasNuevas,
          advertencias_antes: celdaAntes.advertencias_fichada_abiertas,
          advertencias_despues: advNuevas,
        });

        if (!delta.tiene_delta) continue;

        huboWrite = true;
        diasTx[diaKey] = {
          ...celdaAntes,
          fichadas_reales: fichadasNuevas,
          advertencias_fichada_abiertas: advNuevas,
          resuelto_rrhh: false,
          fichadas_reales_version: FieldValue.increment(1),
        };
      }

      if (!huboWrite) {
        return { write_skipped: true };
      }

      tx.set(
        ref,
        {
          dias: diasTx,
          persona_id,
          grupo_de_trabajo_id: grupo_trabajo_id,
          anio,
          mes,
        },
        { merge: true },
      );
      return { write_skipped: false };
    });

    if (txResult.write_skipped) {
      writeSkipped += 1;
    } else {
      visActualizados += 1;
    }

    for (const m of marcasVis) {
      if (m.fmh_id) fmhResueltos.push(m.fmh_id);
    }
  }

  const batchChunks = [];
  const uniqueFmh = [...new Set(fmhResueltos)];
  for (let i = 0; i < uniqueFmh.length; i += 400) {
    batchChunks.push(uniqueFmh.slice(i, i + 400));
  }
  for (const chunk of batchChunks) {
    const batch = db.batch();
    for (const id of chunk) {
      batch.update(db.collection(COL_FMH).doc(id), {
        estado: ESTADO_RESUELTA,
        persona_id,
        resuelta_en: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return {
    ok: true,
    procesadas: listado.marcas.length,
    vis_actualizados: visActualizados,
    write_skipped: writeSkipped,
    fmh_resueltas: uniqueFmh.length,
  };
}

module.exports = {
  COL_FMH,
  ESTADO_PENDIENTE,
  listarMarcasHuerfanasPendientes,
  reconciliarMarcasHuerfanasReloj,
};
