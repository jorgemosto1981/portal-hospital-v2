"use strict";

/**
 * Guardado atómico de varias bolsas Patrón B o C en un solo doc saldo (transacción).
 * @see docs/v2/CHECKIN_SALDOS_BACKLOG.md #4
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../../modules/shared/context");
const { tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const { assertHlcOperativoCheckinNuevo } = require("../../modules/shared/hlcCheckinAssert");
const {
  COL_SALDOS,
  prepareBolsaPatronB,
  prepareBolsaPatronC,
  saldoAnualDocId,
  saldoGlobalDocId,
} = require("../../modules/shared/checkinSaldoEstandarCore");

const PATRON_B = "B";
const PATRON_C = "C";

function assertRrhh(request) {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede registrar check-in de saldos.");
  }
}

function assertPortalCheckinAbierto(personaData, forzar) {
  if (forzar === true) return;
  if (personaData?.checkin_saldos_portal_en) {
    throw new HttpsError(
      "failed-precondition",
      "Check-in global ya cerrado. Use rectificación o forzar_recarga_global.",
    );
  }
}

const persistirCheckinSaldoEstandarLote = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const patron = String(d.patron || "").trim().toUpperCase();
  const anioCorteA = Number(d.anio_corte_a);
  const rectificacion = d.rectificacion_saldo === true;
  const forzarGlobal = d.forzar_recarga_global === true || rectificacion;
  const items = Array.isArray(d.items) ? d.items : [];

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!Number.isInteger(anioCorteA) || anioCorteA < 1900) {
    throw new HttpsError("invalid-argument", "anio_corte_a inválido.");
  }
  if (patron !== PATRON_B && patron !== PATRON_C) {
    throw new HttpsError("invalid-argument", "patron debe ser B o C.");
  }
  if (!items.length) {
    throw new HttpsError("invalid-argument", "items debe tener al menos un artículo.");
  }
  if (items.length > 40) {
    throw new HttpsError("invalid-argument", "Máximo 40 artículos por lote.");
  }

  const personaSnap = await db.collection("personas").doc(personaId).get();
  const personaData = personaSnap.exists ? personaSnap.data() : null;
  assertPortalCheckinAbierto(personaData, forzarGlobal);

  if (!rectificacion && !forzarGlobal) {
    await assertHlcOperativoCheckinNuevo(db, personaId);
  }

  const salId =
    patron === PATRON_B ? saldoAnualDocId(personaId, anioCorteA) : saldoGlobalDocId(personaId);
  if (!salId) throw new HttpsError("invalid-argument", "No se pudo calcular documento de saldo.");

  const salRef = db.collection(COL_SALDOS).doc(salId);
  const salSnapPre = await salRef.get();
  const salDataPre = salSnapPre.exists ? salSnapPre.data() || {} : {};

  /** @type {Array<{ articulo_id: string, bolsa_id: string, disponible: number }>} */
  const preparadas = [];

  for (let i = 0; i < items.length; i += 1) {
    const row = items[i] && typeof items[i] === "object" ? items[i] : {};
    const articuloId = typeof row.articulo_id === "string" ? row.articulo_id.trim() : "";
    if (!/^art_/i.test(articuloId)) {
      throw new HttpsError("invalid-argument", `items[${i}].articulo_id inválido.`);
    }

    if (patron === PATRON_B) {
      const anioCiclo = Number(row.anio_ciclo ?? anioCorteA);
      const diasUsados = Number(row.dias_consumidos_previos);
      if (!Number.isInteger(anioCiclo) || anioCiclo < 1900) {
        throw new HttpsError("invalid-argument", `items[${i}].anio_ciclo inválido.`);
      }
      if (anioCiclo > anioCorteA) {
        throw new HttpsError("invalid-argument", `items[${i}]: anio_ciclo > A.`);
      }
      if (!Number.isInteger(diasUsados) || diasUsados < 0) {
        throw new HttpsError("invalid-argument", `items[${i}]: días usados entero ≥ 0.`);
      }
      const prep = await prepareBolsaPatronB(db, {
        personaId,
        articuloId,
        anioCorteA,
        anioCiclo,
        diasUsados,
        cupoFromClient: row.cupo_dias_por_ciclo,
        versionIdFromClient: row.version_id,
        rectificacion,
        forzarGlobal,
        salDataExisting: salDataPre,
      });
      preparadas.push({
        articulo_id: articuloId,
        bolsa_id: prep.bolsaId,
        bolsa: prep.bolsa,
        disponible: prep.disponible,
      });
      salDataPre.bolsas = salDataPre.bolsas || {};
      salDataPre.bolsas[prep.bolsaId] = prep.bolsa;
    } else {
      const disp =
        row.saldo_disponible_inicial === undefined || row.saldo_disponible_inicial === null
          ? 0
          : Number(row.saldo_disponible_inicial);
      const prep = await prepareBolsaPatronC(db, {
        articuloId,
        anioCorteA,
        saldoDisponible: disp,
        versionIdFromClient: row.version_id,
        rectificacion,
        salDataExisting: salDataPre,
      });
      preparadas.push({
        articulo_id: articuloId,
        bolsa_id: prep.bolsaId,
        bolsa: prep.bolsa,
        disponible: prep.disponible,
      });
      salDataPre.bolsas = salDataPre.bolsas || {};
      salDataPre.bolsas[prep.bolsaId] = prep.bolsa;
    }
  }

  const personaRef = db.collection("personas").doc(personaId);
  const ts = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const salSnap = await tx.get(salRef);
    const updates = { "metadata.ultima_sincronizacion": ts };
    for (const p of preparadas) {
      updates[`bolsas.${p.bolsa_id}`] = p.bolsa;
    }

    if (salSnap.exists) {
      tx.update(salRef, updates);
    } else {
      /** @type {Record<string, object>} */
      const bolsas = {};
      for (const p of preparadas) {
        bolsas[p.bolsa_id] = p.bolsa;
      }
      tx.set(salRef, {
        persona_id: personaId,
        anio_calendario: patron === PATRON_B ? anioCorteA : 0,
        bolsas,
        metadata: { ultima_sincronizacion: ts },
      });
    }

    if (!rectificacion) {
      tx.set(personaRef, { anio_corte_portal_a: anioCorteA }, { merge: true });
    }
  });

  return {
    ok: true,
    patron,
    persona_id: personaId,
    saldo_doc_id: salId,
    rectificacion_saldo: rectificacion,
    escritas: preparadas.map((p) => ({
      articulo_id: p.articulo_id,
      bolsa_id: p.bolsa_id,
      disponible: p.disponible,
    })),
    count: preparadas.length,
  };
});

module.exports = { persistirCheckinSaldoEstandarLote };
