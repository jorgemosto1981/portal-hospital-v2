"use strict";

/**
 * Cruce Patrón B Art. 64: alta unificada descuenta el art. con goce del par;
 * si el jefe autoriza sin goce, revierte bolsa A y debita bolsa B (pares por cfg).
 */

const { FieldValue } = require("./context");
const { saldoAnualDocId, pickBolsaParaConsumo } = require("./laoSaldosBolsa");
const {
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
  normalizeArtId,
  resolveFamilia64Pair,
  resolveFamilia64DesdeSolicitud,
  resolveFamilia64PairAsync,
  loadArticuloCore,
} = require("./familia64Config");

const COL_SALDOS = "saldos_articulo_agente";
const COL_CFG_ART = "cfg_articulos";
const COL_SOL = "solicitudes_articulo";

/** Estados que ocupan el cupo mensual (incluye pendientes). Rechazada/cancelada liberan cupo. */
const ESTADOS_CUENTAN_FRECUENCIA_MES_64 = Object.freeze([
  "cfg_esa_borrador",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
  "cfg_esa_aprobada",
  "cfg_esa_aprobada_pendiente_aplicacion",
]);
const ESTADOS_CUENTAN_FRECUENCIA_MES_64_SET = new Set(ESTADOS_CUENTAN_FRECUENCIA_MES_64);

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @returns {Promise<string|null>}
 */
async function resolveVersionPublicadaId(db, articuloId) {
  const id = normalizeArtId(articuloId);
  if (!id) return null;
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
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @returns {Promise<string>}
 */
async function codigoGrillaDesdeCore(db, articuloId) {
  const core = await loadArticuloCore(db, articuloId);
  const raw = String(core?.codigo || "").trim();
  return raw || String(articuloId || "").trim();
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
  const art = normalizeArtId(articuloId);
  if (!art || !/^per_/i.test(String(personaId || ""))) return 0;
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
    if (!ESTADOS_CUENTAN_FRECUENCIA_MES_64_SET.has(String(s.estado_solicitud_id || ""))) continue;
    n += 1;
  }
  return n;
}

/**
 * Chip unificado 64: 1/mes por modalidad (con/sin goce independientes en el par cfg).
 * Si con-goce del mes está ocupado y sin-goce libre → redirige el alta al art. sin goce del par.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   persona_id: string,
 *   articulo_id: string,
 *   fecha_desde: string,
 *   tope_mes: number,
 *   exclude_sol_id?: string,
 *   core?: Record<string, unknown> | null,
 * }} opts
 */
