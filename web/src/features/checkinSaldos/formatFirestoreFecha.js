/**
 * @param {unknown} value
 */
export function formatFirestoreFecha(value) {
  if (value == null) return null;
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return null;
    }
  }
  if (typeof value === "string" && value.trim()) {
    try {
      return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return value.trim();
    }
  }
  return null;
}
