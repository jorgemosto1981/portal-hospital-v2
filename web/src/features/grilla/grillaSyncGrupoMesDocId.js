import { RX_GDT } from "./grillaGrupoUtils.js";

/**
 * Mismo id que `buildGrillaSyncGrupoMesDocId` en functions.
 * @param {string} grupoTrabajoId
 * @param {string} periodoYm — yyyy-mm
 */
export function buildGrillaSyncGrupoMesDocId(grupoTrabajoId, periodoYm) {
  const gdt = String(grupoTrabajoId || "").trim();
  const [yyyy, mm] = String(periodoYm || "").trim().split("-");
  const anio = Number(yyyy);
  const mes = Number(mm);
  if (!RX_GDT.test(gdt) || !Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return "";
  }
  return `${gdt}_${anio}_${String(mes).padStart(2, "0")}`;
}

/**
 * @param {unknown} value — Firestore Timestamp o ISO string
 * @returns {Date | null}
 */
export function fechaDesdeFirestore(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && value !== null && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  return null;
}

export function formatearUltimaSync(d) {
  if (!d) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
