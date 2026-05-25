/** Mensaje de error legible para callables de check-in. */
export function checkinCallableMessage(err) {
  const code = err?.code ? String(err.code) : "";
  let msg = err?.message ? String(err.message) : "Error al guardar check-in.";
  const details = err?.details;
  if (details != null && String(details).trim()) {
    msg = `${msg} — ${String(details).trim()}`;
  }
  if (code === "functions/already-exists" || code === "already-exists") {
    if (/bolsa.*consumo/i.test(msg)) {
      msg =
        "Esa bolsa LAO ya tiene días consumidos en el portal. Elegí «Rectificación» (arriba) y volvé a guardar solo los años que quieras corregir.";
    }
  }
  if (code === "functions/internal" || code === "internal") {
    if (/invoker|permission|IAM/i.test(msg)) {
      msg =
        "No se pudo invocar el cierre global en el servidor. Reintentá en unos minutos; si persiste, avisá a sistemas (callable cerrarCheckinGlobal).";
    }
  }
  return code ? `${msg} (${code})` : msg;
}