async function resolverRutaFamilia64Alta(db, opts) {
  const articuloId = normalizeArtId(opts.articulo_id);
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
    con_goce_id: null,
    sin_goce_id: null,
  };

  if (!articuloId) return vacio;
  if (!Number.isFinite(topeMes) || topeMes <= 0) return vacio;

  const pair = await resolveFamilia64PairAsync(db, articuloId, opts.core || null);
  if (!pair.enFamilia || pair.esSinGoce || !pair.conGoceId || !pair.sinGoceId) {
    return vacio;
  }
  if (articuloId !== pair.conGoceId) return vacio;

  const m = /^(\d{4})-(\d{2})-/.exec(fechaDesde);
  if (!m) {
    return {
      ok: false,
      codigo: "ERROR_FECHA_FRECUENCIA",
      mensaje: "Fecha inválida para frecuencia mensual.",
      articulo_id: articuloId,
      version_id: null,
      modalidad: null,
      en_mes_a: 0,
      en_mes_b: 0,
      redirigido: false,
      con_goce_id: pair.conGoceId,
      sin_goce_id: pair.sinGoceId,
    };
  }
  const anio = Number(m[1]);
  const mes = Number(m[2]);

  const [enA, enB] = await Promise.all([
    countSolicitudesMesArticulo64(db, personaId, pair.conGoceId, anio, mes, excludeSolId),
    countSolicitudesMesArticulo64(db, personaId, pair.sinGoceId, anio, mes, excludeSolId),
  ]);

  if (enA < topeMes) {
    return {
      ok: true,
      articulo_id: pair.conGoceId,
      version_id: null,
      modalidad: "con_goce",
      mensaje:
        enB >= topeMes
          ? "Este mes ya tenés sin goce. Este pedido se tramita con goce de haberes."
          : null,
      en_mes_a: enA,
      en_mes_b: enB,
      redirigido: false,
      con_goce_id: pair.conGoceId,
      sin_goce_id: pair.sinGoceId,
    };
  }

  if (enB < topeMes) {
    const versionB = await resolveVersionPublicadaId(db, pair.sinGoceId);
    if (!versionB) {
      return {
        ok: false,
        codigo: "VERSION_64B_NO_ENCONTRADA",
        mensaje: "No hay versión publicada del artículo sin goce del par para este mes.",
        articulo_id: articuloId,
        version_id: null,
        modalidad: null,
        en_mes_a: enA,
        en_mes_b: enB,
        redirigido: false,
        con_goce_id: pair.conGoceId,
        sin_goce_id: pair.sinGoceId,
      };
    }
    return {
      ok: true,
      articulo_id: pair.sinGoceId,
      version_id: versionB,
      modalidad: "sin_goce",
      mensaje:
        "Este mes ya tenés con goce. Este pedido se tramita como sin goce de haberes.",
      en_mes_a: enA,
      en_mes_b: enB,
      redirigido: true,
      con_goce_id: pair.conGoceId,
      sin_goce_id: pair.sinGoceId,
    };
  }

  return {
    ok: false,
    codigo: "SALDO_MES",
    mensaje:
      "Este mes ya usaste con goce y sin goce del Art. 64. No podés pedir otro hasta el mes siguiente.",
    articulo_id: articuloId,
    version_id: null,
    modalidad: null,
    en_mes_a: enA,
    en_mes_b: enB,
    redirigido: false,
    con_goce_id: pair.conGoceId,
    sin_goce_id: pair.sinGoceId,
  };
}

/**
 * ¿Esta solicitud es el carril unificado familia 64?
 * @param {Record<string, unknown>} sol
 * @param {Record<string, unknown> | null | undefined} [core]
 */
function esSolicitudCarril64Unificado(sol, core) {
  return resolveFamilia64DesdeSolicitud(sol, core).enFamilia === true;
}

/**
 * En TX: si modalidad sin_goce y el pedido estaba en con-goce, mueve el débito a bolsa sin-goce del par.
 *
 * @param {import("firebase-admin/firestore").Transaction} tx
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} cur
 * @param {string} titularId
 * @param {{ modalidad: string, version_64b_id: string|null, pair?: { conGoceId: string, sinGoceId: string } | null }} opts
 * @returns {Promise<{ ok: true, patch: Record<string, unknown> } | { ok: false, codigo: string, mensaje: string }>}
 */
