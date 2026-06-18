/**
 * Presentación celda-día con ops outbox pendientes (RFC F4 amendment visual).
 */
import { textoHorarioTurno } from "./grillaMesEquipoDisplay.js";
import {
  etiquetaSegmentosCompuesto,
  opAfectaDia,
  proyectarDiaConOpsPendientes,
  segmentoIdsDesdeCapa,
} from "./grillaCambioTurnoPropioPreview.js";
import { GESTION_TURNO_OPCIONES } from "./gestionTurnoWizardOpciones.js";
import {
  formatFechaOutboxCorta,
  personaEtiquetaOutbox,
  resumenLineaOutboxOp,
} from "./grillaOutboxLabels.js";

const TITULO_FLUJO = Object.fromEntries(
  GESTION_TURNO_OPCIONES.map((o) => [o.id, o.titulo]),
);

/** @param {Array<Record<string, unknown>>} ops @param {string} grupoId @param {string} periodo */
export function opsOutboxParaGrupo(ops, grupoId, periodo) {
  const gid = String(grupoId || "").trim();
  const per = String(periodo || "").trim();
  if (!gid || !per) return [];
  return (ops || []).filter((op) => {
    const og = String(op.grupoId || op.grupo_id || "").trim();
    const opPer = String(op.periodo || "").trim();
    return og === gid && opPer === per;
  });
}

/** @param {object} cell */
export function capaBaseDesdeCeldaGrilla(cell) {
  if (!cell || typeof cell !== "object") return {};
  const ct = cell.capa_teorica;
  if (ct && typeof ct === "object" && (ct.segmentos?.length || ct.turno_compuesto_id || ct.turno_id)) {
    return { ...ct };
  }
  const tid = String(cell.rda_turno_id || "").trim();
  /** @type {Record<string, unknown>} */
  const capa = {
    tipo_dia: cell.tipo_dia,
    ingreso: cell.rda_ingreso,
    egreso: cell.rda_egreso,
    es_franco: cell.es_franco,
  };
  if (tid.includes("+")) capa.turno_compuesto_id = tid;
  else if (tid) capa.turno_id = tid;
  if (!segmentoIdsDesdeCapa(capa).length) {
    const pres = cell.presentacion_compuesto;
    const filas = pres?.filas;
    if (Array.isArray(filas) && filas.length) {
      const ids = [
        ...new Set(
          filas
            .map((f) => String(f?.segmento_id || "").trim())
            .filter(Boolean),
        ),
      ];
      if (ids.length === 1) capa.turno_id = ids[0];
      else if (ids.length > 1) capa.turno_compuesto_id = ids.join("+");
    }
  }
  return capa;
}

/**
 * @param {string[]} baseIds
 * @param {string[]} projIds
 * @param {Record<string, object>} [turnosPorId]
 */
function diffSegmentoLabels(baseIds, projIds, turnosPorId = {}) {
  const b = new Set(baseIds);
  const p = new Set(projIds);
  const out = [...b].filter((id) => !p.has(id));
  const inn = [...p].filter((id) => !b.has(id));
  return {
    out: out.length ? etiquetaSegmentosCompuesto(out, turnosPorId) : "",
    inn: inn.length ? etiquetaSegmentosCompuesto(inn, turnosPorId) : "",
  };
}

const ORDEN_TRAMO_PISO = { M: 0, T: 1, N: 2 };

/** @param {Record<string, unknown>} base */
function metadatosVisualesCeldaPreservados(base) {
  return {
    eventos: base.eventos,
    grupo_de_trabajo_id: base.grupo_de_trabajo_id,
    etiqueta_grupo_corta: base.etiqueta_grupo_corta,
    es_feriado: base.es_feriado,
    tipo_evento_institucional: base.tipo_evento_institucional,
    vis_id: base.vis_id,
    existe: base.existe,
  };
}

/**
 * Presentación por pisos solo teoría (post-proceso outbox, sin AUSENTE materializado).
 * @param {string[]} segmentoIds
 */
export function filasPresentacionTeoriaProyectadaDesdeSegmentos(segmentoIds) {
  const ids = [...new Set((segmentoIds || []).map((x) => String(x || "").trim()).filter(Boolean))];
  if (!ids.length) return [];
  const sorted = [...ids].sort(
    (a, b) => (ORDEN_TRAMO_PISO[a] ?? 9) - (ORDEN_TRAMO_PISO[b] ?? 9),
  );
  return sorted.map((segmento_id, orden) => ({
    segmento_id,
    orden,
    teoria_label: segmento_id,
    fichada_label: null,
    estado_tramo: "presente",
    badge_label: null,
    badge_tipo: null,
    badges: [],
  }));
}

/**
 * Celda vis como quedaría tras aplicar todas las ops outbox que afectan el día (vista final en cola).
 * @param {object} params
 */
