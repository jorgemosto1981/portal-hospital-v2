import {
  etiquetaCeldaAprobada,
  varianteCeldaAprobada,
} from "./planGrillaAprobadaDisplay.js";
import { columnasMetadataGrilla } from "./planGrillaColumnas.js";
import {
  claseHeaderColumna,
  claseTdColumna,
  claseHeaderAgenteSticky,
  claseCeldaAgenteSticky,
  clasesTextoCelda,
} from "../grilla/grillaTurnosVisual.js";
import GrillaTurnosCeldaChip from "../grilla/GrillaTurnosCeldaChip.jsx";
import GrillaTurnosLeyenda from "../grilla/GrillaTurnosLeyenda.jsx";
import GrillaFichadasEsperadasBadge from "../grilla/GrillaFichadasEsperadasBadge.jsx";
import {
  fichadasEsperadasDesdeCeldaVis,
  titleFichadasEsperadas,
} from "../grilla/grillaFichadasEsperadasDisplay.js";

function labelAgente(ag) {
  const nombre = String(
    ag?.nombre || ag?.nombre_completo || ag?.persona_label || "",
  ).trim();
  const dni = String(ag?.dni || ag?.persona_dni || "").trim();
  if (nombre && dni) return `${nombre} · DNI ${dni}`;
  return nombre || dni || ag?.persona_id || "—";
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
            const meta = labelsPorPersona[ag.persona_id] || {};
            const rowLabel = labelAgente({ ...ag, ...meta });
            return (
              <tr key={ag.persona_id} className="h-16">
                <td className={claseCeldaAgenteSticky()}>
                  <span className="block truncate text-xs font-semibold text-slate-800">{rowLabel}</span>
                </td>
                {columnas.map((col) => {
                  const dias = ag?.dias && typeof ag.dias === "object" ? ag.dias : {};
                  const cel =
                    dias[col.diaKey] ||
                    dias[String(col.num).padStart(2, "0")] ||
                    null;
                  const etiqueta = etiquetaCeldaAprobada(cel);
                  const variant = varianteCeldaAprobada(cel);
                  const fichadasN = fichadasEsperadasDesdeCeldaVis(cel);
                  const titleCel =
                    [col.diaKey, titleFichadasEsperadas(fichadasN)].filter(Boolean).join(" · ") || col.diaKey;
                  return (
                    <td
                      key={`${ag.persona_id}-${col.diaKey}`}
                      className={claseTdColumna({
                        esFinde: col.esFinde,
                        esFeriado: col.esFeriadoCol,
                      })}
                      title={titleCel}
                    >
                      <GrillaTurnosCeldaChip variant={variant} title={col.diaKey}>
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
