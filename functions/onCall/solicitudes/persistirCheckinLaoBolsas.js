"use strict";

/**
 * Callable — check-in LAO: bolsas históricas (años < A) en saldos_articulo_agente.
 * @see docs/v2/RFC_LAO_CHECKIN_SALDOS_V2.md
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../../modules/shared/context");
const { tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const { assertCheckinAnioAllowed } = require("../../modules/shared/laoVersionResolver");
const { resolvePublishedLaoVersion } = require("../../modules/shared/laoVersionResolverDb");
const {
  saldoAnualDocId,
  buildBolsaPayload,
  pickBolsaParaConsumo,
  CFG_OS_EXTERNO_INFORMADO,
} = require("../../modules/shared/laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";

function assertRrhh(request) {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede registrar check-in LAO.");
  }
}

const persistirCheckinLaoBolsas = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const anioCorteA = Number(d.anio_corte_a);
  const hlcOk = d.hlc_confirmadas_completas === true;
  const filas = Array.isArray(d.filas) ? d.filas : [];

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido (per_*).");
  }
  if (!/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido (art_*).");
  }
  if (!Number.isInteger(anioCorteA) || anioCorteA < 1900) {
    throw new HttpsError("invalid-argument", "anio_corte_a inválido.");
  }
  if (!hlcOk) {
    throw new HttpsError("failed-precondition", "hlc_confirmadas_completas debe ser true.");
  }
  if (!filas.length) {
    throw new HttpsError("invalid-argument", "filas debe tener al menos un año de saldo histórico.");
  }

  const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
  const codigoGrilla =
    (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "LAO";

  /** @type {Array<{ anio_origen: number, bolsa_id: string, version_id: string }>} */
  const escritas = [];

  for (const fila of filas) {
    const anioOrigen = Number(fila?.anio_origen);
    const dias = Number(fila?.dias_disponibles);
    let versionId = typeof fila?.version_id === "string" ? fila.version_id.trim() : "";

    if (!Number.isInteger(anioOrigen) || anioOrigen < 1900) {
      throw new HttpsError("invalid-argument", "Cada fila requiere anio_origen entero válido.");
    }
    if (!Number.isFinite(dias) || dias < 0) {
      throw new HttpsError("invalid-argument", `dias_disponibles inválido para año ${anioOrigen}.`);
    }

    try {
      assertCheckinAnioAllowed(anioOrigen, anioCorteA);
    } catch (err) {
      throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
    }

    if (!versionId) {
      try {
        const resolved = await resolvePublishedLaoVersion(db, articuloId, anioOrigen);
        versionId = resolved.versionId;
      } catch (err) {
        const code = err && typeof err.code === "string" ? err.code : "failed-precondition";
        const msg = err instanceof Error ? err.message : String(err);
        if (code === "not-found") throw new HttpsError("not-found", msg);
        throw new HttpsError("failed-precondition", msg);
      }
    }

    const salId = saldoAnualDocId(personaId, anioOrigen);
    if (!salId) {
      throw new HttpsError("invalid-argument", "No se pudo calcular saldo anual para persona/año.");
    }

    const salRef = db.collection(COL_SALDOS).doc(salId);
    const salSnap = await salRef.get();
    const salData = salSnap.exists ? salSnap.data() || {} : {};
    const existente = pickBolsaParaConsumo(salData, articuloId, anioOrigen);
    if (existente) {
      const cons = Number(existente.bolsa.consumido) || 0;
      if (cons > 0) {
        throw new HttpsError(
          "already-exists",
          `Ya existe bolsa ${anioOrigen} con consumo (${cons} días). Ajuste manual RRHH.`,
        );
      }
    }

    const { bolsaId, bolsa } = buildBolsaPayload({
      articuloId,
      versionId,
      codigoGrilla: String(codigoGrilla),
      anioOrigen,
      cantidadInicial: dias,
      esArrastre: true,
      origenSaldoId: CFG_OS_EXTERNO_INFORMADO,
    });

    bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

    if (salSnap.exists) {
      /** `set` + `{ merge:true }` y mapas anidados puede dejar campos viejos de la bolsa; `update` reemplaza la entrada completa. */
      await salRef.update({
        [`bolsas.${bolsaId}`]: bolsa,
        "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
      });
    } else {
      await salRef.set({
        persona_id: personaId,
        anio_calendario: anioOrigen,
        bolsas: { [bolsaId]: bolsa },
        metadata: {
          ultima_sincronizacion: FieldValue.serverTimestamp(),
        },
      });
    }

    escritas.push({ anio_origen: anioOrigen, bolsa_id: bolsaId, version_id: versionId });
  }

  await db.collection("personas").doc(personaId).set(
    {
      anio_corte_portal_a: anioCorteA,
      checkin_lao_registrado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ok: true,
    persona_id: personaId,
    articulo_id: articuloId,
    anio_corte_a: anioCorteA,
    bolsas_escritas: escritas,
  };
});

module.exports = { persistirCheckinLaoBolsas };
