export function CheckinPatronCSection({ articuloCodigo, saldoInicial, setSaldoInicial }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h2 className="text-sm font-semibold text-slate-800">
        Saldo inicial — {articuloCodigo} <span className="font-normal text-slate-500">(patrón C — cuenta continua)</span>
      </h2>
      <p className="text-xs leading-relaxed text-slate-600">
        Bolsa global única. Por defecto <strong>0</strong>. Podés informar saldo positivo (a favor) o negativo (deuda /
        consumo previo).
      </p>
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium text-slate-600">Saldo disponible inicial</span>
        <input
          type="number"
          inputMode="decimal"
          step={1}
          value={saldoInicial}
          onChange={(e) => setSaldoInicial(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base"
        />
        <span className="text-xs text-slate-500">Ej.: 0, 5, −3</span>
      </label>
    </div>
  );
}
