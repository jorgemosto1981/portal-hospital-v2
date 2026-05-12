/**
 * Escrituras mínimas en `solicitudes_articulo` (V2).
 * @see web/src/services/firebase.js — dbV2
 */
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ulid } from "ulid";

import { ESTADO_SOLICITUD_ARTICULO_BORRADOR } from "../constants/solicitudesArticuloV2.js";
import { dbV2 } from "./firebase.js";

const SOL_ULID_RE = /^sol_[0-9A-HJKMNP-TV-Z]{26}$/i;

/**
 * Crea solicitud LAO en estado BORRADOR (el trigger del backend valida y cambia estado).
 * @param {{
 *   personaId: string,
 *   articuloId: string,
 *   versionAplicadaId: string,
 *   fechaDesde: string,
 *   anioOrigenBolsa: number,
 * }} params
 * @returns {Promise<{ solicitud_id: string }>}
 */
export async function crearSolicitudArticuloLaoBorrador(params) {
  const personaId = String(params.personaId || "").trim();
  const articuloId = String(params.articuloId || "").trim();
  const versionAplicadaId = String(params.versionAplicadaId || "").trim();
  const fechaDesde = String(params.fechaDesde || "").trim().slice(0, 10);
  const anioOrigenBolsa = Number(params.anioOrigenBolsa);

  if (!/^per_/i.test(personaId)) {
    throw new Error("persona_id inválido.");
  }
  if (!/^art_/i.test(articuloId)) {
    throw new Error("articulo_id inválido.");
  }
  if (!/^ver_/i.test(versionAplicadaId)) {
    throw new Error("version_aplicada inválida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
    throw new Error("fecha_desde inválida.");
  }
  if (!Number.isInteger(anioOrigenBolsa) || anioOrigenBolsa < 1900) {
    throw new Error("anio_origen_bolsa inválido.");
  }

  const solicitud_id = `sol_${ulid()}`;
  if (!SOL_ULID_RE.test(solicitud_id)) {
    throw new Error("No se pudo generar solicitud_id.");
  }

  const ref = doc(dbV2, "solicitudes_articulo", solicitud_id);
  await setDoc(ref, {
    articulo_id: articuloId,
    titular_persona_id: personaId,
    actor_alta_persona_id: personaId,
    version_aplicada: versionAplicadaId,
    fecha_desde: fechaDesde,
    anio_origen_bolsa: anioOrigenBolsa,
    estado_solicitud_id: ESTADO_SOLICITUD_ARTICULO_BORRADOR,
    schema_version: 1,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });

  return { solicitud_id };
}
