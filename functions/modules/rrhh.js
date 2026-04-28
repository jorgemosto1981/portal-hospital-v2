"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { db, FieldValue } = require("./shared/context");
const {
  CFG_EPD_BORR,
  CFG_PEND_REG,
  COL_GRUPOS_TRABAJO,
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  ESTADO_PENDIENTE_ONBOARDING,
} = require("./shared/constants");
const { assertRrhh, normalizeDni, resolveRoleIdsRrhhAlta } = require("./shared/helpers");

const rrhhAltaAgente = onCall(async (request) => {
  assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const apellido = typeof d.apellido === "string" ? d.apellido.trim() : "";
  const grupoId = typeof d.grupo_de_trabajo_id === "string" ? d.grupo_de_trabajo_id.trim() : "";
  const njRaw = d.nivel_jerarquico;
  const nivelJerarquico = typeof njRaw === "number" ? njRaw : parseInt(String(njRaw), 10);

  if (!/^\d{6,12}$/.test(dni)) throw new HttpsError("invalid-argument", "DNI inválido (usá solo dígitos, 6–12).");
  if (!nombre || !apellido) throw new HttpsError("invalid-argument", "Nombre y apellido son obligatorios.");
  if (!grupoId) throw new HttpsError("invalid-argument", "Seleccioná un grupo de trabajo.");
  if (!Number.isInteger(nivelJerarquico) || nivelJerarquico < 1 || nivelJerarquico > 99) {
    throw new HttpsError("invalid-argument", "El nivel jerárquico debe ser un entero entre 1 y 99.");
  }

  const gref = db.collection(COL_GRUPOS_TRABAJO).doc(grupoId);
  if (!(await gref.get()).exists) {
    throw new HttpsError("not-found", "El grupo de trabajo no existe o fue dado de baja.");
  }
  const roleIds = await resolveRoleIdsRrhhAlta(d.role_ids);
  const q = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(3).get();
  if (!q.empty) throw new HttpsError("already-exists", "Ya existe una persona con ese DNI.");

  const perId = `per_${ulid()}`;
  const usrId = `usr_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection(COL_PERSONAS).doc(perId), {
    persona_id: perId,
    dni,
    nombre,
    apellido,
    estado: ESTADO_PENDIENTE_ONBOARDING,
    grupo_de_trabajo_id: grupoId,
    nivel_jerarquico: nivelJerarquico,
    activo: true,
    schema_version: 1,
    estado_perfil_datos_id: CFG_EPD_BORR,
    perfil_completitud_version: 0,
    metadata: { prealta_mvp: true },
    creado_en: ts,
    actualizado_en: ts,
  });
  batch.set(db.collection(COL_USUARIOS_CUENTA).doc(usrId), {
    persona_id: perId,
    auth_uid: null,
    auth_proveedor_id: null,
    username: null,
    activo: true,
    estado_acceso: CFG_PEND_REG,
    role_ids: roleIds,
    creado_en: ts,
    actualizado_en: ts,
  });
  await batch.commit();
  return { ok: true, persona_id: perId, cuenta_id: usrId };
});

module.exports = {
  rrhhAltaAgente,
};

