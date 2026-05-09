/**
 * STUB_CORRIDO_SOLO_PARA_TEST — No respeta N “laborables efectivos”.
 * Devuelve los siguientes N días corridos desde fecha_inicio (fecha civil ISO).
 * Reemplazar por callable real getDiasLaborablesAgente (RDA/plantilla pura).
 *
 * @param {string} persona_id per_<ULID>
 * @param {string} fecha_inicio ISO YYYY-MM-DD (inclusive)
 * @param {number} cantidad_dias_buscados N (en stub: días corridos, no laborables)
 * @returns {string[]} fechas ISO YYYY-MM-DD
 */
export function getDiasLaborablesAgente(persona_id, fecha_inicio, cantidad_dias_buscados) {
  void persona_id;
  const n = Math.max(0, Math.floor(Number(cantidad_dias_buscados)) || 0);
  const start = parseFechaIsoLocal(fecha_inicio);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(formatFechaIsoLocal(d));
  }
  return out;
}

/** Parse YYYY-MM-DD como medianoche en calendario local (evita drift UTC para tests). */
function parseFechaIsoLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFechaIsoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
