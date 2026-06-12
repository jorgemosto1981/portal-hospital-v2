import {
  celdaEsperaFichada,
  celdaTieneCapaFichadaCargada,
  celdaTieneFichadaImpar,
  evaluarContradiccionFichadaTeoria,
} from "../../../../shared/utils/grillaFichadaPresencia.js";

export { celdaTieneFichadaImpar };
import { fichadasEsperadasDesdeCeldaVis } from "./grillaFichadasEsperadasDisplay.js";
import { celdaEsIncompletoPlanVis, celdaTieneJornadaVis } from "./grillaMesEquipoDisplay.js";
import {
  celdaPendiente,
  celdaTieneDesalineacionTeoria,
  diasEnMes,
  etiquetaCelda,
} from "./grillaMesCellUtils.js";
import { diaFueraTramoHlg, diaFueraVigenciaTramo } from "./grillaMesFilasUtils.js";
import {
  evaluarPostPurgeHlgCelda,
  evaluarTeoriaPendienteLazyCelda,
} from "./grillaMesGsoHints.js";

const MAX_ITEMS_CRITICOS = 5;

const PRIORIDAD_TIPO = {
  bloqueo_liquidacion: 0,
  fichada_impar: 1,
  fichada_inconsistente: 2,
  teoria_pendiente: 3,
};

/**
 * @param {Record<string, unknown>} cell
 * @param {Record<string, unknown>} fila
 */
