/**
 * Advertencias antes del cierre global (decisión 18: cierre administrativo).
 * @param {{
 *   esNuevoCheckin: boolean,
 *   hlcConfirmadas: boolean,
 *   lineasResumen: Array<{ tipo: string }>,
 *   tieneBolsasFirestore: boolean,
 * }} ctx
 */
export function buildCheckinCierreAdvertencias(ctx) {
  const lineas = ctx.lineasResumen || [];
  const datosEnForm = lineas.some((l) => l.tipo !== "meta");
  const tieneLao = lineas.some((l) => l.tipo === "lao");
  const tieneB = lineas.some((l) => l.tipo === "b");
  const tieneC = lineas.some((l) => l.tipo === "c");

  /** @type {Array<{ id: string, texto: string, requiereAck: boolean }>} */
  const advertencias = [];

  if (ctx.esNuevoCheckin && !ctx.hlcConfirmadas) {
    advertencias.push({
      id: "hlc-sin-confirmar",
      texto: "No confirmaste las HLC operativas en esta sesión.",
      requiereAck: true,
    });
  }

  if (!datosEnForm && !ctx.tieneBolsasFirestore) {
    advertencias.push({
      id: "sin-datos",
      texto: "No hay saldos cargados en el formulario ni bolsas previas en Firestore.",
      requiereAck: true,
    });
  }

  if (!tieneLao) {
    advertencias.push({
      id: "sin-lao",
      texto: "No informaste saldos LAO (patrón A) en esta sesión.",
      requiereAck: true,
    });
  }
  if (!tieneB) {
    advertencias.push({
      id: "sin-b",
      texto: "No informaste ciclos patrón B en esta sesión.",
      requiereAck: true,
    });
  }
  if (!tieneC) {
    advertencias.push({
      id: "sin-c",
      texto: "No informaste saldos patrón C en esta sesión.",
      requiereAck: true,
    });
  }

  advertencias.push({
    id: "cierre-admin",
    texto:
      "El cierre global es administrativo: no garantiza que todas las bolsas A/B/C estén completas. Podés reabrir con rectificación.",
    requiereAck: true,
  });

  return advertencias;
}
