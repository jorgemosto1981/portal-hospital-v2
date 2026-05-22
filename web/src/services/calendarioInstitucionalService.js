import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import {
  buildIndiceEventosCalendario,
  contarDiasCorridosInclusive,
  contarDiasHabilesDesdeIndice,
  esDiaHabilDesdeIndice,
  esFinDeSemanaYmd,
  fechaHastaPorDiasHabilesDesdeIndice,
  getInfoDiaDesdeIndice,
  normalizarYmdCalendario,
  obtenerProximoDiaHabilDesdeIndice,
  resolverEventoEnIndice,
} from "../../../shared/utils/calendarInstitucionalCore.js";
import {
  readUsaCalendarioInstitucional,
  validarFechasArticulo,
} from "../../../shared/utils/validarFechasArticulo.js";
import {
  CALENDARIO_EVENTOS_SUB,
  CALENDARIO_INSTITUCIONAL_CONFIG_ID,
} from "../constants/calendarioInstitucional.js";
import { db } from "../config/firebase.js";

function eventosCollectionRef() {
  return collection(
    db,
    "config",
    CALENDARIO_INSTITUCIONAL_CONFIG_ID,
    CALENDARIO_EVENTOS_SUB,
  );
}

function eventoDocRef(ymd) {
  return doc(eventosCollectionRef(), normalizarYmdCalendario(ymd));
}

/**
 * @param {(docs: Array<{ id: string, data: Record<string, unknown> }>) => void} onData
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function subscribeEventosCalendarioInstitucional(onData) {
  return onSnapshot(eventosCollectionRef(), (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
    onData(docs);
  });
}

export async function listarEventosCalendarioInstitucional() {
  const snap = await getDocs(eventosCollectionRef());
  return snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
}

/**
 * @param {string} ymd
 * @param {{ tipo: string, descripcion: string, multiplicador: number, anual: boolean }} payload
 */
export async function guardarEventoCalendarioInstitucional(ymd, payload) {
  const id = normalizarYmdCalendario(ymd);
  if (!id) throw new Error("Fecha inválida (YYYY-MM-DD).");
  await setDoc(eventoDocRef(id), {
    tipo: payload.tipo,
    descripcion: payload.descripcion || "",
    multiplicador: Number(payload.multiplicador) || 1,
    anual: payload.anual === true,
  });
}

export async function eliminarEventoCalendarioInstitucional(ymd) {
  const id = normalizarYmdCalendario(ymd);
  if (!id) return;
  await deleteDoc(eventoDocRef(id));
}

export {
  buildIndiceEventosCalendario,
  contarDiasCorridosInclusive,
  contarDiasHabilesDesdeIndice,
  esDiaHabilDesdeIndice,
  esFinDeSemanaYmd,
  fechaHastaPorDiasHabilesDesdeIndice,
  getInfoDiaDesdeIndice,
  normalizarYmdCalendario,
  obtenerProximoDiaHabilDesdeIndice,
  readUsaCalendarioInstitucional,
  resolverEventoEnIndice,
  validarFechasArticulo,
};