async function aplicarModalidad64EnTx(tx, db, cur, titularId, opts) {
  const modalidad = String(opts.modalidad || "").trim().toLowerCase();
  const artActual = normalizeArtId(cur.articulo_id);

  let pair = opts.pair || null;
  if (!pair) {
    const resolved = resolveFamilia64DesdeSolicitud(cur, null);
    if (resolved.enFamilia && resolved.conGoceId && resolved.sinGoceId) {
      pair = { conGoceId: resolved.conGoceId, sinGoceId: resolved.sinGoceId };
    }
  }
  if (!pair && artActual) {
    const asyncPair = await resolveFamilia64PairAsync(db, artActual, null);
    if (asyncPair.enFamilia && asyncPair.conGoceId && asyncPair.sinGoceId) {
      pair = { conGoceId: asyncPair.conGoceId, sinGoceId: asyncPair.sinGoceId };
    }
  }

  /** @type {Record<string, unknown>} */
  const patchBase = {};
  if (modalidad === "con_goce" || modalidad === "sin_goce") {
    patchBase.modalidad_goce_jefe = modalidad;
  }
  if (pair) {
    patchBase.articulo_familia_64 = true;
    patchBase.articulo_id_con_goce = pair.conGoceId;
    patchBase.articulo_id_sin_goce = pair.sinGoceId;
  }

  if (modalidad !== "sin_goce") {
    if (modalidad === "con_goce" && pair && artActual === pair.conGoceId) {
      patchBase.codigo_grilla = await codigoGrillaDesdeCore(db, pair.conGoceId);
    }
    return { ok: true, patch: patchBase };
  }

  // Ya es el art. sin goce del par: solo snapshot de modalidad.
  if (pair && artActual === pair.sinGoceId) {
    patchBase.codigo_grilla = await codigoGrillaDesdeCore(db, pair.sinGoceId);
    return { ok: true, patch: patchBase };
  }

  if (!pair || (artActual !== pair.conGoceId && !esSolicitudCarril64Unificado(cur))) {
    return { ok: true, patch: patchBase };
  }

  const version64b = String(opts.version_64b_id || "").trim();
  if (!/^ver_/i.test(version64b)) {
    return {
      ok: false,
      codigo: "VERSION_64B_NO_ENCONTRADA",
      mensaje: "No hay versión publicada del artículo sin goce para autorizar sin goce.",
    };
  }

  const dias = Math.floor(Number(cur.motor_dias_descontados) || Number(cur.dias_solicitados) || 0);
  const anio = Number(cur.anio_ciclo_consumo);
  if (!Number.isFinite(dias) || dias <= 0 || !Number.isInteger(anio) || anio < 1900) {
    return {
      ok: false,
      codigo: "MOTOR_64_INCOMPLETO",
      mensaje: "La solicitud no tiene datos de consumo de saldo para cruzar a sin goce.",
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
      mensaje: "No hay documento de saldo del ciclo para descontar el artículo sin goce.",
    };
  }

  const salData = salSnap.data() || {};
  const bolsas = salData.bolsas && typeof salData.bolsas === "object" ? salData.bolsas : {};
  const bolsaAId = String(cur.motor_bolsa_id || "").trim();
  const matchB = pickBolsaParaConsumo(salData, pair.sinGoceId, anio);
  if (!matchB) {
    return {
      ok: false,
      codigo: "SALDO_64B",
      mensaje:
        "No hay bolsa sin goce del par en el ciclo. Regularizá el check-in de saldos del agente.",
    };
  }

  const dispB = Number(matchB.bolsa.disponible);
  const consB = Number(matchB.bolsa.consumido) || 0;
  if (!Number.isFinite(dispB) || dispB < dias) {
    return {
      ok: false,
      codigo: "SALDO_64B_INSUFICIENTE",
      mensaje: `Saldo insuficiente en sin goce (disponible ${Number.isFinite(dispB) ? dispB : 0}, se necesitan ${dias}).`,
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
        mensaje: "La bolsa con goce del trámite no tiene saldos numéricos válidos.",
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

  const codigoSin = await codigoGrillaDesdeCore(db, pair.sinGoceId);

  return {
    ok: true,
    patch: {
      ...patchBase,
      articulo_id: pair.sinGoceId,
      articulo_id_origen: artActual || pair.conGoceId,
      version_id_aplicada: version64b,
      codigo_grilla: codigoSin,
      motor_bolsa_id: matchB.bolsaId,
      motor_descuento_aplicado: true,
      motor_dias_descontados: dias,
      anio_ciclo_consumo: anio,
      _debito_origen: [
        {
          bolsa_id: matchB.bolsaId,
          anio_origen: anio,
          dias,
          articulo_id: pair.sinGoceId,
        },
      ],
      cruce_modalidad_64: {
        de: "con_goce",
        a: "sin_goce",
        articulo_origen_id: artActual || pair.conGoceId,
        articulo_destino_id: pair.sinGoceId,
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
  ESTADOS_CUENTAN_FRECUENCIA_MES_64: ESTADOS_CUENTAN_FRECUENCIA_MES_64_SET,
  resolveVersionPublicadaId,
  countSolicitudesMesArticulo64,
  resolverRutaFamilia64Alta,
  esSolicitudCarril64Unificado,
  aplicarModalidad64EnTx,
  resolveFamilia64Pair,
  resolveFamilia64DesdeSolicitud,
  resolveFamilia64PairAsync,
};
