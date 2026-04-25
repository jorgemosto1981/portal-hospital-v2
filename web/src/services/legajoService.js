import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../config/firebase.js";

/** @param {unknown} v */
function msVigente(v) {
  if (v && typeof v === "object" && "toMillis" in v && typeof v.toMillis === "function") {
    return v.toMillis();
  }
  return 0;
}

/**
 * Índice compuesto típico en Firestore: `historial_laboral_cargos` con
 * `persona_id` (Ascending) + `activo` (Ascending).
 * Si falla la query, la consola de Firebase sugiere el enlace para crearlo.
 */

/**
 * @typedef {Object} LegajoFirestore
 * @property {string} id
 * @property {{ nombre?: string, apellido?: string, dni?: string }} [identidad]
 * @property {Record<string, unknown>} [contacto]
 * @property {{ activo?: boolean } & Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} CargoFirestore
 * @property {string} id
 * @property {string} [persona_id]
 * @property {string} [grupo_de_trabajo_id]
 * @property {import("firebase/firestore").Timestamp | import("firebase/firestore").FieldValue} [vigente_desde]
 * @property {boolean} [activo]
 * @property {unknown} [horario_plantilla]
 */

/**
 * @param {string} personaId
 * @returns {Promise<
 *   | { ok: true, legajo: LegajoFirestore, cargos: CargoFirestore[] }
 *   | { ok: false, code: "NOT_FOUND" | "VALIDATION" | "FIRESTORE", message?: string }
 * >}
 */
export async function obtenerLegajoCompleto(personaId) {
  const id = String(personaId ?? "").trim();
  if (!id || !id.startsWith("per_")) {
    return { ok: false, code: "VALIDATION", message: "ID de persona inválido." };
  }

  const personaRef = doc(db, "personas", id);

  let personaSnap;
  try {
    personaSnap = await getDoc(personaRef);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al leer Firestore.";
    return { ok: false, code: "FIRESTORE", message };
  }

  if (!personaSnap.exists) {
    return { ok: false, code: "NOT_FOUND" };
  }

  /** @type {LegajoFirestore} */
  const legajo = { id: personaSnap.id, ...personaSnap.data() };

  const cargosCol = collection(db, "historial_laboral_cargos");
  const cargosQuery = query(
    cargosCol,
    where("persona_id", "==", id),
    where("activo", "==", true),
  );

  let cargosSnap;
  try {
    cargosSnap = await getDocs(cargosQuery);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al leer cargos.";
    return { ok: false, code: "FIRESTORE", message };
  }

  /** @type {CargoFirestore[]} */
  const cargos = cargosSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  cargos.sort((a, b) => msVigente(b.vigente_desde) - msVigente(a.vigente_desde));

  return { ok: true, legajo, cargos };
}
