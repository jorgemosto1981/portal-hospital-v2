import {
  celdaTieneCapaFichadaCargada,
  evaluarContradiccionFichadaTeoria,
  parseFichadasRealesCelda,
} from "../../../../shared/utils/grillaFichadaPresencia.js";
import { celdaTieneFichadaImpar } from "./grillaAuditoriaDiariaResumen.js";
import { horarioOperativoDesdeCeldaVis } from "./grillaHorarioInstitucional.js";

/**
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function formatearMarcasCrudasFichada(celda) {
  const fichadas = parseFichadasRealesCelda(celda);
  return fichadas.map((f, i) => {
    if (!f || typeof f !== "object") {
      return { indice: i + 1, tipo: "—", ingreso: "—", egreso: "—", hora: "—" };
    }
    return {
      indice: i + 1,
      tipo: String(f.tipo || "—").trim() || "—",
      ingreso: String(f.ingreso || f.hora_ingreso || "").trim() || "—",
      egreso: String(f.egreso || f.hora_egreso || "").trim() || "—",
      hora: String(f.hora || "").trim() || "—",
    };
  });
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {{ desalineacionTeoria?: boolean; desalineacionTooltip?: string }} [ctx]
 */
export function lineasAlertaAuditoriaModal(celda, ctx = {}) {
  /** @type {Array<{ codigo: string; texto: string; terminoAyuda: string }>} */
  const lineas = [];

  if (!celda || typeof celda !== "object") return lineas;

  const contradictorio = evaluarContradiccionFichadaTeoria(celda);
  if (contradictorio.contradictorio) {
    lineas.push({
      codigo: "fichada_teoria",
      texto:
        contradictorio.tooltip ||
        "La asistencia registrada no coincide con la jornada teórica vigente.",
      terminoAyuda: "Divergencia fichada y licencia (GSO)",
    });
  }

  if (celdaTieneFichadaImpar(celda)) {
    lineas.push({
      codigo: "fichada_impar",
      texto: "Marcas incompletas del reloj (entrada sin egreso o menos marcas que las esperadas).",
      terminoAyuda: "Fichada impar (reloj)",
    });
  }

  if (ctx.desalineacionTeoria && ctx.desalineacionTooltip) {
    lineas.push({
      codigo: "desalineacion_licencia",
      texto: ctx.desalineacionTooltip,
      terminoAyuda: "Desalineación teoría post-licencia",
    });
  }

  return lineas;
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {{ rda_turno_id?: string; capa_teorica?: Record<string, unknown> } | null} [turnoTeorico]
 */
export function resumenTeoricoParaAuditoria(celda, turnoTeorico) {
  const capa = turnoTeorico?.capa_teorica;
  const horario =
    capa && typeof capa === "object"
      ? horarioOperativoDesdeCeldaVis({
          rda_ingreso: capa.ingreso,
          rda_egreso: capa.egreso,
          rda_horario_display: capa.horario_display,
          rda_tiene_huecos: capa.tiene_huecos,
          segmentos: capa.segmentos,
          tiene_huecos: capa.tiene_huecos,
        })
      : celda && typeof celda === "object"
        ? horarioOperativoDesdeCeldaVis(celda)
        : "";

  return {
    turnoId: String(turnoTeorico?.rda_turno_id || celda?.rda_turno_id || "—").trim() || "—",
    tipoDia: String(capa?.tipo_dia || celda?.tipo_dia || "—"),
    horario: horario || "—",
    fichadasEsperadas:
      capa?.fichadas_esperadas != null
        ? String(capa.fichadas_esperadas)
        : celda?.fichadas_esperadas != null
          ? String(celda.fichadas_esperadas)
          : "—",
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function celdaTieneAuditoriaTecnicaVisible(celda) {
  if (!celda || typeof celda !== "object") return false;
  return celdaTieneCapaFichadaCargada(celda) || parseFichadasRealesCelda(celda).length > 0;
}
