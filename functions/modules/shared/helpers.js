"use strict";

const { createHash } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue, Timestamp } = require("./context");
const {
  COL_CFG_ROL,
  COL_RATE_LOGIN_DNI,
  COL_RATE_PRIMER_DNI,
  RATE_MAX,
  RATE_WINDOW_MS,
  MSG_LOGIN,
  MSG_REG_GENERICO,
  CFG_COLECCIONES_ONBOARDING_LECTURA,
  CFG_COLECCIONES_RRHH,
  ESTADO_PENDIENTE_ONBOARDING,
} = require("./constants");

function normalizeDni(raw) {
  if (raw == null) return "";
  return String(raw).replace(/\D/g, "");
}

function validEmail(s) {
  if (typeof s !== "string" || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * Misma política que assertRrhh: `portal_role` rrhh/admin o `perfil_rol_id` CFG_RRHH (HLc).
 * @param {unknown} token - `request.auth.token`
 */
function tokenHasRrhhAccess(token) {
  if (!token || typeof token !== "object") return false;
  const roleRaw = token.portal_role;
  const role = typeof roleRaw === "string" ? roleRaw.trim().toLowerCase() : "";
  if (role === "rrhh" || role === "admin") return true;
  const perfil = typeof token.perfil_rol_id === "string" ? token.perfil_rol_id.trim().toUpperCase() : "";
  return perfil === "CFG_RRHH";
}

function assertRrhh(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (tokenHasRrhhAccess(request.auth.token)) {
    return;
  }
  throw new HttpsError("permission-denied", "Solo personal autorizado (RRHH).");
}

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

function assertColeccionOnboardingLectura(collectionName) {
  if (
    typeof collectionName !== "string" ||
    !CFG_COLECCIONES_ONBOARDING_LECTURA.has(collectionName.trim())
  ) {
    throw new HttpsError("invalid-argument", "Colección de catálogo no permitida para este paso.");
  }
  return collectionName.trim();
}

function assertColeccionRrhh(collectionName) {
  if (typeof collectionName !== "string" || !CFG_COLECCIONES_RRHH.has(collectionName.trim())) {
    throw new HttpsError("invalid-argument", "Colección no permitida o inválida.");
  }
  return collectionName.trim();
}

function assertPersonaMvpPendienteOnboarding(snap) {
  const p = (snap && snap.data && snap.data()) || {};
  if (p.estado && p.estado !== ESTADO_PENDIENTE_ONBOARDING) {
    throw new HttpsError("failed-precondition", "El legajo no admite completar el onboarding (estado).");
  }
}

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

function serializeFirestoreValue(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "object" && v !== null && typeof v.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return v.map(serializeFirestoreValue);
  if (typeof v === "object" && v.constructor === Object) {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      o[k] = serializeFirestoreValue(val);
    }
    return o;
  }
  return v;
}

function toTimestampOrNull(input) {
  if (input == null || input === "") return null;
  if (typeof input !== "string") {
    throw new HttpsError("invalid-argument", "Formato de fecha no soportado.");
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new HttpsError("invalid-argument", "Fecha inválida.");
  }
  return Timestamp.fromDate(d);
}

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
    if (seen.has(id)) continue;
    seen.add(id);
    const snap = await db.collection(COL_CFG_ROL).doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", `Rol inexistente en catálogo: ${id} (cfg_rol).`);
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
    tx.set(ref, { attempts: recent, actualizado: FieldValue.serverTimestamp() }, { merge: true });
  });
}

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
    tx.set(ref, { attempts: recent, actualizado: FieldValue.serverTimestamp() }, { merge: true });
  });
}

module.exports = {
  normalizeDni,
  validEmail,
  tokenHasRrhhAccess,
  assertRrhh,
  assertAgenteConPersonaId,
  assertColeccionOnboardingLectura,
  assertColeccionRrhh,
  assertPersonaMvpPendienteOnboarding,
  normalizeCatalogDocId,
  serializeFirestoreValue,
  toTimestampOrNull,
  resolveRoleIdsRrhhAlta,
  checkRatePrimerDni,
  checkRateLoginDni,
};

