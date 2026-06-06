/** Tokens MDC (fan-out vis_*) — mantener alineados con mdcFanOutVis.js */
import {
  celdaTieneDesalineacionTeoria,
  evaluarDesalineacionTeoriaLicencia,
} from "../../../../shared/utils/grillaTeoriaDesalineacion.js";

export { celdaTieneDesalineacionTeoria, evaluarDesalineacionTeoriaLicencia };
export const COLOR_MDC_APROBADO = "#3B82F6";
export const COLOR_MDC_PENDIENTE = "#F59E0B";

export function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/** @param {unknown} eventos */
export function eventoPrincipal(eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) return null;
  return eventos[0];
}

/**
 * @param {Record<string, unknown> | null | undefined} evento
 * @param {string} [grupoVistaId]
 */
export function eventoEsImputadoEnOtroGrupo(evento, grupoVistaId) {
  const ancla = String(evento?.grupo_trabajo_id_ancla || "").trim();
  const vista = String(grupoVistaId || "").trim();
  if (!ancla || !vista) return false;
  return ancla !== vista;
}

/**
 * @param {unknown} eventos
 * @param {string} [grupoVistaId]
 */
export function celdaTieneImputacionExterna(eventos, grupoVistaId) {
  if (!Array.isArray(eventos) || !grupoVistaId) return false;
  return eventos.some((ev) => eventoEsImputadoEnOtroGrupo(ev, grupoVistaId));
}

/**
 * @param {Record<string, unknown> | null | undefined} evento
 * @param {Record<string, string>} [etiquetasGrupo]
 */
export function etiquetaGrupoAnclaEvento(evento, etiquetasGrupo = {}) {
  const ancla = String(evento?.grupo_trabajo_id_ancla || "").trim();
  if (!ancla) return "otro sector";
  return etiquetasGrupo[ancla] || ancla;
}

export function etiquetaCelda(eventos) {
  const e = eventoPrincipal(eventos);
  if (!e) return "";
  return String(e.codigo_grilla || "").trim() || "·";
}

export function colorCelda(eventos) {
  const e = eventoPrincipal(eventos);
  if (!e) return null;
  return String(e.color_ui || "#94a3b8");
}

export function celdaPendiente(eventos) {
  return (
    Array.isArray(eventos) &&
    eventos.some((e) => String(e.estado_solicitud_id || "").includes("revision"))
  );
}

export function celdaAprobada(eventos) {
  const e = eventoPrincipal(eventos);
  if (!e) return false;
  if (celdaPendiente(eventos)) return false;
  const c = String(e.color_ui || "").trim().toUpperCase();
  return c === COLOR_MDC_APROBADO || String(e.estado_solicitud_id || "") === "cfg_esa_aprobada";
}

/** @param {string} solId */
export function solIdCorto(solId) {
  const s = String(solId || "").trim();
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-8)}`;
}

/** @param {string} id */
export function labelEstadoSolicitud(id) {
  const e = String(id || "");
  if (e === "cfg_esa_aprobada") return "Aprobada";
  if (e === "cfg_esa_en_revision_jefe") return "En revisión (jefe)";
  if (e === "cfg_esa_rechazada") return "Rechazada";
  if (e === "cfg_esa_en_revision_rrhh") return "En revisión RRHH";
  if (e.includes("revision")) return "En revisión";
  return e || "—";
}

/**
 * @param {unknown} eventos
 * @param {{ personaLabel?: string; dia?: string; grupoVistaId?: string; etiquetasGrupo?: Record<string, string>; celdaVis?: Record<string, unknown> }} [ctx]
 * @returns {string[]}
 */
export function lineasTooltipCelda(eventos, ctx = {}) {
  if (!Array.isArray(eventos) || eventos.length === 0) return [];
  const lines = [];
  if (ctx.personaLabel) lines.push(String(ctx.personaLabel));
  if (ctx.dia) lines.push(`Día ${ctx.dia}`);
  const desal = ctx.celdaVis ? celdaTieneDesalineacionTeoria(eventos, ctx.celdaVis) : null;
  if (desal?.desalineado && desal.tooltip) {
    lines.push(`⚠ ${desal.tooltip}`);
  }
  const max = 3;
  eventos.slice(0, max).forEach((ev, idx) => {
    const cod = String(ev.codigo_grilla || "—");
    const est = labelEstadoSolicitud(ev.estado_solicitud_id);
    const sol = solIdCorto(ev.solicitud_id);
    const prefix = eventos.length > 1 ? `${idx + 1}. ` : "";
    lines.push(`${prefix}${cod} · ${est}`);
    if (eventoEsImputadoEnOtroGrupo(ev, ctx.grupoVistaId)) {
      const nombre = etiquetaGrupoAnclaEvento(ev, ctx.etiquetasGrupo);
      lines.push(`${prefix}🔗 Licencia gestionada en otro sector (${nombre})`);
    }
    lines.push(`${prefix}sol: ${sol}`);
  });
  if (eventos.length > max) {
    lines.push(`+${eventos.length - max} solicitud(es) más — clic para ver`);
  } else {
    lines.push("Clic para detalle y bandeja");
  }
  return lines;
}

/**
 * Estilos de celda: fondo MDC + borde que diferencia pendiente vs consolidado.
 * @param {unknown} eventos
 * @param {{ grupoVistaId?: string }} [opts]
 */
export function estiloVisualCelda(eventos, opts = {}) {
  const tiene = Array.isArray(eventos) && eventos.length > 0;
  if (!tiene) {
    return {
      style: { backgroundColor: "#f8fafc" },
      className: "",
    };
  }
  const pendiente = celdaPendiente(eventos);
  const bg = colorCelda(eventos) || COLOR_MDC_PENDIENTE;
  if (pendiente) {
    return {
      style: { backgroundColor: COLOR_MDC_PENDIENTE },
      className:
        "border-2 border-dashed border-amber-900 text-slate-900 shadow-[inset_0_0_0_1px_rgba(120,53,15,0.25)]",
    };
  }
  return {
    style: { backgroundColor: bg },
    className: "border border-blue-900/25 text-white shadow-sm",
  };
}
