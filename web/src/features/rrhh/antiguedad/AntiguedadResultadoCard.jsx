import Card from "../../../components/ui/Card.jsx";

import { AntiguedadCreditoExternoResumen } from "./AntiguedadCreditoExternoResumen.jsx";
import { AntiguedadEcuacionAmd } from "./AntiguedadEcuacionAmd.jsx";
import { AntiguedadExternosConsideradosSection } from "./AntiguedadExternosConsideradosSection.jsx";
import { AntiguedadExternosExcluidosSection } from "./AntiguedadExternosExcluidosSection.jsx";
import { AntiguedadHlcConsideradasSection } from "./AntiguedadHlcConsideradasSection.jsx";
import { AntiguedadIntervalosFusionadosSection } from "./AntiguedadIntervalosFusionadosSection.jsx";
import { AntiguedadReglasMotor } from "./AntiguedadReglasMotor.jsx";
import { AntiguedadSintesisComputo } from "./AntiguedadSintesisComputo.jsx";
import { AntiguedadTotalCalculado } from "./AntiguedadTotalCalculado.jsx";
import { formatDdMmAaaa } from "./dateIso.js";

export function AntiguedadResultadoCard({
  resultado,
  personaSeleccionadaLabel,
  personaId,
  fechaCorteResumenDdMm,
  onCopiarResumen,
  onImprimir,
  idxEscalafon,
  idxAgrupamiento,
  idxTipoVinculo,
}) {
  const det = resultado?.detalleCalculo;
  const hlcConsideradasCount = det?.hlcConsideradas?.length ?? 0;
  const detalleKey = det?.fechaCorteAplicada ? `${det.fechaCorteAplicada}-${hlcConsideradasCount}` : "sin-detalle";

  return (
    <Card className="print:break-inside-avoid px-4 py-4 md:px-5 print:border print:border-slate-300 print:shadow-none">
      <div className="mb-3 hidden print:block">
        <h1 className="text-lg font-bold text-slate-900">Antigüedad — impresión</h1>
        <p className="mt-1 text-sm text-slate-800">
          {personaSeleccionadaLabel || "—"}{" "}
          {personaId ? <span className="italic text-slate-600">({personaId})</span> : null}
        </p>
        <p className="text-xs text-slate-600">Fecha de corte: {fechaCorteResumenDdMm}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-base font-semibold text-slate-900">Resultado</h2>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={onCopiarResumen}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Copiar resumen
          </button>
          <button
            type="button"
            onClick={onImprimir}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Imprimir
          </button>
        </div>
      </div>

      <AntiguedadTotalCalculado resultado={resultado} />
      <AntiguedadEcuacionAmd detalleCalculo={det} />
      <AntiguedadReglasMotor reglasAplicadas={det?.reglasAplicadas} />
      <AntiguedadSintesisComputo resultado={resultado} />

      <p className="mt-1 text-xs text-slate-500">
        Corte aplicado: {formatDdMmAaaa(det?.fechaCorteAplicada || "")}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        HLC válidas: {det?.resumen?.cantidadHlcValidas || 0} · Intervalos fusionados:{" "}
        {det?.resumen?.cantidadIntervalosFusionados || 0}
      </p>

      <AntiguedadHlcConsideradasSection
        items={det?.hlcConsideradas}
        detalleKey={detalleKey}
        hlcConsideradasCount={hlcConsideradasCount}
        idxEscalafon={idxEscalafon}
        idxAgrupamiento={idxAgrupamiento}
        idxTipoVinculo={idxTipoVinculo}
      />
      <AntiguedadIntervalosFusionadosSection
        intervalos={det?.intervalosFusionados}
        fechaCorteIso={det?.fechaCorteAplicada || ""}
        detalleKey={detalleKey}
      />

      <AntiguedadCreditoExternoResumen detalleCalculo={det} />
      <AntiguedadExternosConsideradosSection items={det?.externosConsiderados} />
      <AntiguedadExternosExcluidosSection items={det?.externosExcluidosPorCorte} />
    </Card>
  );
}
