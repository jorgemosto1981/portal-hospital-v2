import {
  lineasHorarioFichadaReal,
  parseFichadasRealesCelda,
  resolverFichadaPresencia,
  textoHorarioFichadaReal,
  textoHorarioFichadaRealDesdeCelda,
} from "../../../../shared/utils/grillaFichadaPresencia.js";
import { etiquetaEstadoSemaforoFichada } from "./grillaFichadaEstadoJefeDisplay.js";

export {
  lineasHorarioFichadaReal,
  parseFichadasRealesCelda,
  resolverFichadaPresencia,
  textoHorarioFichadaReal,
  textoHorarioFichadaRealDesdeCelda,
};
/**
 * @param {Record<string, unknown>|null|undefined} cell
 * @param {{ esRrhh?: boolean; esTitular?: boolean }} [opts]
 */
export function fichadaPresenciaDesdeCeldaVis(cell, opts = {}) {
  if (opts.esTitular) return null;
  if (opts.esRrhh) {
    return parseFichadasRealesCelda(cell).length > 0 ? "presente" : resolverFichadaPresencia(cell);
  }
  const agregado = cell?.fichada_presencia;
  if (agregado === "presente" || agregado === "ausente") return agregado;
  return resolverFichadaPresencia(cell);
}

/** @param {'presente'|'ausente'|null|undefined} presencia */
export function etiquetaFichadaPresencia(presencia) {
  if (presencia === "presente") return "P";
  if (presencia === "ausente") return "A";
  return null;
}

/** @param {'presente'|'ausente'|null|undefined} presencia */
export function titleFichadaPresencia(presencia) {
  if (presencia === "presente") return "Presente (fichada)";
  if (presencia === "ausente") return "Ausente (sin fichada)";
  return null;
}

/**
 * @param {Record<string, unknown>|null|undefined} cell
 * @param {{ esRrhh?: boolean }} [opts]
 */
export function resumenFichadaModal(cell, opts = {}) {
  const fichadas = parseFichadasRealesCelda(cell);
  const presencia = resolverFichadaPresencia(cell);
  const horarios = lineasHorarioFichadaReal(fichadas);

  if (opts.esRrhh) {
    return {
      modo: "rrhh",
      presencia,
      horarios,
      tieneRegistro: fichadas.length > 0,
    };
  }

  const validacion = cell?.validacion_fichada_dia;
  const semaforo = validacion?.estado_semaforo ? String(validacion.estado_semaforo) : null;
  const estadoJefe = cell?.estado_fichada_jefe ? String(cell.estado_fichada_jefe) : null;

  const textoDesdeSemaforo = semaforo
    ? validacion?.texto_resumen || etiquetaEstadoSemaforoFichada(semaforo) || "Registrado"
    : null;

  const textoEstado =
    textoDesdeSemaforo ||
    (estadoJefe === "ALERTA"
      ? "Sin conformidad"
      : estadoJefe
        ? etiquetaEstadoSemaforoFichada(
            { OK: "VERDE", ALERTA: "ROJO", RRHH_PENDIENTE: "AMARILLO", RRHH_RESUELTO: "VERDE" }[
              estadoJefe
            ] || estadoJefe,
          ) || "Registrado"
        : presencia === "presente"
          ? "Registrado"
          : presencia === "ausente"
            ? "Sin registro"
            : "Registrado");

  const tooltipJefe = validacion?.texto_resumen
    ? String(validacion.texto_resumen)
    : cell?.estado_fichada_jefe_tooltip;

  const esAlertaSemaforo = semaforo === "AMARILLO" || semaforo === "ROJO";

  return {
    modo: "jefe",
    presencia,
    estadoJefe: semaforo || estadoJefe,
    textoEstado,
    tooltipJefe,
    horarios: [],
    tieneRegistro:
      semaforo === "VERDE" ||
      estadoJefe === "OK" ||
      estadoJefe === "RRHH_RESUELTO" ||
      estadoJefe === "RRHH_PENDIENTE" ||
      presencia === "presente",
    esAlerta: esAlertaSemaforo || estadoJefe === "ALERTA" || presencia === "ausente",
  };
}
