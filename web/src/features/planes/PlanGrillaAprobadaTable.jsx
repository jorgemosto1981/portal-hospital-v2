import {
  etiquetaCeldaAprobada,
  varianteCeldaAprobada,
} from "./planGrillaAprobadaDisplay.js";
import { columnasMetadataGrilla, ymdDesdeClave } from "./planGrillaColumnas.js";
import {
  claseHeaderColumna,
  claseTdColumna,
  claseHeaderAgenteSticky,
  claseCeldaAgenteSticky,
  clasesTextoCelda,
  claseFondoCeldaCalendarioTitular,
} from "../grilla/grillaTurnosVisual.js";
import GrillaTurnosCeldaChip from "../grilla/GrillaTurnosCeldaChip.jsx";
import GrillaTurnosLeyenda from "../grilla/GrillaTurnosLeyenda.jsx";
import GrillaFichadasEsperadasBadge from "../grilla/GrillaFichadasEsperadasBadge.jsx";
import {
  fichadasEsperadasDesdeCeldaVis,
  titleFichadasEsperadas,
} from "../grilla/grillaFichadasEsperadasDisplay.js";
import {
  filaKeyAg,
  diaFueraVigenciaTramo,
  formatearRangoTramoMes,
  etiquetaCargaTramo,
} from "../grilla/grillaMesFilasUtils.js";

function labelAgente(ag) {
  const nombre = String(
    ag?.nombre || ag?.nombre_completo || ag?.persona_label || "",
  ).trim();
  const dni = String(ag?.dni || ag?.persona_dni || "").trim();
  if (nombre && dni) return `${nombre} · DNI ${dni}`;
  return nombre || dni || ag?.persona_id || "—";
}

function subtituloTramoAgente(ag) {
  const carga = etiquetaCargaTramo(ag?.carga_horaria_semanal);
  const rango = formatearRangoTramoMes(ag?.vigente_desde, ag?.vigente_hasta);
  const partes = [carga, rango].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/**
 * @param {{
 *   grillaAprobada: object;
 *   labelsPorPersona?: Record<string, { nombre?: string, dni?: string, persona_label?: string }>;
 *   conLeyenda?: boolean;
 * }} props
 */
export default function PlanGrillaAprobadaTable({ grillaAprobada, labelsPorPersona = {}, conLeyenda = false }) {
  if (!grillaAprobada?.agentes?.length) {
    return <p className="text-sm text-slate-500">Sin grilla aprobada registrada.</p>;
  }

  const periodo = grillaAprobada?.periodo || null;
  const columnas = columnasMetadataGrilla(grillaAprobada);

  return (
    <div className="flex min-h-0 flex-col">
      {conLeyenda ? <GrillaTurnosLeyenda className="px-0" /> : null}
      <div className="min-h-0 flex-1 overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="min-w-max border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className={`${claseHeaderAgenteSticky()} h-9 border-b`} />
            {columnas.map((col) => (
              <th
                key={`ds-${col.diaKey}`}
                className={`min-w-[2.5rem] h-9 ${claseHeaderColumna({
                  esFinde: col.esFinde,
                  esFeriado: col.esFeriadoCol,
                })}`}
                title={col.diaKey}
              >
                {col.letra}
              </th>
            ))}
          </tr>
          <tr>
            <th className={`${claseHeaderAgenteSticky()} h-9 border-b`}>
              Agente
            </th>
            {columnas.map((col) => (
              <th
                key={col.diaKey}
                className={`min-w-[2.5rem] h-9 ${claseHeaderColumna({
                  esFinde: col.esFinde,
                  esFeriado: col.esFeriadoCol,
                })}`}
                title={col.diaKey}
              >
                <span className="text-[10px] font-bold">{String(col.num).padStart(2, "0")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grillaAprobada.agentes.map((ag) => {
            const filaKey = filaKeyAg(ag);
            const meta = labelsPorPersona[ag.persona_id] || {};
            const rowLabel = labelAgente({ ...ag, ...meta });
            const tramoLine = subtituloTramoAgente(ag);
            return (
              <tr key={filaKey} className="h-16">
                <td className={claseCeldaAgenteSticky()}>
                  <span className="block truncate text-xs font-semibold text-slate-800">{rowLabel}</span>
                  {tramoLine ? (
                    <span className="mt-0.5 block text-[10px] font-medium text-indigo-700">
                      Tramo: {tramoLine}
                    </span>
                  ) : null}
                </td>
                {columnas.map((col) => {
                  const ymd = ymdDesdeClave(col.diaKey, periodo);
                  const fueraTramo = diaFueraVigenciaTramo(ymd, ag.vigente_desde, ag.vigente_hasta);

                  if (fueraTramo) {
                    return (
                      <td
                        key={`${filaKey}-${col.diaKey}`}
                        className={`${claseFondoCeldaCalendarioTitular({ sinAsignacionGrupo: true })} px-0.5 py-0.5 align-middle`}
                        title={`${ymd} — Fuera de vigencia HLg`}
                      >
                        <div className="mx-auto h-12 w-14" aria-hidden="true" />
                      </td>
                    );
                  }

                  const dias = ag?.dias && typeof ag.dias === "object" ? ag.dias : {};
                  const cel =
                    dias[col.diaKey] ||
                    dias[ymd] ||
                    dias[String(col.num).padStart(2, "0")] ||
                    null;
                  const etiqueta = etiquetaCeldaAprobada(cel);
                  const variant = varianteCeldaAprobada(cel);
                  const fichadasN = fichadasEsperadasDesdeCeldaVis(cel);
                  const titleCel =
                    [ymd, titleFichadasEsperadas(fichadasN)].filter(Boolean).join(" · ") || ymd;
                  return (
                    <td
                      key={`${filaKey}-${col.diaKey}`}
                      className={claseTdColumna({
                        esFinde: col.esFinde,
                        esFeriado: col.esFeriadoCol,
                      })}
                      title={titleCel}
                    >
                      <GrillaTurnosCeldaChip variant={variant} title={ymd}>
                        <span className="flex flex-col items-center leading-none">
                          <span className={clasesTextoCelda(etiqueta)}>{etiqueta || "—"}</span>
                          <GrillaFichadasEsperadasBadge valor={fichadasN} />
                        </span>
                      </GrillaTurnosCeldaChip>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
