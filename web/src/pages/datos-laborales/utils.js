export function formatValue(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{...}";
  return String(v);
}

export function formatCargaPorDia(v) {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.map((x) => (x == null ? "-" : String(x))).join(" / ");
}

export function isoToDateInput(iso) {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function takeFirst(items, max = 5) {
  return Array.isArray(items) ? items.slice(0, max) : [];
}

export function emptyCargaDia() {
  return { dia_semana_id: "", horas: "" };
}

export function normalizeCargaRowsFromRecord(rawCarga) {
  if (!Array.isArray(rawCarga)) return [emptyCargaDia()];
  if (rawCarga.length === 0) return [emptyCargaDia()];
  return rawCarga.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return {
        dia_semana_id: String(item.dia_semana_id || ""),
        horas: item.horas == null ? "" : String(item.horas),
      };
    }
    return {
      dia_semana_id: "",
      horas: item == null ? "" : String(item),
    };
  });
}

export function normalizarWarnings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const code = typeof w.code === "string" ? w.code.trim() : "";
      const message = typeof w.message === "string" ? w.message.trim() : "";
      if (!code && !message) return null;
      return { code, message };
    })
    .filter(Boolean);
}

export function crearIndicePorId(rows) {
  const idx = new Map();
  (rows || []).forEach((row) => {
    if (row && row.id) idx.set(String(row.id), row);
  });
  return idx;
}

export function labelDesdeIndice(idx, id, campo = "nombre") {
  if (!id) return "—";
  const row = idx.get(String(id));
  if (!row) return String(id);
  return row[campo] ? String(row[campo]) : String(id);
}
