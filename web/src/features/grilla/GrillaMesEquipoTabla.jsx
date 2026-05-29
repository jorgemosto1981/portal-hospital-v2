import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import {
  columnasCalendario,
  institucionalPorDiaEnFilas,
  textoHorarioTurno,
  etiquetaInstitucional,
  claseFondoColumna,
  claseFondoCelda,
} from "./grillaMesEquipoDisplay.js";

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   filas: Array<Record<string, unknown>>;
 *   grupoSeleccionado?: string;
 *   onCeldaClick: (payload: {
 *     dia: string; fechaYmd: string; personaId: string; eventos: unknown[];
 *     personaLabel?: string; grupoLabel?: string;
 *     turnoTeorico?: { rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> };
 *   }) => void;
 * }} props
 */
export default function GrillaMesEquipoTabla({ anio, mes, filas, grupoSeleccionado, onCeldaClick }) {
  const totalDias = diasEnMes(anio, mes);
  const columnas = columnasCalendario(anio, mes);
  const institucionalPorDia = institucionalPorDiaEnFilas(filas, totalDias);

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="min-w-full table-fixed border-collapse text-[10px]">
        <thead>
          <tr className="text-slate-400">
            <th className="h-9 w-[12rem] border border-slate-300 bg-slate-100 px-2 py-0.5" />
            {columnas.map((c) => (
              <th
                key={`ds-${c.dia}`}
                className={`h-9 border border-slate-300 px-0 py-0.5 text-[8px] font-semibold ${claseFondoColumna({
                  esFinde: c.esFinde,
                  tipoInstitucional: institucionalPorDia[c.dia],
                })}`}
              >
                {c.letra}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50 text-slate-600">
            <th className="h-9 w-[12rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left text-xs font-semibold text-slate-700">
              Persona
            </th>
            {columnas.map((c) => (
              <th
                key={c.dia}
                className={`h-9 border border-slate-300 px-0.5 py-1 text-center font-semibold ${claseFondoColumna({
                  esFinde: c.esFinde,
                  tipoInstitucional: institucionalPorDia[c.dia],
                })}`}
              >
                {c.num}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
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
                <tr key={String(fila.persona_id)} className="align-middle">
                  <td className="w-[12rem] truncate border border-slate-300 bg-white px-2 py-2 text-left text-[11px] font-semibold leading-snug text-slate-800">
                    {personaLabel}
                  </td>
                  {columnas.map((col) => {
                    const dia = col.dia;
                    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
                    const cell = dias[dia] || {};
                    const cellGdt = cell.grupo_de_trabajo_id || null;
                    const esOtroGrupo = grupoSeleccionado && cellGdt && cellGdt !== grupoSeleccionado;

                    if (esOtroGrupo) {
                      const otroLabel = cell.etiqueta_grupo_corta || cellGdt;
                      const corta = otroLabel.length > 5 ? otroLabel.slice(0, 4) + "…" : otroLabel;
                      return (
                        <td key={dia} className="h-14 border border-slate-300 bg-slate-100 p-0 align-middle">
                          <div
                            className="flex h-14 min-w-[2rem] items-center justify-center"
                            title={`Asignado a ${otroLabel}`}
                          >
                            <span className="text-[7px] text-slate-400">{corta}</span>
                          </div>
                        </td>
                      );
                    }

                    const eventos = cell.eventos;
                    const licenciaCod = etiquetaCelda(eventos);
                    const tieneLicencia = Boolean(licenciaCod);
                    const turnoText = textoHorarioTurno(cell);
                    const tieneTurno = Boolean(turnoText && turnoText !== "F");
                    const esFranco = cell.es_franco === true || turnoText === "F";
                    const tipoInstCol = institucionalPorDia[dia];
                    const tipoInstCel = cell.tipo_evento_institucional || tipoInstCol;
                    const esInstitucional = Boolean(
                      tipoInstCol || cell.es_feriado === true || tipoInstCel === "feriado" || tipoInstCel === "asueto",
                    );

                    const tieneDatos = tieneLicencia || tieneTurno || esFranco || esInstitucional;
                    const ingreso = cell.rda_ingreso || null;
                    const egreso = cell.rda_egreso || null;
                    const turnoId = cell.rda_turno_id || null;
                    const grupoLabel = cell.etiqueta_grupo_corta || null;

                    const titleParts = [];
                    if (esInstitucional && tipoInstCel) {
                      titleParts.push(
                        tipoInstCel === "feriado" ? "Feriado" : tipoInstCel === "asueto" ? "Asueto" : "Día institucional",
                      );
                    }
                    if (turnoText) titleParts.push(turnoText);
                    if (licenciaCod) titleParts.push(`Licencia: ${licenciaCod}`);

                    let contenido;
                    if (tieneLicencia && (tieneTurno || esFranco)) {
                      contenido = (
                        <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
                          <span className={`text-[9px] font-semibold ${esInstitucional ? "text-amber-900" : "text-slate-800"}`}>
                            {turnoText}
                          </span>
                          <span className="text-[8px] font-bold text-slate-900">{licenciaCod.slice(0, 4)}</span>
                        </span>
                      );
                    } else if (tieneLicencia) {
                      contenido = <span className="text-[9px] font-bold">{licenciaCod.slice(0, 4)}</span>;
                    } else if (esInstitucional && !tieneTurno) {
                      contenido = (
                        <span className="text-[9px] font-bold text-amber-800">
                          {etiquetaInstitucional(tipoInstCel || tipoInstCol)}
                        </span>
                      );
                    } else {
                      contenido = (
                        <span className={`text-[9px] font-semibold ${esInstitucional ? "text-amber-800" : "text-slate-800"}`}>
                          {turnoText}
                        </span>
                      );
                    }

                    return (
                      <td
                        key={dia}
                        className={`h-14 border border-slate-300 p-0 align-middle ${claseFondoCelda({
                          esFinde: col.esFinde,
                          tipoInstitucional: tipoInstCol,
                          tieneLicencia,
                          esFranco,
                          tieneTurno,
                        })}`}
                      >
                        <GrillaMesCeldaLicencia
                          eventos={Array.isArray(eventos) ? eventos : []}
                          personaLabel={personaLabel}
                          dia={dia}
                          disabled={!tieneDatos}
                          onClick={() =>
                            tieneDatos &&
                            onCeldaClick({
                              dia,
                              fechaYmd: `${anio}-${String(mes).padStart(2, "0")}-${dia}`,
                              personaId: String(fila.persona_id || ""),
                              eventos: Array.isArray(eventos) ? eventos : [],
                              personaLabel,
                              grupoLabel,
                              turnoTeorico: {
                                rda_turno_id: turnoId || undefined,
                                es_franco: esFranco,
                                capa_teorica: {
                                  tipo_dia: esFranco ? "franco" : "laborable",
                                  ingreso,
                                  egreso,
                                  es_feriado: esInstitucional,
                                  tipo_evento_institucional: tipoInstCel || undefined,
                                },
                              },
                            })
                          }
                          className="flex h-14 w-full items-center justify-center"
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
