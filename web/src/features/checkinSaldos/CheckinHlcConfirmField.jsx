export function CheckinHlcConfirmField({ checked, onChange, disabled }) {
  return (
    <label
      className={[
        "flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm text-slate-800",
        disabled ? "border-slate-200 bg-slate-50 opacity-60" : "border-amber-200 bg-amber-50/80",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 touch-manipulation"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        Confirmo que las <strong>HLC</strong> del agente (vigentes e históricas) están cargadas y son correctas.
      </span>
    </label>
  );
}
