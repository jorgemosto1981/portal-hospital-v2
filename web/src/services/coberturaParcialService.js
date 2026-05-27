/**
 * Servicio — cobertura parcial de turno (T-03 UI).
 * Contrato: web/src/schemas/capaTeoricaSegmentos.schema.js
 */
import {
  callObtenerCapaTeoricaDia,
  callObtenerVistaGrillaMesAgente,
  callRegistrarCambioTurno,
} from "./callables.js";
import { listarCatalogosAsistenciaTurnosValidado } from "./catalogosAsistenciaTurnosService.js";
import { coberturaParcialOverrideSchema } from "../schemas/capaTeoricaSegmentos.schema.js";
import seedIds from "../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json" with { type: "json" };

const CFG_TOV_COBERTURA_PARCIAL = seedIds.cfg_tipo_override_turno?.COBERTURA_PARCIAL;

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 */
export async function obtenerCapaTeoricaDiaValidada(personaId, fechaYmd) {
  const res = await callObtenerCapaTeoricaDia({ persona_id: personaId, fecha: fechaYmd });
  return res?.data ?? res;
}

/**
 * @returns {Promise<Array<{ id: string; titulo_ui: string }>>}
 */
export async function listarTiposCompensacionCobertura() {
  const parsed = await listarCatalogosAsistenciaTurnosValidado();
  return parsed.catalogos.cfg_tipo_compensacion_cobertura || [];
}

/**
 * Avisos no bloqueantes sobre el día de la persona cobertura (vis_*).
 * @param {string} personaCoberturaId
 * @param {string} fechaYmd
 * @param {number} anio
 * @param {number} mes
 */
export async function consultarAvisosCoberturaYy(personaCoberturaId, fechaYmd, anio, mes) {
  const avisos = [];
  const res = await callObtenerVistaGrillaMesAgente({
    persona_id: personaCoberturaId,
    anio,
    mes,
  });
  const vista = res?.data ?? res;
  const diaKey = fechaYmd.slice(8, 10);
  const cell = vista?.dias?.[diaKey];
  if (!vista?.existe) {
    avisos.push("Sin vista mensual (vis_*) para este agente en el período.");
    return avisos;
  }
  if (cell?.es_franco) {
    avisos.push("El agente de cobertura figura en franco ese día en la grilla.");
  }
  if (cell?.rda_turno_id && !cell?.es_franco) {
    avisos.push(`Ya tiene asignación operativa: ${cell.rda_ingreso || ""}–${cell.rda_egreso || ""} (${cell.rda_turno_id}).`);
  }
  if (cell?.grupo_de_trabajo_id) {
    avisos.push(`Grupo en vis: ${cell.etiqueta_grupo_corta || cell.grupo_de_trabajo_id}`);
  }
  return avisos;
}

/**
 * @param {object} params
 * @param {string} params.personaOrigenId — titular del doc asi (XX)
 * @param {string} params.fechaYmd
 * @param {string} params.personaCoberturaId
 * @param {string[]} params.segmentosCubiertos
 * @param {string} params.tipoCompensacionId
 * @param {string} params.motivo
 * @param {string} [params.concurrenciaVisSync]
 */
export async function registrarCoberturaParcial({
  personaOrigenId,
  fechaYmd,
  personaCoberturaId,
  segmentosCubiertos,
  tipoCompensacionId,
  motivo,
  concurrenciaVisSync,
}) {
  const override = coberturaParcialOverrideSchema.parse({
    tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
    tipo_compensacion_id: tipoCompensacionId,
    persona_origen_id: personaOrigenId,
    persona_cobertura_id: personaCoberturaId,
    segmentos_cubiertos: segmentosCubiertos,
    motivo: motivo.trim(),
    tipo: "cobertura_parcial",
  });

  const payload = {
    persona_id: personaOrigenId,
    fecha: fechaYmd,
    override,
  };
  if (concurrenciaVisSync) payload.concurrencia_vis_sync = concurrenciaVisSync;

  const res = await callRegistrarCambioTurno(payload);
  return res?.data ?? res;
}
