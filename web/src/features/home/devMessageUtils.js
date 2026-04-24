/** Resultado JSON de callable para panel de depuración. */
export function formatCallableData(data) {
  return JSON.stringify(data, null, 2);
}

/** Texto de error de callable. */
export function formatCallableError(err) {
  return `Error: ${err?.code || ""} ${err?.message || String(err)}`;
}
