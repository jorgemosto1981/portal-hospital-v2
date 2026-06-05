import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import { claseFondoCeldaCalendarioTitular } from "./grillaTurnosVisual.js";
import { celdaTieneJornadaVis } from "./grillaMesEquipoDisplay.js";
import { titularDiaAsignadoAGrupo } from "./grillaTitularAsignacionDia.js";
import GrillaFichadasEsperadasBadge from "./GrillaFichadasEsperadasBadge.jsx";
import { fichadasEsperadasDesdeCeldaVis, titleFichadasEsperadas } from "./grillaFichadasEsperadasDisplay.js";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Altura mínima de celda: escala con ancho de pantalla (7 columnas en móvil). */
const CLASE_CELDA_BASE =
  "relative flex min-h-[clamp(4.75rem,15vw,7.75rem)] flex-col items-center justify-between gap-1 rounded-none py-1.5 px-0.5 text-center font-semibold sm:min-h-[6.5rem] sm:gap-1.5 sm:py-2";

const CLASE_NUMERO_DIA =
  "relative z-[1] shrink-0 text-[clamp(0.7rem,2.8vw,0.95rem)] font-bold tabular-nums leading-none sm:text-sm";

const CLASE_CHIP =
  "relative z-[1] max-w-full rounded-md border-2 px-1.5 py-0.5 text-[clamp(0.58rem,2.4vw,0.8rem)] font-bold leading-tight tracking-tight sm:px-2 sm:text-xs";

const CLASE_LICENCIA =
  "relative z-[12] max-w-full shrink-0 truncate px-0.5 text-[clamp(0.55rem,2.2vw,0.75rem)] font-bold leading-tight text-violet-950 drop-shadow-sm sm:text-[11px]";

function primerDiaSemana(anio, mes) {
  const d = new Date(anio, mes - 1, 1).getDay();
  return d === 0 ? 7 : d;
}

function etiquetaInstitucional(tipoEvento) {
  const t = String(tipoEvento || "").trim().toLowerCase();
  if (t === "asueto") return "Asueto";
  if (t === "feriado") return "Feriado";
  return "Feriado";
}

