"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhAccess, serializeFirestoreValue } = require("../../modules/shared/helpers");
const { countHlcOperativosPersona } = require("../../modules/shared/hlcCheckinAssert");

const obtenerResumenAltaOnboardingPersona = onCall(async (request) => {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede consultar el resumen de alta.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }

  const [personaSnap, cuentaSnap, hlcOperativos] = await Promise.all([
    db.collection("personas").doc(personaId).get(),
    db.collection("usuarios_cuenta").where("persona_id", "==", personaId).limit(1).get(),
    countHlcOperativosPersona(db, personaId),
  ]);

  const personaRaw = personaSnap.exists ? personaSnap.data() || {} : null;
  const personaFlat = personaRaw
    ? serializeFirestoreValue(personaRaw)
    : null;
  const persona =
    personaFlat && typeof personaFlat === "object" && !Array.isArray(personaFlat) ? personaFlat : null;

  return {
    ok: true,
    persona_id: personaId,
    persona_existe: personaSnap.exists,
    persona,
    tiene_cuenta: !cuentaSnap.empty,
    hlc_operativos: hlcOperativos,
    checkin_cerrado: Boolean(persona?.checkin_saldos_portal_en),
    anio_corte_portal_a: persona?.anio_corte_portal_a ?? null,
  };
});

module.exports = { obtenerResumenAltaOnboardingPersona };
