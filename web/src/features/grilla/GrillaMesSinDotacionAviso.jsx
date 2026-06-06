import { copyPostPurgeHlg } from "./grillaMesGsoHints.js";

/**
 * Aviso: sector en catálogo pero sin HLg vigente al cierre del mes (US-5 / Q3-2).
 * @param {{ grupoLabel?: string; periodoLabel: string; fechaCorteHlg?: string|null; compact?: boolean }} props
 */
export default function GrillaMesSinDotacionAviso({
  grupoLabel = "este sector",
  periodoLabel,
  fechaCorteHlg = null,
  compact = false,
}) {
  const copyOficial = copyPostPurgeHlg(fechaCorteHlg);
  return (
    <div
      className={[
        "rounded-xl border border-amber-200 bg-amber-50 text-amber-950",
        compact ? "px-3 py-2 text-xs" : "px-4 py-6 text-sm",
      ].join(" ")}
      role="status"
    >
      <p className={compact ? "font-semibold" : "text-base font-semibold"}>Sin dotación este mes</p>
      <p className={compact ? "mt-1 text-[11px] leading-snug text-amber-900" : "mt-2 text-amber-900"}>
        {copyOficial} En {periodoLabel}, {grupoLabel} no tiene agentes con HLg vigente al cierre del mes.
        Revisá asignaciones laborales o elegí otro período.
      </p>
    </div>
  );
}
