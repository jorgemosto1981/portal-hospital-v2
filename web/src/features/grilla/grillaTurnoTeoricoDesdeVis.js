import { leerPresentacionCompuestoDesdeCelda } from "../../../../shared/utils/visCeldaFusionLectura.js";

/**
 * Turno teórico operativo derivado solo de `vis` (misma verdad que la celda de grilla).
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {{ rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown>; presentacion_compuesto?: Record<string, unknown> } | null}
 */
export function turnoTeoricoDesdeCeldaVis(celda) {
  if (!celda || typeof celda !== "object") return null;

  const rdaTurnoId = String(celda.rda_turno_id || "").trim();
  const presentacion = leerPresentacionCompuestoDesdeCelda(celda);
  const turnoCompuesto =
    String(presentacion?.turno_compuesto_id || rdaTurnoId || "").trim() || undefined;
  const esFranco = celda.es_franco === true || rdaTurnoId === "F";
  const tipoDiaRaw = String(celda.tipo_dia || "").trim().toLowerCase();

  let tipo_dia = tipoDiaRaw || undefined;
  if (!tipo_dia) {
    if (esFranco) tipo_dia = "franco";
    else if (rdaTurnoId && rdaTurnoId !== "NL") tipo_dia = "laborable";
  }

  const capa_teorica = {
    tipo_dia,
    ingreso: celda.rda_ingreso ?? null,
    egreso: celda.rda_egreso ?? null,
    horario_display: celda.rda_horario_display ?? null,
    tiene_huecos: celda.rda_tiene_huecos === true,
    fichadas_esperadas: celda.fichadas_esperadas ?? null,
    turno_compuesto_id: turnoCompuesto ?? null,
    segmentos: Array.isArray(presentacion?.filas)
      ? presentacion.filas.map((f) => ({
          segmento_id: f.segmento_id,
          teoria_label: f.teoria_label,
        }))
      : undefined,
  };

  const tieneSenal =
    Boolean(rdaTurnoId)
    || Boolean(presentacion?.filas?.length)
    || esFranco
    || tipo_dia === "no_laborable";

  if (!tieneSenal) return null;

  return {
    rda_turno_id: rdaTurnoId || turnoCompuesto,
    es_franco: esFranco,
    capa_teorica,
    presentacion_compuesto: presentacion ?? undefined,
  };
}
