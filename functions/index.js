"use strict";

const { createHash } = require("node:crypto");

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

/** Región por defecto para nuevas funciones v2 (alinear con Firestore del hospital si aplica). */
setGlobalOptions({ region: "southamerica-east1" });

const COL_PERSONAS = "personas";
const COL_USUARIOS_CUENTA = "usuarios_cuenta";
const COL_EVENTOS = "eventos_ticket";
const COL_RATE_PRIMER_DNI = "_system_reg_primer_dni";
const COL_RATE_LOGIN_DNI = "_system_rate_login_dni";

const CFG_PEND_REG = "cfg_eca_pend_reg";
const CFG_ONB = "cfg_eca_onb";
const CFG_ECA_ACTIVO = "cfg_eca_activo";
const CFG_EPD_BORR = "cfg_epd_borr";
const CFG_EPD_COMP = "cfg_epd_comp";
const CFG_TEV_LOGIN = "cfg_tev_login";

const RATE_MAX = 7;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const MSG_REG_GENERICO = "No se pudo completar el registro.";

/** Flujo MVP pre-alta → vinculación → onboarding. */
const ESTADO_PENDIENTE_ONBOARDING = "PENDIENTE_ONBOARDING";
const ESTADO_ACTIVO_MVP = "ACTIVO";

const COL_GRUPOS_TRABAJO = "grupos_de_trabajo";
const COL_CFG_ROL = "cfg_rol";
const CFG_COLECCIONES_ONBOARDING_LECTURA = new Set([
  "cfg_provincia",
  "cfg_localidad",
  "cfg_parentesco",
  COL_GRUPOS_TRABAJO,
]);

function normalizeDni(raw) {
  if (raw == null) {
    return "";
  }
  return String(raw).replace(/\D/g, "");
}

function assertRrhh(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const role = request.auth.token && request.auth.token.portal_role;
  if (role !== "rrhh") {
    throw new HttpsError("permission-denied", "Solo personal autorizado (RRHH).");
  }
}

/**
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {string} persona_id desde custom claims
 */
function assertAgenteConPersonaId(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const pid = request.auth.token && request.auth.token.persona_id;
  if (typeof pid !== "string" || !pid.startsWith("per_")) {
    throw new HttpsError(
      "failed-precondition",
      "No hay persona vinculada. Ejecutá la vinculación por DNI o syncSessionClaims.",
    );
  }
  return pid;
}

/**
 * @param {string} collectionName
 * @returns {string}
 */
function assertColeccionOnboardingLectura(collectionName) {
  if (typeof collectionName !== "string" || !CFG_COLECCIONES_ONBOARDING_LECTURA.has(collectionName.trim())) {
    throw new HttpsError("invalid-argument", "Colección de catálogo no permitida para este paso.");
  }
  return collectionName.trim();
}

/**
 * @param {{ data: () => Record<string, unknown> | undefined }} snap
 */
function assertPersonaMvpPendienteOnboarding(snap) {
  const p = (snap && snap.data && snap.data()) || {};
  if (p.estado && p.estado !== ESTADO_PENDIENTE_ONBOARDING) {
    throw new HttpsError("failed-precondition", "El legajo no admite completar el onboarding (estado).");
  }
}

/** Colecciones de catálogo editables desde la app (alinear con `SECCIONES_CATALOGO_RRHH` en web). */
const CFG_COLECCIONES_RRHH = new Set([
  "cfg_rol",
  "cfg_estado_civil",
  "cfg_sexo_genero",
  "cfg_nacionalidad",
  "cfg_provincia",
  "cfg_localidad",
  "cfg_nivel_estudios",
  "cfg_parentesco",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_tipo_vinculo_laboral",
  "cfg_cargo_funcional",
  "grupos_de_trabajo",
  "cfg_efectores",
  "cfg_modalidad_jornada",
  "cfg_estado_asignacion_laboral",
  "cfg_causal_fin_asignacion_laboral",
  "cfg_tipo_acto_designacion",
  "cfg_tipo_grupo",
]);

/**
 * @param {unknown} collectionName
 * @returns {string}
 */
function assertColeccionRrhh(collectionName) {
  if (typeof collectionName !== "string" || !CFG_COLECCIONES_RRHH.has(collectionName.trim())) {
    throw new HttpsError("invalid-argument", "Colección no permitida o inválida.");
  }
  return collectionName.trim();
}

