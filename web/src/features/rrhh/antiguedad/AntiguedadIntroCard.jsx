import { useState } from "react";

import Card from "../../../components/ui/Card.jsx";

export function AntiguedadIntroCard() {
  const [guiaAbierta, setGuiaAbierta] = useState(false);

  return (
    <>
      <Card className="print:hidden px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Antigüedad</h1>
          <button
            type="button"
            onClick={() => setGuiaAbierta(true)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Ver guía de cálculo
          </button>
        </div>
      </Card>

      {guiaAbierta ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 px-4 py-4 md:py-8">
          <div className="w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:max-h-[90vh] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">Guía de cálculo de antigüedad (solo lectura)</p>
                <p className="mt-1 text-sm text-slate-600">Referencia operativa para interpretar el resultado.</p>
              </div>
              <button
                type="button"
                onClick={() => setGuiaAbierta(false)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">Cómo se calcula la antigüedad</p>
              <p className="mt-2">1. HLC: períodos fusionados (sin doble conteo) y expresados en años/meses/días (base 365/30).</p>
              <p className="mt-2">
                2. Crédito externo: los años/meses/días informados se suman a ese desglose (sin analizar solapamiento con períodos
                HLC), solo si la fecha de cálculo es igual o posterior a la fecha de implementación.
              </p>
              <p className="mt-2">
                3. Acarreo: si los días suman más de 29, suma 1 mes y resta 30 días; si los meses suman más de 11, suma 1 año y
                resta 12 meses.
              </p>
              <p className="mt-2">4. El total en días mostrado es referencial (365/30) a partir del resultado final A/M/D.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
