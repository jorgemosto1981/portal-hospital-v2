export function formatIsoDateLabel(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatVigenciaCell(row) {
  const desde = row.vigente_desde;
  const hasta = row.vigente_hasta;
  if (!desde && !hasta) return "Abierta (sin fechas)";
  return `${formatIsoDateLabel(desde)} → ${formatIsoDateLabel(hasta)}`;
}

export function isoToDateInputValue(iso) {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateInputToIsoEnd(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function labelProvinciaEnTabla(provinciasList, provinciaId) {
  if (!provinciaId) return "—";
  const f = provinciasList.find((p) => p.id === provinciaId);
  return f ? f.nombre : String(provinciaId);
}

export function callableErrorMessage(err) {
  const raw = err && typeof err.message === "string" ? err.message : "";
  if (raw.includes("permission-denied") || raw.toLowerCase().includes("solo personal autorizado")) {
    return "No tenés permisos de RRHH para esta acción.";
  }
  if (raw.includes("unauthenticated")) {
    return "Iniciá sesión con una cuenta autorizada.";
  }
  return raw || "No se pudo completar la operación.";
}

