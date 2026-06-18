/**
 * Etiqueta persona en grilla equipo (formato backend: `Apellido, Nombre · DNI … · N hs`).
 */

/**
 * @param {string|null|undefined} raw
 * @returns {{ linea1: string; linea2: string }}
 */
export function parsePersonaLabelGrilla(raw) {
  const s = String(raw || "").trim();
  if (!s) return { linea1: "", linea2: "" };
  const parts = s.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { linea1: s, linea2: "" };
  const linea1 = parts[0];
  let dni = "";
  let hs = "";
  for (const p of parts.slice(1)) {
    const mDni = p.match(/^DNI\s*(.+)$/i);
    if (mDni) {
      dni = mDni[1].trim();
      continue;
    }
    const mHs = p.match(/^(\d+(?:[.,]\d+)?)\s*hs$/i);
    if (mHs) {
      hs = mHs[1].replace(",", ".");
      continue;
    }
  }
  if (dni && hs) return { linea1, linea2: `DNI ${dni} - ${hs} hs` };
  if (dni) return { linea1, linea2: `DNI ${dni}` };
  return { linea1, linea2: parts.slice(1).join(" · ") };
}
