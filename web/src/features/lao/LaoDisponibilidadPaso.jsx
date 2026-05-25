import { TICKETERA } from "../solicitudes/ticketeraUi.js";
import { bolsaTieneSaldoPositivoVisible } from "./laoDisplayUtils.js";

/**
 * @param {object} b
 * @param {number} anioCalendarioCivil
 */
function BolsaDisponibleBlock({ b, anioCalendarioCivil }) {
  const anio = Number(b.anio_origen);
  const total = Number.isFinite(Number(b.cantidad_inicial)) ? Number(b.cantidad_inicial) : "—";
  const esLaoAnioEnCurso = Number.isInteger(anioCalendarioCivil) && anio === anioCalendarioCivil;
  const disponiblesLabel = esLaoAnioEnCurso
    ? "proporcional"
    : String(Number.isFinite(Number(b.disponible)) ? b.disponible : "—");

  return (
    <li className="list-none">
      <p className="font-medium text-slate-800">Año LAO = {anio}</p>
      <ul className="mt-0.5 list-none space-y-0.5 pl-4 text-slate-700">
        <li>- Total = {total} Días</li>
        <li>- Disponibles = {disponiblesLabel}</li>
      </ul>
    </li>
  );
}

/**
 * Paso 1 — listado informativo de bolsas (sin selector; consumo = FIFO en backend).
 */
export default function LaoDisponibilidadPaso({ resumen, loading, error, anioCalendarioCivil }) {
  if (loading) {
    return (
      <p className={`${TICKETERA.muted} text-xs`} role="status">
        Consultando saldos…
      </p>
    );
  }

  if (error) {
    return (
      <div className={TICKETERA.alertError} role="alert">
        {error}
      </div>
    );
  }

  if (!resumen) {
    return <p className={`${TICKETERA.muted} text-xs`}>Sin datos de bolsa.</p>;
  }

  const bolsasTodas = Array.isArray(resumen.bolsas_resumen) ? resumen.bolsas_resumen : [];
  const bolsas = bolsasTodas.filter((b) => bolsaTieneSaldoPositivoVisible(b, anioCalendarioCivil));
  const fifo = resumen.fifo?.debe_respetar_fifo === true;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-600">
      <p className="text-base font-semibold text-slate-900">
        Detalle de tu saldo disponible de Licencia Anual Ordinaria:
      </p>
      {bolsas.length === 0 ? (
        <p className="text-slate-600">No tenés bolsas LAO con saldo disponible en este momento.</p>
      ) : (
        <ul className="list-none space-y-3">
          {bolsas.map((b) => (
            <BolsaDisponibleBlock key={b.bolsa_id} b={b} anioCalendarioCivil={anioCalendarioCivil} />
          ))}
        </ul>
      )}

      {fifo ? (
        <p className="text-sm text-amber-900">
          Primero consumí la bolsa del año {resumen.fifo.anio_mas_antiguo_con_saldo} (FIFO).
        </p>
      ) : null}
    </div>
  );
}
