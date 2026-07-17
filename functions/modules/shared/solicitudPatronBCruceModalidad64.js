"use strict";

/**
 * Cruce Patrón B Art. 64: alta unificada descuenta 64-A;
 * si el jefe autoriza sin goce, revierte bolsa A y debita bolsa B (distintas).
 */

const { FieldValue } = require("./context");
const {
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
} = require("./etapa1RuntimeConfig");
const { saldoAnualDocId, pickBolsaParaConsumo } = require("./laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";
const COL_CFG_ART = "cfg_articulos";
const COL_SOL = "solicitudes_articulo";

/** Estados que ocupan el cupo mensual (incluye pendientes). Rechazada/cancelada liberan cupo. */
const ESTADOS_CUENTAN_FRECUENCIA_MES_64 = new Set([
  "cfg_esa_borrador",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
  "cfg_esa_aprobada",
  "cfg_esa_aprobada_pendiente_aplicacion",
]);

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @returns {Promise<string|null>}
 */
async function resolveVersionPublicadaId(db, articuloId) {
  const id = String(articuloId || "").trim();
  if (!/^art_/i.test(id)) return null;
  const snap = await db
    .collection(COL_CFG_ART)
    .doc(id)
    .collection("versiones")
    .where("estado_version_id", "==", "cfg_est_ver_publicada")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Cuenta trámites del mes para un art_* (cualquier estado “vivo”).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {string} articuloId
 * @param {number} anio
 * @param {number} mes
 * @param {string} [excludeSolId]
 */
async function countSolicitudesMesArticulo64(db, personaId, articuloId, anio, mes, excludeSolId = "") {
  const art = String(articuloId || "").trim();
  if (!/^art_/i.test(art) || !/^per_/i.test(String(personaId || ""))) return 0;
  const snap = await db
    .collection(COL_SOL)
    .where("titular_persona_id", "==", personaId)
    .where("articulo_id", "==", art)
    .get();
  let n = 0;
  for (const doc of snap.docs) {
    if (excludeSolId && doc.id === excludeSolId) continue;
    const s = doc.data() || {};
    const fd = typeof s.fecha_desde === "string" ? s.fecha_desde.slice(0, 10) : "";
    const m = /^(\d{4})-(\d{2})-/.exec(fd);
    if (!m) continue;
    if (Number(m[1]) !== anio || Number(m[2]) !== mes) continue;
    if (!ESTADOS_CUENTAN_FRECUENCIA_MES_64.has(String(s.estado_solicitud_id || ""))) continue;
    n += 1;
  }
  return n;
}

/**
 * Chip unificado 64: 1/mes por modalidad (A y B independientes).
 * Si A está ocupada y B libre → redirige el alta a 64-B (sin goce).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   persona_id: string,
 *   articulo_id: string,
 *   fecha_desde: string,
 *   tope_mes: number,
 *   exclude_sol_id?: string,
 * }} opts
 */
async function resolverRutaFamilia64Alta(db, opts) {
  const articuloId = String(opts.articulo_id || "").trim();
  const personaId = String(opts.persona_id || "").trim();
  const fechaDesde = String(opts.fecha_desde || "").slice(0, 10);
  const topeMes = Number(opts.tope_mes);
  const excludeSolId = String(opts.exclude_sol_id || "").trim();

  const vacio = {
    ok: true,
    articulo_id: articuloId,
    version_id: null,
    modalidad: null,
    mensaje: null,
    en_mes_a: null,
    en_mes_b: null,
    redirigido: false,
  };

  if (articuloId !== ARTICULO_64A_ETAPA1_ID) return vacio;
  if (!Number.isFinite(topeMes) || topeMes <= 0) return vacio;

  const m = /^(\d{4})-(\d{2})-/.exec(fechaDesde);
  if (!m) {
    return {
      ok: false,
      codigo: "ERROR_FECHA_FRECUENCIA",
      mensaje: "Fecha inválida para frecuencia mensual.",
      articulo_id: articuloId,
      version_id: null,
      modalidad: null,
      mensaje_ui: null,
      en_mes_a: 0,
      en_mes_b: 0,
      redirigido: false,
    };
  }
  const anio = Number(m[1]);
  const mes = Number(m[2]);

  const [enA, enB] = await Promise.all([
    countSolicitudesMesArticulo64(db, personaId, ARTICULO_64A_ETAPA1_ID, anio, mes, excludeSolId),
    countSolicitudesMesArticulo64(db, personaId, ARTICULO_64B_ETAPA1_ID, anio, mes, excludeSolId),
  ]);

  if (enA < topeMes) {
    return {
      ok: true,
      articulo_id: ARTICULO_64A_ETAPA1_ID,
      version_id: null,
      modalidad: "con_goce",
      mensaje:
        enB >= topeMes
          ? "Este mes ya tenés sin goce (64-B). Este pedido se tramita con goce de haberes (64-A)."
          : null,
      en_mes_a: enA,
      en_mes_b: enB,
      redirigido: false,
    };
  }

  if (enB < topeMes) {
    const versionB = await resolveVersionPublicadaId(db, ARTICULO_64B_ETAPA1_ID);
    if (!versionB) {
      return {
        ok: false,
        codigo: "VERSION_64B_NO_ENCONTRADA",
        mensaje: "No hay versión publicada de 64-B para el pedido sin goce del mes.",
        articulo_id: articuloId,
        version_id: null,
        modalidad: null,
        en_mes_a: enA,
        en_mes_b: enB,
        redirigido: false,
      };
    }
    return {
      ok: true,
      articulo_id: ARTICULO_64B_ETAPA1_ID,
      version_id: versionB,
      modalidad: "sin_goce",
      mensaje:
        "Este mes ya tenés con goce (64-A). Este pedido se tramita como sin goce de haberes (64-B).",
      en_mes_a: enA,
      en_mes_b: enB,
      redirigido: true,
    };
  }

  return {
    ok: false,
    codigo: "SALDO_MES",
    mensaje:
      "Este mes ya usaste con goce (64-A) y sin goce (64-B). No podés pedir otro Art. 64 hasta el mes siguiente.",
    articulo_id: articuloId,
    version_id: null,
    modalidad: null,
    en_mes_a: enA,
    en_mes_b: enB,
    redirigido: false,
  };
}

/**
 * ¿Esta solicitud es el carril unificado 64 (entrada 64-A)?
 * @param {Record<string, unknown>} sol
 */
function esSolicitudCarril64Unificado(sol) {
  const art = String(sol?.articulo_id || "").trim();
  if (art === ARTICULO_64A_ETAPA1_ID || art === ARTICULO_64B_ETAPA1_ID) return true;
  const cod = String(sol?.codigo_grilla || "").trim().toUpperCase();
  return cod === "64" || cod.startsWith("64");
}

/**
 * En TX: si modalidad sin_goce y el pedido estaba en 64-A, mueve el débito a bolsa 64-B.
 * Lectura única del doc de saldos; un solo update con ambas bolsas.
 *
 * @param {import("firebase-admin/firestore").Transaction} tx
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} cur
 * @param {string} titularId
 * @param {{ modalidad: string, version_64b_id: string|null }} opts
 * @returns {Promise<{ ok: true, patch: Record<string, unknown> } | { ok: false, codigo: string, mensaje: string }>}
 */
async function aplicarModalidad64EnTx(tx, db, cur, titularId, opts) {
  const modalidad = String(opts.modalidad || "").trim().toLowerCase();
  const artActual = String(cur.articulo_id || "").trim();

  /** @type {Record<string, unknown>} */
  const patchBase = {};
  if (modalidad === "con_goce" || modalidad === "sin_goce") {
    patchBase.modalidad_goce_jefe = modalidad;
  }

  if (modalidad !== "sin_goce") {
    if (modalidad === "con_goce" && artActual === ARTICULO_64A_ETAPA1_ID) {
      patchBase.codigo_grilla = "64-A";
    }
    return { ok: true, patch: patchBase };
  }

  // Ya es 64-B (pedido legacy directo): solo snapshot de modalidad.
  if (artActual === ARTICULO_64B_ETAPA1_ID) {
    patchBase.codigo_grilla = "64-B";
    return { ok: true, patch: patchBase };
  }

  // Pedido unificado / 64-A → cruzar a 64-B.
  if (artActual !== ARTICULO_64A_ETAPA1_ID && !esSolicitudCarril64Unificado(cur)) {
    return { ok: true, patch: patchBase };
  }

  const version64b = String(opts.version_64b_id || "").trim();
  if (!/^ver_/i.test(version64b)) {
    return {
      ok: false,
      codigo: "VERSION_64B_NO_ENCONTRADA",
      mensaje: "No hay versión publicada de 64-B para autorizar sin goce.",
    };
  }

  const dias = Math.floor(Number(cur.motor_dias_descontados) || Number(cur.dias_solicitados) || 0);
  const anio = Number(cur.anio_ciclo_consumo);
  if (!Number.isFinite(dias) || dias <= 0 || !Number.isInteger(anio) || anio < 1900) {
    return {
      ok: false,
      codigo: "MOTOR_64_INCOMPLETO",
      mensaje: "La solicitud no tiene datos de consumo de saldo para cruzar a 64-B.",
    };
  }

  const salId = saldoAnualDocId(titularId, anio);
  if (!salId) {
    return {
      ok: false,
      codigo: "SALDO_DOC_INVALIDO",
      mensaje: "No se pudo resolver el documento de saldo del titular.",
    };
  }

  const salRef = db.collection(COL_SALDOS).doc(salId);
  const salSnap = await tx.get(salRef);
  if (!salSnap.exists) {
    return {
      ok: false,
      codigo: "SALDO_64B",
      mensaje: "No hay documento de saldo del ciclo para descontar 64-B.",
    };
  }

  const salData = salSnap.data() || {};
  const bolsas = salData.bolsas && typeof salData.bolsas === "object" ? salData.bolsas : {};
  const bolsaAId = String(cur.motor_bolsa_id || "").trim();
  const matchB = pickBolsaParaConsumo(salData, ARTICULO_64B_ETAPA1_ID, anio);
  if (!matchB) {
    return {
      ok: false,
      codigo: "SALDO_64B",
      mensaje:
        "No hay bolsa de 64-B (sin goce) en el ciclo. Regularizá el check-in de saldos del agente.",
    };
  }

  const dispB = Number(matchB.bolsa.disponible);
  const consB = Number(matchB.bolsa.consumido) || 0;
  if (!Number.isFinite(dispB) || dispB < dias) {
    return {
      ok: false,
      codigo: "SALDO_64B_INSUFICIENTE",
      mensaje: `Saldo insuficiente en 64-B (disponible ${Number.isFinite(dispB) ? dispB : 0}, se necesitan ${dias}).`,
    };
  }

  /** @type {Record<string, unknown>} */
  const salPatch = {
    "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
  };

  if (cur.motor_descuento_aplicado === true && bolsaAId && bolsas[bolsaAId]) {
    const bA = bolsas[bolsaAId];
    const dispA = Number(bA.disponible);
    const consA = Number(bA.consumido);
    if (!Number.isFinite(dispA) || !Number.isFinite(consA)) {
      return {
        ok: false,
        codigo: "SALDO_64A_CORRUPTO",
        mensaje: "La bolsa 64-A del trámite no tiene saldos numéricos válidos.",
      };
    }
    salPatch[`bolsas.${bolsaAId}.disponible`] = dispA + dias;
    salPatch[`bolsas.${bolsaAId}.consumido`] = Math.max(0, consA - dias);
    salPatch[`bolsas.${bolsaAId}.ultima_actualizacion`] = FieldValue.serverTimestamp();
  }

  salPatch[`bolsas.${matchB.bolsaId}.disponible`] = dispB - dias;
  salPatch[`bolsas.${matchB.bolsaId}.consumido`] = consB + dias;
  salPatch[`bolsas.${matchB.bolsaId}.ultima_actualizacion`] = FieldValue.serverTimestamp();

  tx.update(salRef, salPatch);

  return {
    ok: true,
    patch: {
      ...patchBase,
      articulo_id: ARTICULO_64B_ETAPA1_ID,
      articulo_id_origen: artActual || ARTICULO_64A_ETAPA1_ID,
      version_id_aplicada: version64b,
      codigo_grilla: "64-B",
      motor_bolsa_id: matchB.bolsaId,
      motor_descuento_aplicado: true,
      motor_dias_descontados: dias,
      anio_ciclo_consumo: anio,
      _debito_origen: [
        {
          bolsa_id: matchB.bolsaId,
          anio_origen: anio,
          dias,
          articulo_id: ARTICULO_64B_ETAPA1_ID,
        },
      ],
      cruce_modalidad_64: {
        de: "con_goce",
        a: "sin_goce",
        articulo_origen_id: artActual || ARTICULO_64A_ETAPA1_ID,
        articulo_destino_id: ARTICULO_64B_ETAPA1_ID,
        bolsa_origen_id: bolsaAId || null,
        bolsa_destino_id: matchB.bolsaId,
        dias,
      },
    },
  };
}

module.exports = {
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
  ESTADOS_CUENTAN_FRECUENCIA_MES_64,
  resolveVersionPublicadaId,
  countSolicitudesMesArticulo64,
  resolverRutaFamilia64Alta,
  esSolicitudCarril64Unificado,
  aplicarModalidad64EnTx,
};
