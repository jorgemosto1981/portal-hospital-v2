import { doc, serverTimestamp, writeBatch } from "firebase/firestore";

import { db } from "../config/firebase.js";
import { generarCargoId, generarPersonaId } from "../utils/generarId.js";
import { horarioPlantillaOnboardingGenerico } from "./horarioPlantillaDefault.js";

/**
 * @typedef {Object} DatosLegajoInicial
 * @property {string} nombre
 * @property {string} apellido
 * @property {string} dni  Dígitos solamente (se normaliza en servicio).
 * @property {string} grupo_de_trabajo_id  FK `grupos_de_trabajo` (`gdt_*` o mock de prueba).
 */

/**
 * Crea en una sola transacción de batch el legajo en `personas` y el primer cargo en `historial_laboral_cargos`.
 * @param {DatosLegajoInicial} datosFormulario
 * @returns {Promise<{ ok: true, personaId: string, cargoId: string } | { ok: false, code: string, message: string }>}
 */
export async function crearLegajoInicial(datosFormulario) {
  const nombre = String(datosFormulario.nombre ?? "").trim();
  const apellido = String(datosFormulario.apellido ?? "").trim();
  const dni = String(datosFormulario.dni ?? "").replace(/\D/g, "");
  const grupoDeTrabajoId = String(datosFormulario.grupo_de_trabajo_id ?? "").trim();

  if (!nombre || !apellido || !dni || !grupoDeTrabajoId) {
    return { ok: false, code: "VALIDATION", message: "Completá nombre, apellido, DNI y grupo." };
  }

  const personaId = generarPersonaId();
  const cargoId = generarCargoId();

  const personaRef = doc(db, "personas", personaId);
  const cargoRef = doc(db, "historial_laboral_cargos", cargoId);

  const batch = writeBatch(db);

  batch.set(personaRef, {
    identidad: {
      nombre,
      apellido,
      dni,
    },
    metadata: {
      activo: true,
      created_at: serverTimestamp(),
    },
  });

  batch.set(cargoRef, {
    persona_id: personaId,
    grupo_de_trabajo_id: grupoDeTrabajoId,
    vigente_desde: serverTimestamp(),
    activo: true,
    horario_plantilla: horarioPlantillaOnboardingGenerico(),
  });

  try {
    await batch.commit();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al guardar en Firestore.";
    return { ok: false, code: "FIRESTORE", message };
  }

  return { ok: true, personaId, cargoId };
}
