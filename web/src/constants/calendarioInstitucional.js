/** Firestore: config/calendario_institucional/eventos/{YYYY-MM-DD} */
export const CALENDARIO_INSTITUCIONAL_CONFIG_ID = "calendario_institucional";
export const CALENDARIO_EVENTOS_SUB = "eventos";

export const TIPOS_EVENTO_CALENDARIO = [
  { id: "feriado", label: "Feriado", colorClass: "bg-red-200 hover:bg-red-300" },
  { id: "asueto", label: "Asueto", colorClass: "bg-amber-200 hover:bg-amber-300" },
  { id: "institucional", label: "Institucional", colorClass: "bg-sky-200 hover:bg-sky-300" },
];

export function colorClassPorTipoEvento(tipo) {
  const t = String(tipo || "").toLowerCase();
  const row = TIPOS_EVENTO_CALENDARIO.find((x) => x.id === t);
  return row?.colorClass || "";
}
