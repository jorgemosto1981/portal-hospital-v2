"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { auth, db, FieldValue } = require("./shared/context");
const {
  CFG_ECA_ACTIVO,
  CFG_EPD_COMP,
  CFG_ONB,
  CFG_PEND_REG,
  CFG_TEV_LOGIN,
  COL_EVENTOS,
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  ESTADO_ACTIVO_MVP,
} = require("./shared/constants");
const {
  assertAgenteConPersonaId,
  assertPersonaMvpPendienteOnboarding,
  normalizeCatalogDocId,
  normalizeDni,
  validEmail,
} = require("./shared/helpers");

const vincularCuentaConDni = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión para vincularte.");
  const uid = request.auth.uid;
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  if (!/^\d{6,12}$/.test(dni)) throw new HttpsError("invalid-argument", "DNI inválido (6 a 12 dígitos).");
  const uAuth = await auth.getUser(uid);
  const emailNorm = (uAuth.email || "").trim().toLowerCase();
  if (!uAuth.email || !validEmail(uAuth.email)) {
    throw new HttpsError("failed-precondition", "Hace falta un email válido en la cuenta (Firebase Auth).");
  }

  const yaSnap = await db.collection(COL_USUARIOS_CUENTA).where("auth_uid", "==", uid).limit(2).get();
  if (!yaSnap.empty) {
    if (yaSnap.size > 1) throw new HttpsError("internal", "Más de una fila con el mismo auth_uid.");
    const doc0 = yaSnap.docs[0];
    const pSnap = await db.collection(COL_PERSONAS).doc(String(doc0.data() && doc0.data().persona_id)).get();
    if (pSnap.exists) {
      const pD = pSnap.data() || {};
      if (normalizeDni(pD.dni) === dni) {
        return { ok: true, persona_id: pSnap.id, cuenta_id: doc0.id, alreadyLinked: true };
      }
    }
    throw new HttpsError("failed-precondition", "Esta sesión ya está vinculada a otra identidad digital.");
  }

  const emailDup = await db.collection(COL_USUARIOS_CUENTA).where("username", "==", emailNorm).limit(2).get();
  if (!emailDup.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Ese email ya se usa con otra cuenta. Probá con otro correo o usá el flujo de inicio con DNI+PIN asignado.",
    );
  }

  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) throw new HttpsError("not-found", "No hay un legajo pre-registrado con ese DNI.");
  if (psn.size > 1) throw new HttpsError("internal", "Inconsistencia: más de una persona con el mismo DNI.");
  const pDoc = psn.docs[0];
  const personaId = pDoc.id;
  const pData = pDoc.data() || {};
  if (pData.estado && pData.estado !== "PENDIENTE_ONBOARDING") {
    throw new HttpsError("failed-precondition", "Ese DNI no está en fase de primer vínculo o el legajo ya se activó.");
  }

  const cSnap = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", personaId).limit(2).get();
  if (cSnap.empty) throw new HttpsError("failed-precondition", "No se encontró la cuenta vinculada a ese DNI (contactá a RRHH).");
  if (cSnap.size > 1) throw new HttpsError("internal", "Cuenta duplicada para la misma persona.");
  const cuentaRef = cSnap.docs[0].ref;
  const cuentaId = cSnap.docs[0].id;
  const cu = cSnap.docs[0].data() || {};
  if (cu.auth_uid && cu.auth_uid !== uid) {
    throw new HttpsError("failed-precondition", "El legajo ya se vinculó a otra identidad (otro inicio de sesión).");
  }
  if (cu.estado_acceso && cu.estado_acceso !== CFG_PEND_REG) {
    throw new HttpsError("failed-precondition", "El estado de la cuenta no admite el vínculo inicial.");
  }
  if (cu.username && String(cu.username).trim().toLowerCase() !== emailNorm) {
    throw new HttpsError("failed-precondition", "La cuenta de dominio no coincide (contactá a RRHH).");
  }

  const personaRef = pDoc.ref;
  const evtId = `evt_${ulid()}`;
  await db.runTransaction(async (tx) => {
    const cR = await tx.get(cuentaRef);
    const c0 = cR.data() || {};
    if (c0.auth_uid && c0.auth_uid !== uid) {
      throw new HttpsError("failed-precondition", "La cuenta se actualizó mientras tanto; reintentá.");
    }
    tx.set(cuentaRef, { auth_uid: uid, username: emailNorm, estado_acceso: CFG_ONB, actualizado_en: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(personaRef, {
      "metadata.auth_vinculado": true,
      "metadata.vinculado_en": FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection(COL_EVENTOS).doc(evtId), {
      tipo_evento_id: CFG_TEV_LOGIN,
      persona_id: personaId,
      cuenta_id: cuentaId,
      ocurrido_en: FieldValue.serverTimestamp(),
      payload: { fase: "B", motivo: "vincularCuentaConDni" },
    });
  });

  const userAfter = await auth.getUser(uid);
  const prev = userAfter.customClaims && typeof userAfter.customClaims === "object" ? { ...userAfter.customClaims } : {};
  await auth.setCustomUserClaims(uid, { ...prev, persona_id: personaId, cuenta_id: cuentaId });
  return { ok: true, persona_id: personaId, cuenta_id: cuentaId };
});

const onboardingMvpPasoA = onCall(async (request) => {
  const pid = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const cIn = d.contacto && typeof d.contacto === "object" ? d.contacto : {};
  const domIn = d.domicilio && typeof d.domicilio === "object" ? d.domicilio : {};

  const telefonoCel = typeof cIn.telefono_celular === "string" ? cIn.telefono_celular.trim() : "";
  const emailPer = cIn.email_personal == null || cIn.email_personal === "" ? null : String(cIn.email_personal).trim().toLowerCase();
  if (emailPer && !validEmail(emailPer)) throw new HttpsError("invalid-argument", "Email personal inválido.");
  if (telefonoCel.length < 6) throw new HttpsError("invalid-argument", "Ingresá un teléfono móvil de contacto válido.");

  const calle = typeof domIn.calle === "string" ? domIn.calle.trim() : "";
  const numero = typeof domIn.numero === "string" ? domIn.numero.trim() : "";
  const codigo_postal = typeof domIn.codigo_postal === "string" ? domIn.codigo_postal.trim() : "";
  const provinciaRaw = domIn.provincia_id == null || domIn.provincia_id === "" ? null : String(domIn.provincia_id);
  const localidadRaw = domIn.localidad_id == null || domIn.localidad_id === "" ? null : String(domIn.localidad_id);
  if (!calle || !numero || !codigo_postal) {
    throw new HttpsError("invalid-argument", "Completá calle, altura y código postal.");
  }
  if (!provinciaRaw || !localidadRaw) throw new HttpsError("invalid-argument", "Seleccioná provincia y localidad.");
  const provincia_id = normalizeCatalogDocId(provinciaRaw);
  const localidad_id = normalizeCatalogDocId(localidadRaw);
  if (!(await db.collection("cfg_provincia").doc(provincia_id).get()).exists) {
    throw new HttpsError("invalid-argument", "La provincia seleccionada no existe en catálogo.");
  }
  const locSnap = await db.collection("cfg_localidad").doc(localidad_id).get();
  if (!locSnap.exists) throw new HttpsError("invalid-argument", "La localidad seleccionada no existe en catálogo.");
  const locData = locSnap.data() || {};
  if (locData.provincia_id && normalizeCatalogDocId(String(locData.provincia_id)) !== provincia_id) {
    throw new HttpsError("invalid-argument", "Localidad y provincia no corresponden.");
  }

  const piso = domIn.piso == null || domIn.piso === "" ? null : String(domIn.piso).trim();
  const depto = domIn.departamento == null || domIn.departamento === "" ? null : String(domIn.departamento).trim();
  const refTxt = domIn.referencia == null || domIn.referencia === "" ? null : String(domIn.referencia).trim();
  const telFijo = cIn.telefono_fijo == null || cIn.telefono_fijo === "" ? null : String(cIn.telefono_fijo).trim();

  const ref = db.collection(COL_PERSONAS).doc(pid);
  const ps = await ref.get();
  if (!ps.exists) throw new HttpsError("not-found", "Persona no encontrada.");
  assertPersonaMvpPendienteOnboarding(ps);
  const pMeta = (ps.data() && ps.data().metadata) || {};
  if (!pMeta.auth_vinculado) throw new HttpsError("failed-precondition", "Primero completá el vínculo con tu DNI.");
  const ts = FieldValue.serverTimestamp();
  await ref.set({
    contacto: {
      email_personal: emailPer,
      telefono_celular: telefonoCel,
      telefono_fijo: telFijo,
      recibe_notificaciones_sms: cIn.recibe_notificaciones_sms === true,
    },
    domicilio: {
      calle, numero, piso, departamento: depto, codigo_postal, localidad_id, provincia_id, pais_id: null, referencia: refTxt,
    },
    onboarding_mvp: { paso_a: true, completado_paso_a_en: ts },
    actualizado_en: ts,
  }, { merge: true });
  return { ok: true, persona_id: pid };
});

const onboardingMvpDdjjFamiliar = onCall(async (request) => {
  const pid = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const familiares = Array.isArray(d.familiares) ? d.familiares : [];
  const out = [];
  for (const row of familiares) {
    if (!row || typeof row !== "object") continue;
    const n = typeof row.nombre === "string" ? row.nombre.trim() : "";
    const dniF = normalizeDni(row.dni);
    const parRaw = row.parentesco_id;
    if (!n || !/^\d{6,12}$/.test(dniF) || !parRaw) {
      throw new HttpsError("invalid-argument", "Cada familiar: nombre, DNI y parentesco son obligatorios.");
    }
    const parId = normalizeCatalogDocId(String(parRaw));
    if (!(await db.collection("cfg_parentesco").doc(parId).get()).exists) {
      throw new HttpsError("invalid-argument", "Parentesco inválido; elegí un valor de la lista.");
    }
    out.push({ nombre: n, dni: dniF, parentesco_id: parId });
  }
  const ref = db.collection(COL_PERSONAS).doc(pid);
  const ps = await ref.get();
  if (!ps.exists) throw new HttpsError("not-found", "Persona no encontrada.");
  assertPersonaMvpPendienteOnboarding(ps);
  const pDdj = ps.data() || {};
  const pMeta2 = pDdj.metadata || {};
  if (!pMeta2.auth_vinculado) throw new HttpsError("failed-precondition", "Primero completá el vínculo con tu DNI.");
  if (!(pDdj.onboarding_mvp && pDdj.onboarding_mvp.paso_a)) {
    throw new HttpsError("failed-precondition", "Completá el paso de contacto y domicilio primero.");
  }
  if (out.length < 1) throw new HttpsError("invalid-argument", "Declará al menos un integrante de grupo familiar.");
  await ref.update({
    "onboarding_mvp.paso_b": true,
    "onboarding_mvp.ddjj_familiares": out,
    "onboarding_mvp.completado_paso_b_en": FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  });
  return { ok: true, familiares_count: out.length };
});

const onboardingMvpCompletar = onCall(async (request) => {
  const pid = assertAgenteConPersonaId(request);
  const ref = db.collection(COL_PERSONAS).doc(pid);
  const ps = await ref.get();
  if (!ps.exists) throw new HttpsError("not-found", "Persona no encontrada.");
  const p0 = ps.data() || {};
  if (p0.estado && p0.estado !== "PENDIENTE_ONBOARDING") return { ok: true, alreadyDone: true, persona_id: pid };
  if (!(p0.metadata && p0.metadata.auth_vinculado)) throw new HttpsError("failed-precondition", "Cuenta no vinculada aún.");
  if (!(p0.onboarding_mvp && p0.onboarding_mvp.paso_a)) throw new HttpsError("failed-precondition", "Falta el paso A (datos de contacto y domicilio).");
  if (!(p0.onboarding_mvp && p0.onboarding_mvp.paso_b)) throw new HttpsError("failed-precondition", "Falta la DDJJ de grupo familiar (paso B).");
  const cSnap = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", pid).limit(2).get();
  if (cSnap.empty || cSnap.size > 1) throw new HttpsError("internal", "Cuenta no encontrada o duplicada.");
  const cr = cSnap.docs[0].ref;
  const cuentaId = cSnap.docs[0].id;
  const ts = FieldValue.serverTimestamp();
  await ref.set({ estado: ESTADO_ACTIVO_MVP, estado_perfil_datos_id: CFG_EPD_COMP, perfil_completitud_version: 1, actualizado_en: ts }, { merge: true });
  await cr.set({ estado_acceso: CFG_ECA_ACTIVO, actualizado_en: ts }, { merge: true });
  const uid = request.auth.uid;
  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  await auth.setCustomUserClaims(uid, { ...prev, persona_id: pid, cuenta_id: cuentaId });
  return { ok: true, persona_id: pid, cuenta_id: cuentaId };
});

module.exports = {
  vincularCuentaConDni,
  onboardingMvpPasoA,
  onboardingMvpDdjjFamiliar,
  onboardingMvpCompletar,
};