export function celdaVisProyectadaOutboxPendiente({
  cell,
  ops,
  personaId,
  fechaYmd,
  turnosPorId = {},
}) {
  const base = cell && typeof cell === "object" ? cell : {};
  const opsDia = (ops || []).filter((op) => opAfectaDia(op, personaId, fechaYmd));
  if (!opsDia.length) return { ...base };

  const capaBase = capaBaseDesdeCeldaGrilla(base);
  const proj = proyectarDiaConOpsPendientes(
    capaBase,
    ops,
    personaId,
    fechaYmd,
    turnosPorId,
  );
  const projIds = proj.segmentoIds || [];
  const meta = metadatosVisualesCeldaPreservados(base);

  if (!projIds.length) {
    return {
      ...meta,
      es_franco: true,
      tipo_dia: "franco",
      rda_turno_id: "",
      rda_ingreso: null,
      rda_egreso: null,
      rda_horario_display: null,
      capa_teorica: {
        tipo_dia: "franco",
        es_franco: true,
        segmentos: [],
      },
      presentacion_compuesto: { filas: [] },
      fichadas_esperadas: 0,
    };
  }

  const rdaTurno = projIds.length === 1 ? projIds[0] : projIds.join("+");
  const fichadasEsperadas = Math.max(2, projIds.length * 2);

  return {
    ...meta,
    es_franco: false,
    tipo_dia: "laborable",
    rda_turno_id: rdaTurno,
    rda_ingreso: null,
    rda_egreso: null,
    rda_horario_display: proj.etiqueta || rdaTurno,
    capa_teorica: {
      tipo_dia: "laborable",
      es_franco: false,
      segmentos: projIds.map((segmento_id) => ({ segmento_id })),
      ...(projIds.length > 1
        ? { turno_compuesto_id: projIds.join("+") }
        : { turno_id: projIds[0] }),
      horas_teoricas_totales: proj.horas,
    },
    presentacion_compuesto: {
      filas: filasPresentacionTeoriaProyectadaDesdeSegmentos(projIds),
    },
    fichadas_esperadas: fichadasEsperadas,
  };
}

/**
 * @param {object} params
 * @param {object} params.cell
 * @param {Array<Record<string, unknown>>} params.ops
 * @param {string} params.personaId
 * @param {string} params.fechaYmd
 * @param {string} [params.grupoId]
 * @param {Record<string, string>} [params.personaLabels]
 * @param {Record<string, object>} [params.turnosPorId]
 */
export function visualCeldaOutboxPendiente({
  cell,
  ops,
  personaId,
  fechaYmd,
  grupoId = "",
  personaLabels = {},
  turnosPorId = {},
}) {
  const opsDia = (ops || []).filter((op) => opAfectaDia(op, personaId, fechaYmd));
  if (!opsDia.length) return null;

  const capaBase = capaBaseDesdeCeldaGrilla(cell);
  const baseIds = segmentoIdsDesdeCapa(capaBase);
  const baseText = textoHorarioTurno(cell) || etiquetaSegmentosCompuesto(baseIds, turnosPorId) || "";

  const proj = proyectarDiaConOpsPendientes(
    capaBase,
    ops,
    personaId,
    fechaYmd,
    turnosPorId,
  );
  const projIds = proj.segmentoIds || [];
  let turnoText = proj.etiqueta || etiquetaSegmentosCompuesto(projIds, turnosPorId);
  if (!projIds.length) turnoText = "F";

  const { out: diffOut, inn: diffIn } = diffSegmentoLabels(baseIds, projIds, turnosPorId);

  const opAdicional = opsDia.find((o) => String(o.tipo || "") === "adicional");
  const esAdicional = Boolean(opAdicional);
  const lineaBase = esAdicional && baseText ? baseText : "";
  const lineaExtra = esAdicional && diffIn ? `Extra: ${diffIn.replace(/^\+?\s*/, "")}` : "";

  const fichadasBase = cell?.fichadas_esperadas != null ? Number(cell.fichadas_esperadas) : null;
  const fichadasPreview =
    projIds.length > 0 && !Number.isNaN(fichadasBase)
      ? Math.max(2, projIds.length * 2)
      : fichadasBase;

  const ctx = { personaLabels, turnosPorId };
  const resumenOps = opsDia.map((op) => resumenLineaOutboxOp(op, ctx)).join(" · ");

  const titulos = [...new Set(opsDia.map((o) => TITULO_FLUJO[String(o.tipo || "")] || String(o.tipo || "")))];
  const tooltip = [
    `${titulos.join(" / ")} (pendiente de aplicar)`,
    resumenOps,
    esAdicional ? "Fichadas esperadas (vista previa — aplicar cambios)" : "Vista final en cola — aplicar cambios para persistir",
  ]
    .filter(Boolean)
    .join(" · ");

  const mostrarResultadoFinal = !esAdicional;

  return {
    pending: true,
    mostrarResultadoFinal,
    turnoText: esAdicional && lineaExtra ? lineaBase || turnoText : turnoText,
    lineaBaseMuted: esAdicional ? lineaBase : "",
    lineaExtra,
    diffOut: mostrarResultadoFinal || esAdicional ? "" : diffOut,
    diffIn: mostrarResultadoFinal || esAdicional ? "" : diffIn,
    fichadasPreview,
    fichadasEsPreview: !mostrarResultadoFinal,
    tooltip,
  };
}
