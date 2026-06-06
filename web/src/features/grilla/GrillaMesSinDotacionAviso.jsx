/**
 * Aviso: sector en catálogo pero sin HLg vigente al cierre del mes.
 * @param {{ grupoLabel?: string; periodoLabel: string; compact?: boolean }} props
 */
export default function GrillaMesSinDotacionAviso({
  grupoLabel = "este sector",
  periodoLabel,
  compact = false,
}) {
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
        No hay agentes con HLg vigente al cierre de {periodoLabel} en {grupoLabel}. El sector sigue en
        el catálogo institucional; revisá asignaciones laborales o elegí otro mes.
      </p>
    </div>
  );
}
