"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewMotor");
const { PATRON_SALDO_B } = require("../../modules/shared/resolvePatronSaldo");
const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
  isPortalRoleUsuario,
} = require("../../modules/shared/solicitudElegibilidadLaboral");
const { loadHlcArray, patronFromVersion } = require("../../modules/shared/solicitudPatronBAltaMotor");

/** MVP slice 64-A — ampliar cuando haya más artículos Patrón B publicados. */
const ARTICULO_IDS_MVP = new Set(["art_01KRNK10V10CH7W5M2W6V558GS"]);

const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

const listarArticulosIngresoAgente = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (!isPortalRoleUsuario(request.auth.token)) {
    throw new HttpsError(
      "permission-denied",
      "Tu perfil de acceso al portal no puede listar artículos de ingreso como agente.",
    );
  }

  const personaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }

  const personaSnap = await db.collection("personas").doc(personaId).get();
  if (!personaSnap.exists) {
    throw new HttpsError("not-found", "La persona no existe.");
  }
  const persona = personaSnap.data() || {};
  const hlcArray = await loadHlcArray(db, personaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde);
  const diasExt = Number(persona.antiguedad_reconocida_dias);
  const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;

  const articulosSnap = await db.collection("cfg_articulos").get();
  /** @type {Array<object>} */
  const out = [];

  for (const artDoc of articulosSnap.docs) {
    const articuloId = artDoc.id;
    if (ARTICULO_IDS_MVP.size > 0 && !ARTICULO_IDS_MVP.has(articuloId)) continue;

    const verSnap = await db
      .collection("cfg_articulos")
      .doc(articuloId)
      .collection("versiones")
      .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
      .limit(1)
      .get();
    if (verSnap.empty) continue;

    const verDoc = verSnap.docs[0];
    const versionData = verDoc.data() || {};
    if (patronFromVersion(versionData) !== PATRON_SALDO_B) continue;

    const eleg = resolverElegibilidadSolicitud({
      versionData,
      hlcVigentes,
      personaId,
      fechaDesde,
      diasExternos: externos,
      authToken: request.auth.token,
    });
    if (!eleg.ok) continue;

    const core = artDoc.data() || {};
    out.push({
      articulo_id: articuloId,
      version_id: verDoc.id,
      codigo_grilla: String(core.codigo || core.nombre_corto || "").trim() || "ART",
      nombre: String(core.nombre || core.codigo || "").trim(),
      patron_saldo: PATRON_SALDO_B,
    });
  }

  return { articulos: out, fecha_desde: fechaDesde, persona_id: personaId };
});

module.exports = { listarArticulosIngresoAgente };