/**
 * Valida ids contra `cfg_rol` (activo, documento existente). Devuelve ids normalizados únicos.
 * @param {unknown} raw
 * @returns {Promise<string[]>}
 */
async function resolveRoleIdsRrhhAlta(raw) {
  if (raw == null) {
    throw new HttpsError("invalid-argument", "Debe indicarse al menos un rol (cfg_rol) en el alta.");
  }
  if (!Array.isArray(raw) || raw.length < 1) {
    throw new HttpsError("invalid-argument", "role_ids: enviá un arreglo con al menos un id de cfg_rol.");
  }
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) {
      throw new HttpsError("invalid-argument", "Cada rol debe ser un id de documento (cfg_rol) no vacío.");
    }
    const id = normalizeCatalogDocId(item);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const snap = await db.collection(COL_CFG_ROL).doc(id).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", `Rol inexistente en catálogo: ${id} (cfg_rol).`);
    }
    const d = snap.data() || {};
    if (d.activo === false) {
      throw new HttpsError("failed-precondition", `Rol dado de baja en catálogo: ${id}.`);
    }
    out.push(id);
  }
  if (out.length < 1) {
    throw new HttpsError("invalid-argument", "Al menos un id de cfg_rol válido y activo.");
  }
  return out;
}

/**
 * @param {unknown} v
 * @returns {unknown}
 */
function serializeFirestoreValue(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "object" && v !== null && typeof v.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) {
    return v.map(serializeFirestoreValue);
  }
  if (typeof v === "object" && v.constructor === Object) {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      o[k] = serializeFirestoreValue(val);
    }
    return o;
  }
  return v;
}

/**
 * @param {string} id
 */
function normalizeCatalogDocId(id) {
  if (typeof id !== "string" || !id.trim()) {
    throw new HttpsError("invalid-argument", "El id es obligatorio.");
  }
  const u = id.trim().toUpperCase();
  if (u.length > 240) {
    throw new HttpsError("invalid-argument", "El id es demasiado largo.");
  }
  if (!/^[A-Z0-9_]+$/.test(u)) {
    throw new HttpsError(
      "invalid-argument",
      "El id solo puede contener letras (A–Z), números y guiones bajos.",
    );
  }
  return u;
}

/**
 * ISO string o null → Timestamp Firestore o null.
 * @param {unknown} input
 */
function toTimestampOrNull(input) {
  if (input == null || input === "") {
    return null;
  }
  if (typeof input !== "string") {
    throw new HttpsError("invalid-argument", "Formato de fecha no soportado.");
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new HttpsError("invalid-argument", "Fecha inválida.");
  }
  return Timestamp.fromDate(d);
}

/**
 * Rate limit en Firestore (Admin). Colección privada; reglas default deny.
 * @param {string} normalizedDni
 */
