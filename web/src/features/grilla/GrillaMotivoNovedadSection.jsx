import { useEffect, useMemo } from "react";

import {
  CATALOGO_MOTIVOS_NOVEDAD_GSO,
  motivoNovedadPorId,
} from "./grillaMotivosNovedadCatalogo.js";
import { mapearOpcionesNovedadCatalogo } from "./grillaGuardrailsTeoriaUi.js";

/**
 * @param {{
 *   guardrailContext: import("./grillaGuardrailsTeoriaUi.js").GuardrailNovedadContext;
 *   codigoNovedadId: string;
 *   onCodigoNovedadIdChange: (id: string) => void;
 *   motivoDetalle: string;
 *   onMotivoDetalleChange: (value: string) => void;
 *   requiereUrgenciaG1?: boolean;
 *   tituloSeccion?: string;
 *   classNameRing?: string;
 * }} props
 */
export default function GrillaMotivoNovedadSection({
  guardrailContext,
  codigoNovedadId,
  onCodigoNovedadIdChange,
  motivoDetalle,
  onMotivoDetalleChange,
  requiereUrgenciaG1 = false,
  tituloSeccion = "Motivo",
  classNameRing = "focus-visible:ring-violet-500/40",
}) {
  const opciones = useMemo(
    () => mapearOpcionesNovedadCatalogo(CATALOGO_MOTIVOS_NOVEDAD_GSO, guardrailContext),
    [guardrailContext],
  );

  const comboBloqueado = !guardrailContext.puedeModificarTeoria;

  useEffect(() => {
    if (codigoNovedadId) {
      const actual = opciones.find((o) => o.id === codigoNovedadId);
      if (actual && !actual.disabled) return;
    }
    const preferido = requiereUrgenciaG1
      ? opciones.find((o) => o.id === "urgencia_operativa" && !o.disabled)
      : null;
    const primeraHabilitada = opciones.find((o) => !o.disabled);
    const next = preferido || primeraHabilitada;
    if (next && next.id !== codigoNovedadId) {
      onCodigoNovedadIdChange(next.id);
    }
  }, [opciones, requiereUrgenciaG1, codigoNovedadId, onCodigoNovedadIdChange]);

  const novSel = motivoNovedadPorId(codigoNovedadId);

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800">
        {tituloSeccion}
        <span className="font-normal text-rose-700"> *</span>
      </h3>
      <label className="mt-2 block text-xs font-medium text-slate-600">Tipo de novedad</label>
      <select
        value={codigoNovedadId}
        disabled={comboBloqueado}
        onChange={(e) => onCodigoNovedadIdChange(e.target.value)}
        title={comboBloqueado ? "Período restringido para tu rol" : undefined}
        className={`mt-1 flex min-h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${classNameRing}`}
      >
        <option value="">Elegí tipo de novedad…</option>
        {opciones.map((nov) => (
          <option key={nov.id} value={nov.id} disabled={nov.disabled} className={nov.disabled ? "text-slate-400" : ""}>
            {nov.label}
            {!nov.codigoPermitido ? " (Exclusivo RRHH)" : ""}
          </option>
        ))}
      </select>
      {novSel?.requiereAuditoriaCentral ? (
        <p className="mt-1 text-[11px] text-violet-800">Código reservado a auditoría central / RRHH.</p>
      ) : null}
      <label className="mt-3 block text-xs font-medium text-slate-600">Detalle</label>
      <textarea
        rows={2}
        maxLength={500}
        required
        disabled={comboBloqueado}
        value={motivoDetalle}
        onChange={(e) => onMotivoDetalleChange(e.target.value)}
        placeholder={
          requiereUrgenciaG1
            ? "Ampliá la urgencia operativa (obligatorio)…"
            : "Detalle operativo (obligatorio)…"
        }
        className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${classNameRing}`}
      />
    </section>
  );
}
