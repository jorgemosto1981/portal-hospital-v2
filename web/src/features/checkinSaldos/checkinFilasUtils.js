import { assertCheckinAnioAllowed } from "../../../../shared/utils/laoVersionResolver.js";

import { LAO_ANIO_CORTE_PORTAL_A } from "../../constants/laoArticulo.js";

export function listAniosCortePortalOpciones(anchorYear = new Date().getFullYear()) {
  const max = anchorYear + 1;
  const min = Math.max(2000, max - 20);
  const out = [];
  for (let y = max; y >= min; y -= 1) out.push(y);
  return out;
}

export function parseAnioCorteA(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1900 || n > 2100) return null;
  return n;
}

export function listAniosCheckinPermitidos(anioA = LAO_ANIO_CORTE_PORTAL_A) {
  const a = Number(anioA);
  const out = [];
  for (let y = a - 1; y >= a - 40; y -= 1) {
    if (y < 1900) break;
    out.push(y);
  }
  return out;
}

export function emptyCheckinFila() {
  return { key: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, anio_origen: "", dias_disponibles: "" };
}

export function validateCheckinFilas(filas, anioA = LAO_ANIO_CORTE_PORTAL_A) {
  const errors = [];
  if (!filas.length) {
    errors.push("Agregá al menos un año con saldo histórico.");
    return { ok: false, errors, payloadFilas: [] };
  }

  const seen = new Set();
  const payloadFilas = [];

  for (const fila of filas) {
    const anio = Number(fila.anio_origen);
    const dias = Number(fila.dias_disponibles);

    if (!Number.isInteger(anio)) {
      errors.push("Cada fila debe tener un año de origen válido.");
      continue;
    }
    if (seen.has(anio)) {
      errors.push(`El año ${anio} está repetido en la grilla.`);
    }
    seen.add(anio);

    try {
      assertCheckinAnioAllowed(anio, anioA);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      continue;
    }

    if (!Number.isInteger(dias) || dias < 0) {
      errors.push(`Días disponibles del año ${anio}: entero ≥ 0 (sin decimales).`);
      continue;
    }

    payloadFilas.push({ anio_origen: anio, dias_disponibles: dias });
  }

  return { ok: errors.length === 0 && payloadFilas.length === filas.length, errors, payloadFilas };
}