async function checkRatePrimerDni(normalizedDni) {
  const h = createHash("sha256").update(normalizedDni).digest("hex");
  const ref = db.collection(COL_RATE_PRIMER_DNI).doc(h);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const attempts = Array.isArray(data.attempts) ? data.attempts : [];
    const recent = attempts.filter((t) => typeof t === "number" && now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      throw new HttpsError("resource-exhausted", MSG_REG_GENERICO);
    }
    recent.push(now);
    tx.set(
      ref,
      { attempts: recent, actualizado: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
}

function validEmail(s) {
  if (typeof s !== "string" || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

const MSG_LOGIN = "No se pudo iniciar sesión. Verificá DNI y PIN.";

/**
 * Rate limit independiente al de registro (colección distinta).
 * @param {string} normalizedDni
 */
async function checkRateLoginDni(normalizedDni) {
  const h = createHash("sha256").update(`login_dni:${normalizedDni}`).digest("hex");
  const ref = db.collection(COL_RATE_LOGIN_DNI).doc(h);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const attempts = Array.isArray(data.attempts) ? data.attempts : [];
    const recent = attempts.filter((t) => typeof t === "number" && now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      throw new HttpsError("resource-exhausted", MSG_LOGIN);
    }
    recent.push(now);
    tx.set(
      ref,
      { attempts: recent, actualizado: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
}

/**
 * Resuelve el email de login a partir del DNI (sin enumerar detalles).
 * El cliente hace luego `signInWithEmailAndPassword(email, pin)` — MODULO_LOGIN_V2 §1.1, §1.3.
 */
exports.resolverEmailLoginDni = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  if (!/^\d{6,12}$/.test(dni)) {
    throw new HttpsError("invalid-argument", MSG_LOGIN);
  }
  await checkRateLoginDni(dni);
  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (psn.size > 1) {
    throw new HttpsError("internal", MSG_LOGIN);
  }
  const personaId = psn.docs[0].id;
  const cSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("persona_id", "==", personaId)
    .limit(2)
    .get();
  if (cSnap.empty) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (cSnap.size > 1) {
    throw new HttpsError("internal", MSG_LOGIN);
  }
  const cu = cSnap.docs[0].data() || {};
  const uname = cu.username && String(cu.username).trim();
  if (!uname || !validEmail(uname) || !cu.auth_uid) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (cu.activo === false) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (cu.estado_acceso === CFG_PEND_REG) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  return { email: uname.toLowerCase() };
});

/** Comprobación de despliegue / emulador (sin auth). */
exports.healthV2 = onCall(async () => ({
  ok: true,
  proyecto: process.env.GCLOUD_PROJECT || null,
  ts: new Date().toISOString(),
}));

/**
 * Sincroniza custom claims (`persona_id`, `cuenta_id`) desde `usuarios_cuenta` según `MODULO_LOGIN_V2` §3.3.
 * Conserva otras claims (p. ej. `portal_role: "rrhh"`) al fusionar.
 */
exports.syncSessionClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const uid = request.auth.uid;

  const snap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("auth_uid", "==", uid)
    .limit(2)
    .get();

  if (snap.empty) {
    throw new HttpsError(
      "not-found",
      "No hay usuarios_cuenta vinculado a este usuario de Auth. Completá el paso B o verificá datos.",
    );
  }

  if (snap.size > 1) {
    throw new HttpsError(
      "internal",
      "Inconsistencia: más de un usuarios_cuenta con el mismo auth_uid.",
    );
  }

  const udoc = snap.docs[0];
  const cuentaId = udoc.id;
  const data = udoc.data() || {};
  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";

  if (!personaId) {
    throw new HttpsError(
      "failed-precondition",
      "La cuenta no tiene persona_id; no se pueden establecer claims.",
    );
  }

  if (data.auth_uid !== uid) {
    throw new HttpsError("internal", "auth_uid del documento no coincide con la sesión.");
  }

  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  await auth.setCustomUserClaims(uid, {
    ...prev,
    persona_id: personaId,
    cuenta_id: cuentaId,
  });

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
  };
});

/**
 * Paso A (RRHH): alta mínima `personas` + `usuarios_cuenta` en pendiente de registro.
 * `data.role_ids`: arreglo de ids de `cfg_rol` (mínimo 1) — queda en `usuarios_cuenta.role_ids`.
 * Requiere `request.auth.token.portal_role === "rrhh"` (asignar vía consola/Admin o script en staging).
 * @see MODULO_DATOS_PERSONALES_V2.md §1.2 paso A, MODULO_LOGIN_V2 §4.1, `cfg_rol` en MODULO_CONFIGURACION_V2
 */
exports.rrhhAltaAgente = onCall(async (request) => {
  assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const apellido = typeof d.apellido === "string" ? d.apellido.trim() : "";
  const grupoId =
    typeof d.grupo_de_trabajo_id === "string" ? d.grupo_de_trabajo_id.trim() : "";
  const njRaw = d.nivel_jerarquico;
  const nivelJerarquico = typeof njRaw === "number" ? njRaw : parseInt(String(njRaw), 10);

  if (!/^\d{6,12}$/.test(dni)) {
    throw new HttpsError("invalid-argument", "DNI inválido (usá solo dígitos, 6–12).");
  }
  if (!nombre || !apellido) {
    throw new HttpsError("invalid-argument", "Nombre y apellido son obligatorios.");
  }
  if (!grupoId) {
    throw new HttpsError("invalid-argument", "Seleccioná un grupo de trabajo.");
  }
  if (!Number.isInteger(nivelJerarquico) || nivelJerarquico < 1 || nivelJerarquico > 99) {
    throw new HttpsError("invalid-argument", "El nivel jerárquico debe ser un entero entre 1 y 99.");
  }

  const gref = db.collection(COL_GRUPOS_TRABAJO).doc(grupoId);
  if (!(await gref.get()).exists) {
    throw new HttpsError("not-found", "El grupo de trabajo no existe o fue dado de baja.");
  }

  const roleIds = await resolveRoleIdsRrhhAlta(d.role_ids);

  const q = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(3).get();
  if (!q.empty) {
    throw new HttpsError("already-exists", "Ya existe una persona con ese DNI.");
  }

  const perId = `per_${ulid()}`;
  const usrId = `usr_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(
    db.collection(COL_PERSONAS).doc(perId),
    {
      persona_id: perId,
      dni,
      nombre,
      apellido,
      estado: ESTADO_PENDIENTE_ONBOARDING,
      /** Pre-asignación MVP: el vínculo operativo HLG queda en fase laboral posterior. */
      grupo_de_trabajo_id: grupoId,
      nivel_jerarquico: nivelJerarquico,
      activo: true,
      schema_version: 1,
      estado_perfil_datos_id: CFG_EPD_BORR,
      perfil_completitud_version: 0,
      metadata: {
        prealta_mvp: true,
      },
      creado_en: ts,
      actualizado_en: ts,
    },
    { merge: false },
  );
  batch.set(
    db.collection(COL_USUARIOS_CUENTA).doc(usrId),
    {
      persona_id: perId,
      auth_uid: null,
      auth_proveedor_id: null,
      username: null,
      activo: true,
      estado_acceso: CFG_PEND_REG,
      role_ids: roleIds,
      creado_en: ts,
      actualizado_en: ts,
    },
    { merge: false },
  );
  await batch.commit();
  return { ok: true, persona_id: perId, cuenta_id: usrId };
});

/**
 * Paso B: DNI + email + PIN 6; crea Auth, actualiza `usuarios_cuenta`, claims, evento mínimo.
 * Callable sin exigir sesión del agente (DNI+datos en `data`). Mensajes de fallo genéricos (anti enumeración).
 * @see MODULO_LOGIN_V2 §1.1, §4.2, FLUJO_V2 §6
 */
exports.registrarPrimerAcceso = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const email = typeof d.email === "string" ? d.email.trim() : "";
  const pin = typeof d.pin === "string" ? d.pin.trim() : "";

  if (!/^\d{6,12}$/.test(dni) || !validEmail(email) || !/^\d{6}$/.test(pin)) {
    throw new HttpsError("invalid-argument", MSG_REG_GENERICO);
  }

  const emailNorm = email.toLowerCase();

  await checkRatePrimerDni(dni);

  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (psn.size > 1) {
    console.error("registrarPrimerAcceso: múltiples persona con mismo dni", dni);
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const personaId = psn.docs[0].id;
  const personaPData = psn.docs[0].data() || {};
  if (personaPData.estado && personaPData.estado !== ESTADO_PENDIENTE_ONBOARDING) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  const personaRef = psn.docs[0].ref;

  const cSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("persona_id", "==", personaId)
    .limit(2)
    .get();
  if (cSnap.empty) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (cSnap.size > 1) {
    console.error("registrarPrimerAcceso: múltiples cuentas para persona", personaId);
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const cuentaRef = cSnap.docs[0].ref;
  const cuentaId = cSnap.docs[0].id;
  const cu = cSnap.docs[0].data() || {};

  if (cu.auth_uid) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (cu.username != null && String(cu.username).trim() !== "") {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (cu.estado_acceso !== CFG_PEND_REG) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }

  try {
    await auth.getUserByEmail(emailNorm);
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  } catch (e) {
    if (e instanceof HttpsError) {
      throw e;
    }
    if (e && e.code === "auth/user-not-found") {
      // correo libre
    } else {
      throw new HttpsError("internal", MSG_REG_GENERICO);
    }
  }

  let newUid;
  try {
    const rec = await auth.createUser({
      email: emailNorm,
      password: pin,
      emailVerified: false,
    });
    newUid = rec.uid;
  } catch (e) {
    if (e && e.code === "auth/email-already-exists") {
      throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
    }
    console.error("registrarPrimerAcceso createUser", e);
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const evtId = `evt_${ulid()}`;

  try {
    await db.runTransaction(async (tx) => {
      const cRead = await tx.get(cuentaRef);
      const cData = cRead.data() || {};
      if (cData.auth_uid) {
        throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
      }
      const pCheck = await tx.get(personaRef);
      const p0 = pCheck.data() || {};
      if (p0.estado && p0.estado !== ESTADO_PENDIENTE_ONBOARDING) {
        throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
      }
      tx.set(
        cuentaRef,
        {
          auth_uid: newUid,
          username: emailNorm,
          estado_acceso: CFG_ONB,
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.update(personaRef, {
        "metadata.auth_vinculado": true,
        "metadata.vinculado_en": FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      tx.set(
        db.collection(COL_EVENTOS).doc(evtId),
        {
          tipo_evento_id: CFG_TEV_LOGIN,
          persona_id: personaId,
          cuenta_id: cuentaId,
          ocurrido_en: FieldValue.serverTimestamp(),
          payload: { fase: "B", motivo: "registro_primer_acceso" },
        },
        { merge: false },
      );
    });
  } catch (e) {
    try {
      await auth.deleteUser(newUid);
    } catch (del) {
      console.error("registrarPrimerAcceso: txn falló, deleteUser", del);
    }
    if (e instanceof HttpsError) {
      throw e;
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  let userAfter;
  try {
    userAfter = await auth.getUser(newUid);
  } catch (e) {
    const rev = db.batch();
    rev.update(cuentaRef, {
      auth_uid: null,
      username: null,
      estado_acceso: CFG_PEND_REG,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    rev.delete(db.collection(COL_EVENTOS).doc(evtId));
    await rev.commit();
    try {
      await auth.deleteUser(newUid);
    } catch (del) {
      console.error("registrarPrimerAcceso: getUser falló, rollback", del);
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const prev = userAfter.customClaims && typeof userAfter.customClaims === "object" ? { ...userAfter.customClaims } : {};
  try {
    await auth.setCustomUserClaims(newUid, {
      ...prev,
      persona_id: personaId,
      cuenta_id: cuentaId,
    });
  } catch (claimErr) {
    console.error("registrarPrimerAcceso setCustomUserClaims", claimErr);
    const rev = db.batch();
    rev.update(cuentaRef, {
      auth_uid: null,
      username: null,
      estado_acceso: CFG_PEND_REG,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    rev.delete(db.collection(COL_EVENTOS).doc(evtId));
    await rev.commit();
    try {
      await auth.deleteUser(newUid);
    } catch (del) {
      console.error("registrarPrimerAcceso: rollback deleteUser (claims)", del);
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
  };
});

/**
 * RRHH: lista todos los documentos de una colección de configuración (incluye inactivos).
 */
exports.listarColeccion = onCall(async (request) => {
  assertRrhh(request);
  const col = assertColeccionRrhh(request.data && request.data.collectionName);
  const snap = await db.collection(col).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const flat = serializeFirestoreValue(data);
    const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { ...base, id: doc.id };
  });
  return { items };
});

/**
 * RRHH: alta/edición de un valor de catálogo (`set` con merge). El id se normaliza a MAYÚSCULAS.
 */
exports.guardarOpcion = onCall(async (request) => {
  assertRrhh(request);
  const col = assertColeccionRrhh(request.data && request.data.collectionName);
  const datos =
    request.data && request.data.datos && typeof request.data.datos === "object"
      ? request.data.datos
      : {};

  const id = normalizeCatalogDocId(datos.id);
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio.");
  }

  const activo = datos.activo !== false;

  const ref = db.collection(col).doc(id);
  const exists = (await ref.get()).exists;

  const payload = {
    id,
    nombre,
    activo,
    actualizado_en: FieldValue.serverTimestamp(),
  };

  if ("vigente_desde" in datos) {
    payload.vigente_desde =
      datos.vigente_desde == null || datos.vigente_desde === ""
        ? null
        : toTimestampOrNull(datos.vigente_desde);
  }
  if ("vigente_hasta" in datos) {
    payload.vigente_hasta =
      datos.vigente_hasta == null || datos.vigente_hasta === ""
        ? null
        : toTimestampOrNull(datos.vigente_hasta);
  }

  if (!exists) {
    payload.creado_en = FieldValue.serverTimestamp();
  }

  if (col === "cfg_localidad" && "provincia_id" in datos) {
    const raw = datos.provincia_id;
    if (raw == null || raw === "") {
      payload.provincia_id = null;
    } else {
      if (typeof raw !== "string") {
        throw new HttpsError("invalid-argument", "provincia_id debe ser texto o vacío.");
      }
      payload.provincia_id = normalizeCatalogDocId(raw);
    }
  }

  await ref.set(payload, { merge: true });
  return { ok: true, id };
});

/**
 * Catálogos de lectura para autocompletar onboarding (autenticado, sin rol RRHH).
 * Complementa `listarColeccion` (solo RRHH).
 */
exports.listarCatalogoOnboarding = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const col = assertColeccionOnboardingLectura(request.data && request.data.collectionName);
  const snap = await db.collection(col).get();
  const items = snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      if (Object.hasOwn(data, "activo") && data.activo === false) {
        return null;
      }
      const flat = serializeFirestoreValue(data);
      const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
      return { ...base, id: doc.id };
    })
    .filter(Boolean);
  return { items };
});

/**
 * Post-registro en el cliente: vincular Auth existente a `usuarios_cuenta` con DNI en PENDIENTE_ONBOARDING.
 * Distinto de `registrarPrimerAcceso` (crea el usuario de Auth en servidor).
 */
exports.vincularCuentaConDni = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para vincularte.");
  }
  const uid = request.auth.uid;
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  if (!/^\d{6,12}$/.test(dni)) {
    throw new HttpsError("invalid-argument", "DNI inválido (6 a 12 dígitos).");
  }

  const uAuth = await auth.getUser(uid);
  const emailNorm = (uAuth.email || "").trim().toLowerCase();
  if (!uAuth.email || !validEmail(uAuth.email)) {
    throw new HttpsError("failed-precondition", "Hace falta un email válido en la cuenta (Firebase Auth).");
  }

  const yaSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("auth_uid", "==", uid)
    .limit(2)
    .get();
  if (!yaSnap.empty) {
    if (yaSnap.size > 1) {
      throw new HttpsError("internal", "Más de una fila con el mismo auth_uid.");
    }
    const doc0 = yaSnap.docs[0];
    const pSnap = await db
      .collection(COL_PERSONAS)
      .doc(String(doc0.data() && doc0.data().persona_id))
      .get();
    if (pSnap.exists) {
      const pD = pSnap.data() || {};
      if (normalizeDni(pD.dni) === dni) {
        return {
          ok: true,
          persona_id: pSnap.id,
          cuenta_id: doc0.id,
          alreadyLinked: true,
        };
      }
    }
    throw new HttpsError("failed-precondition", "Esta sesión ya está vinculada a otra identidad digital.");
  }

  const emailDup = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("username", "==", emailNorm)
    .limit(2)
    .get();
  if (!emailDup.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Ese email ya se usa con otra cuenta. Probá con otro correo o usá el flujo de inicio con DNI+PIN asignado.",
    );
  }

  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) {
    throw new HttpsError("not-found", "No hay un legajo pre-registrado con ese DNI.");
  }
  if (psn.size > 1) {
    throw new HttpsError("internal", "Inconsistencia: más de una persona con el mismo DNI.");
  }
  const pDoc = psn.docs[0];
  const personaId = pDoc.id;
  const pData = pDoc.data() || {};
  if (pData.estado && pData.estado !== ESTADO_PENDIENTE_ONBOARDING) {
    throw new HttpsError(
      "failed-precondition",
      "Ese DNI no está en fase de primer vínculo o el legajo ya se activó.",
    );
  }

  const cSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("persona_id", "==", personaId)
    .limit(2)
    .get();
  if (cSnap.empty) {
    throw new HttpsError("failed-precondition", "No se encontró la cuenta vinculada a ese DNI (contactá a RRHH).");
  }
  if (cSnap.size > 1) {
    throw new HttpsError("internal", "Cuenta duplicada para la misma persona.");
  }
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

  try {
    await db.runTransaction(async (tx) => {
      const cR = await tx.get(cuentaRef);
      const c0 = cR.data() || {};
      if (c0.auth_uid && c0.auth_uid !== uid) {
        throw new HttpsError("failed-precondition", "La cuenta se actualizó mientras tanto; reintentá.");
      }
      tx.set(
        cuentaRef,
        {
          auth_uid: uid,
          username: emailNorm,
          estado_acceso: CFG_ONB,
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.update(personaRef, {
        "metadata.auth_vinculado": true,
        "metadata.vinculado_en": FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      tx.set(
        db.collection(COL_EVENTOS).doc(evtId),
        {
          tipo_evento_id: CFG_TEV_LOGIN,
          persona_id: personaId,
          cuenta_id: cuentaId,
          ocurrido_en: FieldValue.serverTimestamp(),
          payload: { fase: "B", motivo: "vincularCuentaConDni" },
        },
        { merge: false },
      );
    });
  } catch (e) {
    if (e instanceof HttpsError) {
      throw e;
    }
    console.error("vincularCuentaConDni: transacción", e);
    throw new HttpsError("internal", "No se pudo vincular la cuenta.");
  }

  const userAfter = await auth.getUser(uid);
  const prev = userAfter.customClaims && typeof userAfter.customClaims === "object" ? { ...userAfter.customClaims } : {};
  try {
    await auth.setCustomUserClaims(uid, {
      ...prev,
      persona_id: personaId,
      cuenta_id: cuentaId,
    });
  } catch (e) {
    console.error("vincularCuentaConDni: setCustomUserClaims", e);
    throw new HttpsError("internal", "Cuenta vinculada pero no se actualizaron los claims; llamá a syncSessionClaims en soporte.");
  }

  return { ok: true, persona_id: personaId, cuenta_id: cuentaId };
});

/**
 * Database-First: mapea `personas.contacto` y `personas.domicilio` (V2) sin texto libre para catálogos.
 * - Si en el futuro hace falta "tipo de domicilio" (calle legal vs. real), añadir colección `cfg_tipo_domicilio`
 *   (id, nombre, activo) y el campo `domicilio.tipo_domicilio_id` — no implementado aún a propósito.
 */
exports.onboardingMvpPasoA = onCall(async (request) => {
  const pid = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const cIn = d.contacto && typeof d.contacto === "object" ? d.contacto : {};
  const domIn = d.domicilio && typeof d.domicilio === "object" ? d.domicilio : {};

  const telefonoCel = typeof cIn.telefono_celular === "string" ? cIn.telefono_celular.trim() : "";
  const emailPer = cIn.email_personal == null || cIn.email_personal === ""
    ? null
    : String(cIn.email_personal).trim().toLowerCase();
  if (emailPer && !validEmail(emailPer)) {
    throw new HttpsError("invalid-argument", "Email personal inválido.");
  }
  if (telefonoCel.length < 6) {
    throw new HttpsError("invalid-argument", "Ingresá un teléfono móvil de contacto válido.");
  }

  const calle = typeof domIn.calle === "string" ? domIn.calle.trim() : "";
  const numero = typeof domIn.numero === "string" ? domIn.numero.trim() : "";
  const codigo_postal = typeof domIn.codigo_postal === "string" ? domIn.codigo_postal.trim() : "";
  const provinciaRaw = domIn.provincia_id == null || domIn.provincia_id === "" ? null : String(domIn.provincia_id);
  const localidadRaw = domIn.localidad_id == null || domIn.localidad_id === "" ? null : String(domIn.localidad_id);

  if (!calle || !numero || !codigo_postal) {
    throw new HttpsError("invalid-argument", "Completá calle, altura y código postal.");
  }
  if (!provinciaRaw || !localidadRaw) {
    throw new HttpsError("invalid-argument", "Seleccioná provincia y localidad.");
  }
  const provincia_id = normalizeCatalogDocId(provinciaRaw);
  const localidad_id = normalizeCatalogDocId(localidadRaw);

  const provRef = db.collection("cfg_provincia").doc(provincia_id);
  if (!(await provRef.get()).exists) {
    throw new HttpsError("invalid-argument", "La provincia seleccionada no existe en catálogo.");
  }
  const locRef = db.collection("cfg_localidad").doc(localidad_id);
  const locSnap = await locRef.get();
  if (!locSnap.exists) {
    throw new HttpsError("invalid-argument", "La localidad seleccionada no existe en catálogo.");
  }
  const locData = locSnap.data() || {};
  if (locData.provincia_id) {
    const locProv = normalizeCatalogDocId(String(locData.provincia_id));
    if (locProv !== provincia_id) {
      throw new HttpsError("invalid-argument", "Localidad y provincia no corresponden.");
    }
  }

  const piso = domIn.piso == null || domIn.piso === "" ? null : String(domIn.piso).trim();
  const depto = domIn.departamento == null || domIn.departamento === "" ? null : String(domIn.departamento).trim();
  const refTxt = domIn.referencia == null || domIn.referencia === "" ? null : String(domIn.referencia).trim();
  const telFijo = cIn.telefono_fijo == null || cIn.telefono_fijo === "" ? null : String(cIn.telefono_fijo).trim();

  const ref = db.collection(COL_PERSONAS).doc(pid);
  const ps = await ref.get();
  if (!ps.exists) {
    throw new HttpsError("not-found", "Persona no encontrada.");
  }
  assertPersonaMvpPendienteOnboarding(ps);
  const pMeta = (ps.data() && ps.data().metadata) || {};
  if (!pMeta.auth_vinculado) {
    throw new HttpsError("failed-precondition", "Primero completá el vínculo con tu DNI.");
  }

  const contacto = {
    email_personal: emailPer,
    telefono_celular: telefonoCel,
    telefono_fijo: telFijo,
    recibe_notificaciones_sms: cIn.recibe_notificaciones_sms === true,
  };

  const domicilio = {
    calle,
    numero,
    piso,
    departamento: depto,
    codigo_postal,
    localidad_id,
    provincia_id,
    pais_id: null,
    referencia: refTxt,
  };

  const ts = FieldValue.serverTimestamp();
  await ref.set(
    {
      contacto,
      domicilio,
      onboarding_mvp: {
        paso_a: true,
        completado_paso_a_en: ts,
      },
      actualizado_en: ts,
    },
    { merge: true },
  );

  return { ok: true, persona_id: pid };
});

/** DDJJ familiar MVP: reutiliza `cfg_parentesco` (sin nuevos `cfg_*` adicionales). */
exports.onboardingMvpDdjjFamiliar = onCall(async (request) => {
  const pid = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const familiares = Array.isArray(d.familiares) ? d.familiares : [];

  const out = [];
  for (const row of familiares) {
    if (!row || typeof row !== "object") {
      continue;
    }
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
  if (!ps.exists) {
    throw new HttpsError("not-found", "Persona no encontrada.");
  }
  assertPersonaMvpPendienteOnboarding(ps);
  const pDdj = ps.data() || {};
  const pMeta2 = pDdj.metadata || {};
  if (!pMeta2.auth_vinculado) {
    throw new HttpsError("failed-precondition", "Primero completá el vínculo con tu DNI.");
  }
  if (!(pDdj.onboarding_mvp && pDdj.onboarding_mvp.paso_a)) {
    throw new HttpsError("failed-precondition", "Completá el paso de contacto y domicilio primero.");
  }
  if (out.length < 1) {
    throw new HttpsError("invalid-argument", "Declará al menos un integrante de grupo familiar.");
  }

  const ts = FieldValue.serverTimestamp();
  await ref.update({
    "onboarding_mvp.paso_b": true,
    "onboarding_mvp.ddjj_familiares": out,
    "onboarding_mvp.completado_paso_b_en": ts,
    actualizado_en: ts,
  });
  return { ok: true, familiares_count: out.length };
});

/** Cierre: perfil mínimo → ACTIVO + `cfg_eca_activo` y `cfg_epd_comp` (MVP fase 1). */
exports.onboardingMvpCompletar = onCall(async (request) => {
  const pid = assertAgenteConPersonaId(request);
  const ref = db.collection(COL_PERSONAS).doc(pid);
  const ps = await ref.get();
  if (!ps.exists) {
    throw new HttpsError("not-found", "Persona no encontrada.");
  }
  const p0 = ps.data() || {};
  if (p0.estado && p0.estado !== ESTADO_PENDIENTE_ONBOARDING) {
    return { ok: true, alreadyDone: true, persona_id: pid };
  }
  if (!(p0.metadata && p0.metadata.auth_vinculado)) {
    throw new HttpsError("failed-precondition", "Cuenta no vinculada aún.");
  }
  if (!(p0.onboarding_mvp && p0.onboarding_mvp.paso_a)) {
    throw new HttpsError("failed-precondition", "Falta el paso A (datos de contacto y domicilio).");
  }
  if (!(p0.onboarding_mvp && p0.onboarding_mvp.paso_b)) {
    throw new HttpsError("failed-precondition", "Falta la DDJJ de grupo familiar (paso B).");
  }

  const cSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("persona_id", "==", pid)
    .limit(2)
    .get();
  if (cSnap.empty || cSnap.size > 1) {
    throw new HttpsError("internal", "Cuenta no encontrada o duplicada.");
  }
  const cr = cSnap.docs[0].ref;
  const cuentaId = cSnap.docs[0].id;
  const ts = FieldValue.serverTimestamp();

  await ref.set(
    {
      estado: ESTADO_ACTIVO_MVP,
      estado_perfil_datos_id: CFG_EPD_COMP,
      perfil_completitud_version: 1,
      actualizado_en: ts,
    },
    { merge: true },
  );
  await cr.set(
    {
      estado_acceso: CFG_ECA_ACTIVO,
      actualizado_en: ts,
    },
    { merge: true },
  );

  const uid = request.auth.uid;
  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  await auth.setCustomUserClaims(uid, {
    ...prev,
    persona_id: pid,
    cuenta_id: cuentaId,
  });

  return { ok: true, persona_id: pid, cuenta_id: cuentaId };
});
