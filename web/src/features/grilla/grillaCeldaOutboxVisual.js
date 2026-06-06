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
    "Fichadas esperadas (vista previa — aplicar cambios)",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    pending: true,
    turnoText: esAdicional && lineaExtra ? lineaBase || turnoText : turnoText,
    lineaBaseMuted: esAdicional ? lineaBase : "",
    lineaExtra,
    diffOut: esAdicional ? "" : diffOut,
    diffIn: esAdicional ? "" : diffIn,
    fichadasPreview,
    fichadasEsPreview: true,
    tooltip,
  };
}