function buildTurnoTeoricoDesdeCelda(cell, fila) {
  const jornadaVis = celdaTieneJornadaVis(cell);
  const tipoDiaVis = String(cell.tipo_dia || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const turnoText = String(cell.rda_horario_display || cell.rda_turno_id || "").trim();
  const esNoLaborable =
    !jornadaVis &&
    (tipoDiaVis === "no_laborable" || tipoDiaVis === "no-laborable" || turnoText === "NL");
  const esFranco = (cell.es_franco === true || turnoText === "F") && !esNoLaborable;
  const fichadasN = fichadasEsperadasDesdeCeldaVis(cell);
  const tipoInstCel = cell.tipo_evento_institucional;
  const esInstitucional = Boolean(
    cell.es_feriado === true || tipoInstCel === "feriado" || tipoInstCel === "asueto",
  );

  return {
    rda_turno_id: cell.rda_turno_id || undefined,
    es_franco: esFranco,
    capa_teorica: {
      tipo_dia: jornadaVis
        ? "laborable"
        : esNoLaborable
          ? "no_laborable"
          : esFranco
            ? "franco"
            : cell.tipo_dia || "laborable",
      ingreso: cell.rda_ingreso || null,
      egreso: cell.rda_egreso || null,
      horario_display: cell.rda_horario_display,
      tiene_huecos: cell.rda_tiene_huecos,
      fichadas_esperadas: fichadasN ?? undefined,
      es_feriado: esInstitucional,
      tipo_evento_institucional: tipoInstCel || undefined,
    },
  };
}

/**
 * @typedef {"bloqueo_liquidacion"|"fichada_impar"|"fichada_inconsistente"|"teoria_pendiente"} TipoAlertaAuditoriaDiaria
 */

/**
 * @typedef {Object} ItemCriticoAuditoriaDiaria
 * @property {TipoAlertaAuditoriaDiaria} tipo
 * @property {string} personaLabel
 * @property {string} fechaYmd
 * @property {string} codigo
 * @property {Record<string, unknown>} modalPayload
 */

/**
 * @typedef {Object} OpcionesAuditoriaDiariaSector
 * @property {number} anio
 * @property {number} mes
 * @property {string} [grupoSeleccionado]
 * @property {boolean} [materializacionGrupoReciente]
 */

/**
 * @param {Array<Record<string, unknown>> | null | undefined} filas
 * @param {OpcionesAuditoriaDiariaSector} [opts]
 */
export function calcularAuditoriaDiariaSector(filas, opts = {}) {
  let fichadasInconsistentes = 0;
  let fichadasImpares = 0;
  let teoriasPendientes = 0;
  let bloqueosLiquidacion = 0;
  /** @type {ItemCriticoAuditoriaDiaria[]} */
  const itemsCriticos = [];

  const anio = Number(opts.anio);
  const mes = Number(opts.mes);
  if (!Array.isArray(filas) || !Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return {
      contadores: { fichadasInconsistentes, fichadasImpares, teoriasPendientes, bloqueosLiquidacion },
      itemsCriticos,
    };
  }

  const grupoSeleccionado = String(opts.grupoSeleccionado || "").trim();
  const diasMes = diasEnMes(anio, mes);

  const pushItem = (tipo, ctx) => {
    const { personaLabel, fechaYmd, codigo, modalPayload } = ctx;
    itemsCriticos.push({ tipo, personaLabel, fechaYmd, codigo, modalPayload });
  };

  for (const fila of filas) {
    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
    const personaId = String(fila.persona_id || "").trim();
    const personaLabel = String(fila.persona_label || personaId || "—").trim();
    const hlgId = String(fila.hlg_id || "").trim() || undefined;
    const filaId = String(fila.fila_id || "").trim() || undefined;
    const filaMaterializoLazy =
      fila.materializado_lazy === true || opts.materializacionGrupoReciente === true;

    for (let d = 1; d <= diasMes; d += 1) {
      const dia = String(d).padStart(2, "0");
      if (diaFueraTramoHlg(dias, dia)) continue;

      const fechaYmd = `${anio}-${String(mes).padStart(2, "0")}-${dia}`;
      if (diaFueraVigenciaTramo(fechaYmd, fila.vigente_desde, fila.vigente_hasta)) continue;

      const cell = dias[dia];
      if (!cell || typeof cell !== "object") continue;

      const eventos = cell.eventos;
      const evs = Array.isArray(eventos) ? eventos : [];
      const licenciaCod = etiquetaCelda(evs);
      const codigoDisplay = licenciaCod || String(cell.rda_turno_id || "—").trim() || "—";

      const postPurge = evaluarPostPurgeHlgCelda(cell, evs, {
        fechaYmd,
        vigenteHasta: fila.vigente_hasta,
      });
      const teoriaPendiente = evaluarTeoriaPendienteLazyCelda(cell, evs, {
        fechaYmd,
        vigenteHasta: fila.vigente_hasta,
        materializadoLazy: filaMaterializoLazy,
        postPurgeActivo: postPurge.activo,
      });
      const contradictorio = evaluarContradiccionFichadaTeoria(cell);
      const impar = celdaTieneFichadaImpar(cell);
      const desalineacion = celdaTieneDesalineacionTeoria(evs, cell);
      const pendienteRevision = celdaPendiente(evs);
      const bloqueo = desalineacion.desalineado || pendienteRevision;

      const incompletoPlan = celdaEsIncompletoPlanVis(cell);
      const cellGdt = String(cell.grupo_trabajo_id || "").trim();
      const grupoTrabajoId = grupoSeleccionado || cellGdt || "";
      const grupoLabel = String(cell.etiqueta_grupo_corta || "").trim() || undefined;

      const modalPayload = {
        dia,
        fechaYmd,
        personaId,
        hlgId,
        filaId,
        eventos: evs,
        personaLabel,
        grupoLabel,
        turnoTeorico: buildTurnoTeoricoDesdeCelda(cell, fila),
        incompletoPlan: Boolean(incompletoPlan),
        desalineacionTeoria: Boolean(desalineacion.desalineado),
        desalineacionTooltip: desalineacion.tooltip || undefined,
        celdaVis: cell,
        vigenteHasta: fila.vigente_hasta || undefined,
        materializadoLazy: filaMaterializoLazy,
        grupoTrabajoId,
      };

      if (bloqueo) {
        bloqueosLiquidacion += 1;
        pushItem("bloqueo_liquidacion", {
          personaLabel,
          fechaYmd,
          codigo: licenciaCod || "Revisión",
          modalPayload,
        });
      }
      if (impar) {
        fichadasImpares += 1;
        pushItem("fichada_impar", {
          personaLabel,
          fechaYmd,
          codigo: codigoDisplay,
          modalPayload,
        });
      }
      if (contradictorio.contradictorio) {
        fichadasInconsistentes += 1;
        pushItem("fichada_inconsistente", {
          personaLabel,
          fechaYmd,
          codigo: codigoDisplay,
          modalPayload,
        });
      }
      if (teoriaPendiente.activo) {
        teoriasPendientes += 1;
        pushItem("teoria_pendiente", {
          personaLabel,
          fechaYmd,
          codigo: licenciaCod || "Teoría",
          modalPayload,
        });
      }
    }
  }

  itemsCriticos.sort(
    (a, b) => (PRIORIDAD_TIPO[a.tipo] ?? 9) - (PRIORIDAD_TIPO[b.tipo] ?? 9),
  );

  return {
    contadores: { fichadasInconsistentes, fichadasImpares, teoriasPendientes, bloqueosLiquidacion },
    itemsCriticos: itemsCriticos.slice(0, MAX_ITEMS_CRITICOS),
  };
}
