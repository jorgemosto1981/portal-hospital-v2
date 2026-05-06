import Card from "../../../components/ui/Card.jsx";

export function AntiguedadIntroCard() {
  return (
    <Card className="print:hidden px-4 py-5 md:px-6">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Antigüedad</h1>
      <p className="mt-2 text-sm text-slate-600">
        HLC: se fusionan solapes solo entre cargos (misma persona). Crédito externo: suma administrativa A/M/D tras validar
        fechas; no se cruza con fechas de HLC.
      </p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-800">Cómo se calcula la antigüedad</p>
        <p className="mt-1">1. HLC: períodos fusionados (sin doble conteo) y expresados en años/meses/días (base 365/30).</p>
        <p className="mt-1">
          2. Crédito externo: los años/meses/días informados se suman a ese desglose (sin analizar solapamiento con períodos
          HLC), solo si la fecha de cálculo es igual o posterior a la fecha de implementación.
        </p>
        <p className="mt-1">
          3. Acarreo: si los días suman más de 29, suma 1 mes y resta 30 días; si los meses suman más de 11, suma 1 año y
          resta 12 meses.
        </p>
        <p className="mt-1">4. El total en días mostrado es referencial (365/30) a partir del resultado final A/M/D.</p>
      </div>
    </Card>
  );
}
