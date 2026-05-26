import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";

const DIAS_SEMANA_CORTO = ["D", "L", "M", "X", "J", "V", "S"];

function diaSemana(anio, mes, dia) {
  return new Date(anio, mes - 1, dia).getDay();
}

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   filas: Array<Record<string, unknown>>;
 *   grupoSeleccionado?: string;
 *   onCeldaClick: (payload: { dia: string; eventos: unknown[]; personaLabel?: string; grupoLabel?: string }) => void;
 * }} props
 */
export default function GrillaMesEquipoTabla({ anio, mes, filas, grupoSeleccionado, onCeldaClick }) {
  const totalDias = diasEnMes(anio, mes);

  const columnas = Array.from({ length: totalDias }, (_, i) => {
    const ds = diaSemana(anio, mes, i + 1);
    return { num: i + 1, ds, esFinde: ds === 0 || ds === 6 };
  });

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-[10px]">
        <thead>
          <tr className="text-slate-400">
            <th className="sticky left-0 z-10 min-w-[10rem] border border-slate-200 bg-slate-50 px-2 py-0.5" />
            {columnas.map((c) => (
              <th
                key={`ds-${c.num}`}
                className={`border-x border-t border-slate-200 px-0 py-0.5 text-[8px] font-medium ${
                  c.esFinde ? "bg-rose-50 text-rose-400" : "bg-slate-50"
                }`}
              >
                {DIAS_SEMANA_CORTO[c.ds]}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50 text-slate-600">
            <th className="sticky left-0 z-10 min-w-[10rem] border border-slate-200 bg-slate-50 px-2 py-1 text-left">
              Persona
            </th>
            {columnas.map((c) => (
              <th
                key={c.num}
                className={`border border-slate-200 px-0.5 py-1 font-normal ${
                  c.esFinde ? "bg-rose-50/60 text-rose-500" : ""
                }`}
              >
                {c.num}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td
                colSpan={totalDias + 1}
                className="border border-slate-200 px-3 py-6 text-center text-sm text-slate-500"
              >
                Sin datos. Elegí vista y período y pulsá Cargar.
              </td>
            </tr>
          ) : (
            filas.map((fila) => {
              const personaLabel = String(fila.persona_label || fila.persona_id || "");
              return (
                <tr key={String(fila.persona_id)}>
                  <td className="sticky left-0 z-10 max-w-[12rem] truncate border border-slate-200 bg-white px-2 py-1 text-left text-xs font-medium text-slate-800">
                    {personaLabel}
                  </td>
                  {columnas.map((col) => {
                    const dia = String(col.num).padStart(2, "0");
                    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
                    const cell = dias[dia] || {};
                    const cellGdt = cell.grupo_de_trabajo_id || null;
                    const esOtroGrupo = grupoSeleccionado && cellGdt && cellGdt !== grupoSeleccionado;

                    if (esOtroGrupo) {
                      const otroLabel = cell.etiqueta_grupo_corta || cellGdt;
                      const corta = otroLabel.length > 5 ? otroLabel.slice(0, 4) + "…" : otroLabel;
                      return (
                        <td key={dia} className="h-8 border border-slate-100 bg-slate-100 p-0">
                          <div
                            className="flex min-h-8 min-w-[1.75rem] items-center justify-center"
                            title={`Asignado a ${otroLabel}`}
                          >
                            <span className="text-[7px] text-slate-400">{corta}</span>
                          </div>
                        </td>
                      );
                    }

                    const eventos = cell.eventos;
                    const label = etiquetaCelda(eventos);
                    const tiene = Array.isArray(eventos) && eventos.length > 0;
                    const turnoId = cell.rda_turno_id || null;
                    const egreso = cell.rda_egreso || null;
                    const esFranco = cell.es_franco === true;
                    const esFeriado = cell.es_feriado === true;
                    const tipoEvento = cell.tipo_evento_institucional || null;
                    const tieneDatos = tiene || turnoId || esFranco || esFeriado;
                    const bgTurno = esFeriado
                      ? "bg-amber-50"
                      : esFranco ? "bg-slate-50" : turnoId ? "bg-indigo-50" : "";
                    const bgFinde = col.esFinde && !tiene && !esFeriado ? "bg-rose-50/30" : "";
                    const grupoLabel = cell.etiqueta_grupo_corta || null;

                    const turnoCorto = turnoId && egreso ? `${turnoId}–${egreso}` : turnoId;

                    let contenido;
                    if (label) {
                      contenido = label.slice(0, 4);
                    } else if (esFeriado && !turnoId) {
                      contenido = tipoEvento === "feriado" ? "FER" : tipoEvento === "asueto" ? "ASU" : "INST";
                    } else {
                      contenido = turnoCorto || (esFranco ? "F" : "");
                    }

                    const titleParts = [];
                    if (esFeriado && tipoEvento) titleParts.push(tipoEvento === "feriado" ? "Feriado" : tipoEvento === "asueto" ? "Asueto" : "Día institucional");
                    if (turnoCorto) titleParts.push(turnoCorto);

                    return (
                      <td key={dia} className={`h-8 border border-slate-100 p-0 ${bgTurno} ${bgFinde}`}>
                        <GrillaMesCeldaLicencia
                          eventos={Array.isArray(eventos) ? eventos : []}
                          personaLabel={personaLabel}
                          dia={dia}
                          disabled={!tieneDatos}
                          onClick={() =>
                            tieneDatos &&
                            onCeldaClick({
                              dia,
                              eventos: Array.isArray(eventos) ? eventos : [],
                              personaLabel,
                              grupoLabel,
                            })
                          }
                          className={`flex min-h-8 min-w-[1.75rem] items-center justify-center font-semibold ${
                            esFeriado ? "text-amber-700" : ""
                          }`}
                          title={titleParts.join(" · ") || undefined}
                        >
                          {contenido}
                        </GrillaMesCeldaLicencia>
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