function OverlaySinAsignacionGrupo({ conLicencia = false }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[5] ${
        conLicencia ? "bg-slate-300/35" : "bg-slate-300/55"
      }`}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(100,116,139,0.45) 5px, rgba(100,116,139,0.45) 7px)",
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center select-none text-[clamp(2rem,9vw,3.25rem)] font-extralight leading-none text-slate-600/70">
        ×
      </span>
    </div>
  );
}

/**
 * Calendario titular — un bounded context (vis_* ya scoped por gdt en backend).
 * @param {{
 *   anio: number;
 *   mes: number;
 *   diasMap: Record<string, object> | null;
 *   grupoLabel?: string;
 *   grupoVistaId?: string;
 *   hlgRows?: Array<Record<string, unknown>>;
 *   hlgListo?: boolean;
 *   etiquetasGrupo?: Record<string, string>;
 *   onDiaClick: (payload: { dia: string; eventos: unknown[]; grupoLabel?: string }) => void;
 * }} props
 */
export default function GrillaMesTitularCalendario({
  anio,
  mes,
  diasMap,
  grupoLabel,
  grupoVistaId,
  hlgRows = [],
  hlgListo = false,
  etiquetasGrupo = {},
  onDiaClick,
}) {
  const map = diasMap && typeof diasMap === "object" ? diasMap : {};
  const totalDias = diasEnMes(anio, mes);
  const offset = primerDiaSemana(anio, mes) - 1;
  const mesPad = String(mes).padStart(2, "0");

  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 gap-px rounded-xl border border-slate-300 bg-slate-300 p-px">
        {DIAS_SEMANA.map((nombre, idx) => (
          <div
            key={nombre}
            className={`flex h-11 items-center justify-center bg-slate-100 text-center text-[clamp(0.65rem,2.5vw,0.8rem)] font-bold uppercase tracking-wide sm:h-12 sm:text-xs ${
              idx >= 5 ? "text-rose-700" : "text-slate-600"
            }`}
          >
            {nombre}
          </div>
        ))}

        {Array.from({ length: offset }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: totalDias }, (_, i) => {
          const dia = String(i + 1).padStart(2, "0");
          const fechaYmd = `${anio}-${mesPad}-${dia}`;
          const cell = map[dia] || {};
          const colPos = (offset + i) % 7;
          const esFinDeSemana = colPos >= 5;
          const eventos = cell.eventos;
          const label = etiquetaCelda(eventos);
          const tieneEventos = Array.isArray(eventos) && eventos.length > 0;
          const turnoId = cell.rda_turno_id || null;
          const egreso = cell.rda_egreso || null;
          const tipoDia = String(cell.tipo_dia || "").trim().toLowerCase().replace(/\s+/g, "_");
          const jornadaVis = celdaTieneJornadaVis(cell);
          const esNoLaborable =
            !jornadaVis && (tipoDia === "no_laborable" || tipoDia === "no-laborable");
          const esFranco = cell.es_franco === true && !esNoLaborable && !jornadaVis;
          const esFeriado = cell.es_feriado === true;
          const tipoEvento = cell.tipo_evento_institucional || null;
          const asignadoAlGrupo = titularDiaAsignadoAGrupo(hlgRows, grupoVistaId, fechaYmd);
          const sinAsignacionGrupo = hlgListo && !asignadoAlGrupo;

          const tieneDatos =
            tieneEventos || turnoId || esFranco || esNoLaborable || esFeriado || jornadaVis;
          const ingreso = cell.rda_ingreso || null;
          const turnoLabel = esNoLaborable
            ? "NL"
            : esFranco
              ? "F"
              : ingreso && egreso
                ? `${ingreso}–${egreso}`
                : turnoId;
          const bgCelda = claseFondoCeldaCalendarioTitular({
            sinAsignacionGrupo,
            esFinde: esFinDeSemana,
            esFeriado,
            esNoLaborable: esNoLaborable && asignadoAlGrupo,
            esLaborable: jornadaVis && asignadoAlGrupo,
          });
          const chipNl = "border-slate-600 bg-slate-600 text-white";
          const chipFranco = "border-slate-500 bg-slate-500 text-white";
          const chipTurno = "border-emerald-700 bg-emerald-200 text-emerald-950";
          const chipFeriado = "border-amber-700 bg-amber-200 text-amber-950";
          const tachado = tieneEventos && turnoId ? "line-through opacity-60" : "";
          const titleParts = [];
          if (sinAsignacionGrupo) {
            titleParts.push("Sin asignación a este grupo en esta fecha");
          }
          if (esFeriado && tipoEvento) {
            titleParts.push(etiquetaInstitucional(tipoEvento));
          }
          if (turnoLabel) titleParts.push(turnoLabel);
          const fichadasN = fichadasEsperadasDesdeCeldaVis(cell);
          const fichadasTitle = titleFichadasEsperadas(fichadasN);
          if (fichadasTitle) titleParts.push(fichadasTitle);

          return (
            <GrillaMesCeldaLicencia
              key={dia}
              eventos={Array.isArray(eventos) ? eventos : []}
              dia={dia}
              grupoVistaId={grupoVistaId}
              etiquetasGrupo={etiquetasGrupo}
              disabled={!tieneDatos}
              onClick={() =>
                tieneDatos &&
                onDiaClick({
                  dia,
                  eventos: Array.isArray(eventos) ? eventos : [],
                  grupoLabel: grupoLabel || cell.etiqueta_grupo_corta || null,
                })
              }
              className={`${CLASE_CELDA_BASE} ${bgCelda}`}
              title={titleParts.join(" · ") || undefined}
            >
              {sinAsignacionGrupo ? (
                <OverlaySinAsignacionGrupo conLicencia={tieneEventos} />
              ) : null}
              <span
                className={`${CLASE_NUMERO_DIA} ${esFinDeSemana ? "text-rose-700" : "text-slate-800"}`}
              >
                {Number(dia)}
              </span>
              <div className="relative z-[1] flex w-full min-h-0 flex-1 flex-col items-center justify-center gap-1">
                {esFeriado && asignadoAlGrupo ? (
                  <span className={`${CLASE_CHIP} uppercase ${chipFeriado}`}>
                    {etiquetaInstitucional(tipoEvento)}
                  </span>
                ) : null}
                {turnoLabel && !esNoLaborable && asignadoAlGrupo ? (
                  <span className={`${CLASE_CHIP} flex flex-col items-center tabular-nums ${chipTurno} ${tachado}`}>
                    <span>{turnoLabel}</span>
                    <GrillaFichadasEsperadasBadge valor={fichadasN} />
                  </span>
                ) : null}
                {esFranco && !turnoLabel && !tieneEventos && !esFeriado && asignadoAlGrupo ? (
                  <span className={`${CLASE_CHIP} ${chipFranco}`}>F</span>
                ) : null}
                {esNoLaborable && asignadoAlGrupo ? (
                  <span className={`${CLASE_CHIP} ${chipNl}`}>NL</span>
                ) : null}
              </div>
              {label ? <span className={CLASE_LICENCIA}>{label}</span> : <span className="h-0 shrink-0" aria-hidden />}
            </GrillaMesCeldaLicencia>
          );
        })}
      </div>
    </div>
  );
}
