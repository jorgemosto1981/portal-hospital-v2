/** Mensaje legible desde errores de callables Firebase (HttpsError). */
export function laboralCallableErrorMessage(err, fallback = "Error en la operación.") {
  let msg = err && typeof err.message === "string" ? err.message.trim() : "";
  if (!msg) msg = fallback;
  const details = err && err.details != null ? String(err.details).trim() : "";
  if (details && !msg.includes(details)) {
    msg = `${msg} — ${details}`;
  }
  const code = err && err.code ? String(err.code) : "";
  if (/^\[VAL-/i.test(msg)) {
    msg = msg.replace(/^\[[^\]]+\]\s*/i, "");
  }
  if (code === "functions/internal" || code === "internal") {
    if (/^\[VAL-HLG-DES-500\]/i.test(err?.message || "")) {
      return msg.replace(/^\[VAL-HLG-DES-500\]\s*/i, "");
    }
    if (!msg || /^internal$/i.test(msg)) {
      return "Error interno del servidor. Si acaba de publicarse una función nueva, esperá 1–2 min y reintentá; si persiste, avisá a sistemas.";
    }
  }
  if (code === "functions/not-found" || code === "not-found") {
    return "Función no disponible en el entorno (deploy pendiente). Contactá a sistemas.";
  }
  return msg;
}
