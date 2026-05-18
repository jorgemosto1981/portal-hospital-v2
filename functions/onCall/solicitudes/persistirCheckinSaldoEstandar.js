"use strict";

/**
 * Check-in Patrón B (ciclo) y C (bolsa global, saldo firmado).
 * @see docs/v2/RFC_SALDOS_PATRONES_ABC_V2.md
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../../modules/shared/context");
const { tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const { resolvePublishedLaoVersion } = require("../../modules/shared/laoVersionResolverDb");
const {
  saldoAnualDocId,
  saldoGlobalDocId,
  buildBolsaCheckinPatronB,
  buildBolsaCheckinPatronC,
  resolveCodigoGrillaForBolsa,
  pickBolsaParaConsumo,
} = require("../../modules/shared/laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";
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
      "Check-in global ya cerrado para esta persona. Use forzar_recarga_global o reabra desde auditoría.",
    );
  }
}

const persistirCheckinSaldoEstandar = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const patron = String(d.patron || "").trim().toUpperCase();
  const anioCorteA = Number(d.anio_corte_a);
  const rectificacion = d.rectificacion_saldo === true;
  const forzarGlobal = d.forzar_recarga_global === true || rectificacion;
  let versionId = typeof d.version_id === "string" ? d.version_id.trim() : "";

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido.");
  }
  if (!Number.isInteger(anioCorteA) || anioCorteA < 1900) {
    throw new HttpsError("invalid-argument", "anio_corte_a inválido.");
  }
  if (patron !== PATRON_B && patron !== PATRON_C) {
    throw new HttpsError("invalid-argument", "patron debe ser B o C.");
  }

  const personaSnap = await db.collection("personas").doc(personaId).get();
  assertPortalCheckinAbierto(personaSnap.exists ? personaSnap.data() : null, forzarGlobal);

  const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
  const articuloCodigo =
    (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "ART";

  if (patron === PATRON_B) {
    const anioCiclo = Number(d.anio_ciclo);
    const diasUsados = Number(d.dias_consumidos_previos);
    if (!Number.isInteger(anioCiclo) || anioCiclo < 1900) {
      throw new HttpsError("invalid-argument", "anio_ciclo inválido.");
    }
    if (anioCiclo > anioCorteA) {
      throw new HttpsError("invalid-argument", `anio_ciclo no puede ser mayor que A (${anioCorteA}).`);
    }
    if (!Number.isInteger(diasUsados) || diasUsados < 0) {
      throw new HttpsError("invalid-argument", "dias_consumidos_previos debe ser entero ≥ 0.");
    }

    let cupo = Number(d.cupo_dias_por_ciclo);
    if (!Number.isFinite(cupo) || cupo < 0) {
      if (!versionId) {
        try {
          const resolved = await resolvePublishedLaoVersion(db, articuloId, anioCiclo);
          versionId = resolved.versionId;
        } catch (err) {
          throw new HttpsError("failed-precondition", err?.message || "Versión no encontrada.");
        }
      }
      const vSnap = await db
        .collection("cfg_articulos")
        .doc(articuloId)
        .collection("versiones")
        .doc(versionId)
        .get();
      const topes = vSnap.exists ? vSnap.data()?.bloque_topes_plazos_computo || {} : {};
      cupo = Number(topes.cupo_dias_por_ciclo);
    }
    if (!Number.isFinite(cupo) || cupo < 0) {
      throw new HttpsError("failed-precondition", "Falta cupo_dias_por_ciclo en la versión.");
    }

    if (!versionId) {
      const resolved = await resolvePublishedLaoVersion(db, articuloId, anioCiclo);
      versionId = resolved.versionId;
    }
    const vSnap = await db
      .collection("cfg_articulos")
      .doc(articuloId)
      .collection("versiones")
      .doc(versionId)
      .get();
    const versionData = vSnap.exists ? vSnap.data() : {};
    const codigoGrilla = resolveCodigoGrillaForBolsa(versionData, anioCiclo, articuloCodigo);

    let built;
    try {
      built = buildBolsaCheckinPatronB({
        articuloId,
        versionId,
        codigoGrilla,
        anioCiclo,
        cupoDias: cupo,
        diasConsumidosPrevios: diasUsados,
      });
    } catch (err) {
      throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
    }

    const salId = saldoAnualDocId(personaId, anioCiclo);
    if (!salId) throw new HttpsError("invalid-argument", "No se pudo calcular saldo anual.");

    const salRef = db.collection(COL_SALDOS).doc(salId);
    const salSnap = await salRef.get();
    const existente = pickBolsaParaConsumo(salSnap.exists ? salSnap.data() : {}, articuloId, anioCiclo);
    if (existente && !rectificacion) {
      const cons = Number(existente.bolsa.consumido) || 0;
      if (cons > diasUsados && !forzarGlobal) {
        throw new HttpsError(
          "already-exists",
          `Bolsa ${anioCiclo} ya tiene consumo (${cons} días). Use forzar_recarga_global.`,
        );
      }
    }

    const { bolsaId, bolsa } = built;
    if (existente && rectificacion) {
      const prev = existente.bolsa;
      bolsa.version_id_origen = String(prev.version_id_origen || bolsa.version_id_origen).trim();
      bolsa.codigo_grilla = String(prev.codigo_grilla || bolsa.codigo_grilla).trim();
      bolsa.origen_saldo_id = String(prev.origen_saldo_id || bolsa.origen_saldo_id).trim();
    }
    bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

    if (salSnap.exists) {
      await salRef.update({
        [`bolsas.${bolsaId}`]: bolsa,
        "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
      });
    } else {
      await salRef.set({
        persona_id: personaId,
        anio_calendario: anioCiclo,
        bolsas: { [bolsaId]: bolsa },
        metadata: { ultima_sincronizacion: FieldValue.serverTimestamp() },
      });
    }

    if (!rectificacion) {
      await db.collection("personas").doc(personaId).set({ anio_corte_portal_a: anioCorteA }, { merge: true });
    }

    return {
      ok: true,
      rectificacion_saldo: rectificacion,
      patron: PATRON_B,
      persona_id: personaId,
      articulo_id: articuloId,
      bolsa_id: bolsaId,
      saldo_doc_id: salId,
      version_id: versionId,
      disponible: bolsa.disponible,
    };
  }

  const saldoDisp = d.saldo_disponible_inicial;
  const disp = saldoDisp === undefined || saldoDisp === null ? 0 : Number(saldoDisp);
  if (!Number.isFinite(disp)) {
    throw new HttpsError("invalid-argument", "saldo_disponible_inicial debe ser un número.");
  }

  if (!versionId) {
    try {
      const resolved = await resolvePublishedLaoVersion(db, articuloId, anioCorteA);
      versionId = resolved.versionId;
    } catch {
      const snap = await db
        .collection("cfg_articulos")
        .doc(articuloId)
        .collection("versiones")
        .where("estado_version_id", "==", "cfg_est_ver_publicada")
        .limit(1)
        .get();
      if (snap.empty) throw new HttpsError("not-found", "Sin versión publicada.");
      versionId = snap.docs[0].id;
    }
  }

  const vSnap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  const versionData = vSnap.exists ? vSnap.data() : {};
  const codigoGrilla = resolveCodigoGrillaForBolsa(versionData, 0, articuloCodigo);

  let built;
  try {
    built = buildBolsaCheckinPatronC({
      articuloId,
      versionId,
      codigoGrilla,
      saldoDisponible: disp,
    });
  } catch (err) {
    throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
  }

  const salId = saldoGlobalDocId(personaId);
  if (!salId) throw new HttpsError("invalid-argument", "sal_global inválido.");

  const salRef = db.collection(COL_SALDOS).doc(salId);
  const salSnap = await salRef.get();
  const existenteC = pickBolsaParaConsumo(salSnap.exists ? salSnap.data() : {}, articuloId, 0);
  const { bolsaId, bolsa } = built;
  if (existenteC && rectificacion) {
    const prev = existenteC.bolsa;
    bolsa.version_id_origen = String(prev.version_id_origen || bolsa.version_id_origen).trim();
    bolsa.codigo_grilla = String(prev.codigo_grilla || bolsa.codigo_grilla).trim();
    bolsa.origen_saldo_id = String(prev.origen_saldo_id || bolsa.origen_saldo_id).trim();
  }
  bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

  if (salSnap.exists) {
    await salRef.update({
      [`bolsas.${bolsaId}`]: bolsa,
      "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
    });
  } else {
    await salRef.set({
      persona_id: personaId,
      anio_calendario: 0,
      bolsas: { [bolsaId]: bolsa },
      metadata: { ultima_sincronizacion: FieldValue.serverTimestamp() },
    });
  }

  if (!rectificacion) {
    await db.collection("personas").doc(personaId).set({ anio_corte_portal_a: anioCorteA }, { merge: true });
  }

  return {
    ok: true,
    rectificacion_saldo: rectificacion,
    patron: PATRON_C,
    persona_id: personaId,
    articulo_id: articuloId,
    bolsa_id: bolsaId,
    saldo_doc_id: salId,
    version_id: versionId,
    disponible: bolsa.disponible,
  };
});

module.exports = { persistirCheckinSaldoEstandar };
