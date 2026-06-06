/**
 * Servicio — cobertura parcial de turno (T-03 UI).
 * Contrato: web/src/schemas/capaTeoricaSegmentos.schema.js
 */
import {
  callAplicarBatchAsistencia,
  callObtenerCapaTeoricaDia,
  callObtenerVistaGrillaMesAgente,
  callRegistrarCambioTurno,
} from "./callables.js";
import { listarCatalogosAsistenciaTurnosValidado } from "./catalogosAsistenciaTurnosService.js";
import { coberturaParcialOverrideSchema } from "../schemas/capaTeoricaSegmentos.schema.js";
import { assertGrupoTrabajoId } from "../features/grilla/grillaGrupoUtils.js";
import { esReemplazoPropioV2 } from "../features/grilla/grillaCambioTurnoPropioPreview.js";
import { esIntercambioGuardiaV2 } from "../features/grilla/grillaCoberturaParcialPreview.js";
import { esAdicionalV2 } from "../features/grilla/grillaAdicionalPreview.js";
import seedIds from "../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json" with { type: "json" };

const CFG_TOV_COBERTURA_PARCIAL = seedIds.cfg_tipo_override_turno?.COBERTURA_PARCIAL;

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId gdt_*
 */
export async function obtenerCapaTeoricaDiaValidada(personaId, fechaYmd, grupoTrabajoId) {
  const gdt = assertGrupoTrabajoId(grupoTrabajoId);
  const res = await callObtenerCapaTeoricaDia({
    persona_id: personaId,
    fecha: fechaYmd,
    grupo_trabajo_id: gdt,
  });
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
 * Avisos no bloqueantes sobre el día de la persona cobertura (vis_* scoped).
 * @param {string} personaCoberturaId
 * @param {string} fechaYmd
 * @param {number} anio
 * @param {number} mes
 * @param {string} grupoTrabajoId gdt_*
 */
export async function consultarAvisosCoberturaYy(personaCoberturaId, fechaYmd, anio, mes, grupoTrabajoId) {
  const gdt = assertGrupoTrabajoId(grupoTrabajoId);
  const avisos = [];
  const res = await callObtenerVistaGrillaMesAgente({
    persona_id: personaCoberturaId,
    grupo_trabajo_id: gdt,
    anio,
    mes,
  });
  const vista = res?.data ?? res;
  const diaKey = fechaYmd.slice(8, 10);
  const cell = vista?.dias?.[diaKey];
  if (!vista?.existe) {
    avisos.push("Sin vista mensual (vis_*) para este agente en el período y cargo seleccionados.");
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
 * @param {string} params.grupoTrabajoId gdt_*
 * @param {string} params.personaCoberturaId
 * @param {string[]} params.segmentosCubiertos
 * @param {string} params.tipoCompensacionId
 * @param {string} params.motivo
 * @param {string} [params.expectedVersionToken]
 */
export async function registrarCoberturaParcial({
  personaOrigenId,
  fechaYmd,
  grupoTrabajoId,
  personaCoberturaId,
  segmentosCubiertos,
  tipoCompensacionId,
  motivo,
  expectedVersionToken,
}) {
  const gdt = assertGrupoTrabajoId(grupoTrabajoId);
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
    grupo_trabajo_id: gdt,
    override,
  };
  if (expectedVersionToken) {
    payload.expected_version_token = expectedVersionToken;
    payload.concurrencia_vis_sync = expectedVersionToken;
  }

  const res = await callRegistrarCambioTurno(payload);
  return res?.data ?? res;
}

function normalizeFechaYmd(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Fecha inválida en operación de outbox. Debe usar YYYY-MM-DD.");
  }
  return s;
}

/**
 * @param {Array<Record<string, unknown>>} opsOutbox
 * @param {{ editorPersonaId?: string; periodo?: string }} [ctx]
 */
export async function aplicarBatchAsistencia(opsOutbox, ctx = {}) {
  const ops = (opsOutbox || []).map((op, idx) => mapOutboxOpToBatchPayload(op, idx, ctx));

  const payload = {
    editor_persona_id: String(ctx?.editorPersonaId || "").trim() || null,
    periodo: String(ctx?.periodo || "").trim() || null,
    ops,
  };
  const res = await callAplicarBatchAsistencia(payload);
  return res?.data ?? res;
}

/**
 * @param {Record<string, unknown>} op
 * @param {number} idx
 * @param {{ editorPersonaId?: string; periodo?: string }} ctx
 */
function mapOutboxOpToBatchPayload(op, idx, ctx) {
  const tipo = String(op?.tipo || "").trim();
  const gdt = assertGrupoTrabajoId(
    op?.grupoId,
    `[Batch #${idx + 1}] Falta grupo_trabajo_id en la operación pendiente.`,
  );

  if (tipo === "reemplazo" && esReemplazoPropioV2(op)) {
    const fechaOrigen = normalizeFechaYmd(op.fechaOrigenYmd);
    const fechaDestino = normalizeFechaYmd(op.fechaDestinoYmd || op.fechaYmd);
    const segmentos = Array.isArray(op.segmentosTrasladar) ? op.segmentosTrasladar.map(String) : [];
    const incorporados = Array.isArray(op.segmentosIncorporadosDestino)
      ? op.segmentosIncorporadosDestino.map(String).filter(Boolean)
      : [];
    const turnoDestino = String(
      op.turnoIdDestino || incorporados[0] || segmentos[0] || "",
    ).trim();
    return {
      id: String(op?.id || `op_${idx + 1}`),
      tipo: "reemplazo",
      creado_en: String(op?.creado_en || new Date().toISOString()),
      concurrencia: {
        expected_version_token: String(op?.expectedVersionToken || "").trim(),
        expected_version_token_origen: String(
          op?.expectedVersionTokenOrigen || op?.expectedVersionToken || "",
        ).trim(),
      },
      context: {
        grupo_id: gdt,
        periodo: String(op?.periodo || ctx?.periodo || fechaDestino.slice(0, 7)).trim(),
      },
      payload: {
        persona_id: String(op?.personaId || "").trim(),
        fecha: fechaDestino,
        fecha_origen: fechaOrigen,
        fecha_destino: fechaDestino,
        segmentos_a_trasladar: segmentos,
        segmentos_incorporados_destino: incorporados.length ? incorporados : null,
        turno_id_destino: turnoDestino || null,
        turno_id: turnoDestino || null,
        franco_en_origen: op.francoEnOrigen === true,
        tipo: "reemplazo",
        motivo: String(op?.motivo || "").trim(),
        origen_op_ref: String(op?.id || "").trim() || null,
      },
    };
  }

  if (tipo === "cobertura_parcial" && esIntercambioGuardiaV2(op)) {
    const fechaOrigen = normalizeFechaYmd(op.fechaOrigenYmd);
    const fechaDestino = normalizeFechaYmd(op.fechaDestinoYmd);
    const segsOrigen = Array.isArray(op.segmentosCedidosOrigen)
      ? op.segmentosCedidosOrigen.map(String)
      : [];
    const segsDestino = Array.isArray(op.segmentosCedidosDestino)
      ? op.segmentosCedidosDestino.map(String)
      : [];
    const tcc = String(op.tipoCompensacionId || seedIds.cfg_tipo_compensacion_cobertura?.CAMBIO_INTERNO || "").trim();
    return {
      id: String(op?.id || `op_${idx + 1}`),
      tipo: "cobertura_parcial",
      creado_en: String(op?.creado_en || new Date().toISOString()),
      concurrencia: {
        expected_version_token: String(op?.expectedVersionTokenOrigen || op?.expectedVersionToken || "").trim(),
        expected_version_token_destino: String(op?.expectedVersionTokenDestino || "").trim(),
      },
      context: {
        grupo_id: gdt,
        periodo: String(op?.periodo || ctx?.periodo || fechaOrigen.slice(0, 7)).trim(),
      },
      payload: {
        origen: {
          persona_id: String(op?.personaOrigenId || "").trim(),
          fecha: fechaOrigen,
          segmentos_cedidos: segsOrigen,
        },
        destino: {
          persona_id: String(op?.personaDestinoId || "").trim(),
          fecha: fechaDestino,
          segmentos_cedidos: segsDestino,
        },
        tipo_compensacion_id: tcc || null,
        motivo: String(op?.motivo || "").trim(),
        tipo: "cobertura_parcial",
      },
    };
  }

  if (tipo === "adicional" && esAdicionalV2(op)) {
    const fecha = normalizeFechaYmd(op.fechaYmd);
    const turnoId = String(op?.turnoId || op?.turno_id || "").trim();
    const estadoPrevio = op.estadoPrevio && typeof op.estadoPrevio === "object"
      ? op.estadoPrevio
      : {};
    return {
      id: String(op?.id || `op_${idx + 1}`),
      tipo: "adicional",
      creado_en: String(op?.creado_en || new Date().toISOString()),
      concurrencia: {
        expected_version_token: String(op?.expectedVersionToken || "").trim(),
      },
      context: {
        grupo_id: gdt,
        periodo: String(op?.periodo || ctx?.periodo || fecha.slice(0, 7)).trim(),
      },
      payload: {
        persona_id: String(op?.personaId || "").trim(),
        fecha,
        tipo: "adicional",
        turno_id: turnoId,
        turno_id_adicional: turnoId,
        motivo: String(op?.motivo || "").trim(),
        es_feriado: estadoPrevio.es_feriado === true,
        estado_previo: {
          es_franco: estadoPrevio.es_franco === true,
          es_feriado: estadoPrevio.es_feriado === true,
          es_no_laborable: estadoPrevio.es_no_laborable === true,
          tipo_dia: estadoPrevio.tipo_dia || null,
          turno_preasignado_id: estadoPrevio.turno_preasignado_id || null,
          segmentos_preasignados: Array.isArray(estadoPrevio.segmentos_preasignados)
            ? estadoPrevio.segmentos_preasignados.map(String)
            : [],
          etiqueta_preasignada: estadoPrevio.etiqueta_preasignada || null,
          horas_preasignadas: Number(estadoPrevio.horas_preasignadas) || 0,
        },
      },
    };
  }

  const fecha = normalizeFechaYmd(op?.fechaYmd);
  const base = {
    id: String(op?.id || `op_${idx + 1}`),
    tipo,
    creado_en: String(op?.creado_en || new Date().toISOString()),
    concurrencia: {
      expected_version_token: String(op?.expectedVersionToken || "").trim(),
    },
    context: {
      grupo_id: gdt,
      periodo: String(op?.periodo || ctx?.periodo || fecha.slice(0, 7)).trim(),
    },
  };

  if (tipo === "cobertura_parcial") {
    return {
      ...base,
      payload: {
        persona_origen_id: String(op?.personaOrigenId || "").trim(),
        persona_cobertura_id: String(op?.personaCoberturaId || "").trim(),
        fecha,
        segmentos_cubiertos: Array.isArray(op?.segmentosCubiertos) ? op.segmentosCubiertos.map(String) : [],
        tipo_compensacion_id: String(op?.tipoCompensacionId || "").trim(),
        motivo: String(op?.motivo || "").trim(),
      },
    };
  }

  if (tipo === "reemplazo" || tipo === "adicional") {
    const horasRaw = op?.horasEfectivas;
    const horas = horasRaw != null && horasRaw !== "" ? Number(horasRaw) : null;
    return {
      ...base,
      payload: {
        persona_id: String(op?.personaId || "").trim(),
        fecha,
        tipo,
        turno_id: op?.turnoId ? String(op.turnoId).trim() : null,
        ingreso: op?.ingreso ? String(op.ingreso) : null,
        egreso: op?.egreso ? String(op.egreso) : null,
        horas_efectivas: Number.isFinite(horas) ? horas : null,
        motivo: String(op?.motivo || "").trim(),
      },
    };
  }

  throw new Error(`Operación no soportada en batch (#${idx + 1}): ${tipo || "sin tipo"}.`);
}
