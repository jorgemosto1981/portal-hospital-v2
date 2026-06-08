import { diasEnMes, etiquetaCelda, celdaTieneDesalineacionTeoria } from "./grillaMesCellUtils.js";
import {
  evaluarImputacionExternaCelda,
  evaluarLicenciaEnFrancoCelda,
  evaluarPostPurgeHlgCelda,
  evaluarTeoriaPendienteLazyCelda,
} from "./grillaMesGsoHints.js";
import { evaluarSoloLecturaCeldaGso } from "./grillaGsoSoloLectura.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import { claseFondoCeldaCalendarioTitular } from "./grillaTurnosVisual.js";
import { celdaTieneJornadaVis, celdaEsIncompletoPlanVis, textoHorarioTurno } from "./grillaMesEquipoDisplay.js";
import { titularDiaAsignadoAGrupo } from "./grillaTitularAsignacionDia.js";
import GrillaFichadasEsperadasBadge from "./GrillaFichadasEsperadasBadge.jsx";
import { fichadasEsperadasDesdeCeldaVis, titleFichadasEsperadas } from "./grillaFichadasEsperadasDisplay.js";
import { diaFueraVigenciaTramo } from "./grillaMesFilasUtils.js";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CLASE_CELDA_BASE =
  "relative flex min-h-[clamp(4.75rem,15vw,7.75rem)] flex-col items-center justify-between gap-1 rounded-none py-1.5 px-0.5 text-center font-semibold sm:min-h-[6.5rem] sm:gap-1.5 sm:py-2";

const CLASE_NUMERO_DIA =
  "relative z-[1] shrink-0 text-[clamp(0.7rem,2.8vw,0.95rem)] font-bold tabular-nums leading-none sm:text-sm";

const CLASE_CHIP =
  "relative z-[1] max-w-full rounded-md border-2 px-1.5 py-0.5 text-[clamp(0.58rem,2.4vw,0.8rem)] font-bold leading-tight tracking-tight sm:px-2 sm:text-xs";

const CLASE_LICENCIA =
  "relative z-[12] max-w-full shrink-0 truncate px-0.5 text-[clamp(0.55rem,2.2vw,0.75rem)] font-bold leading-tight text-white drop-shadow-md sm:text-[11px]";

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

function celdaVacia(key) {
  return <div key={key} aria-hidden />;
}

/**
 * Calendario titular — un tramo HLg (vis scoped por gdt en backend).
 * @param {{
 *   anio: number;
 *   mes: number;
 *   diasMap: Record<string, object> | null;
 *   grupoLabel?: string;
 *   grupoVistaId?: string;
 *   vigenteDesde?: string | null;
 *   vigenteHasta?: string | null;
 *   hlgRows?: Array<Record<string, unknown>>;
 *   hlgListo?: boolean;
 *   etiquetasGrupo?: Record<string, string>;
 *   gsoPermiteEscritura?: boolean;
 *   gsoSoloLecturaMotivo?: string | null;
 *   materializadoLazy?: boolean;
 *   onDiaClick: (payload: { dia: string; eventos: unknown[]; grupoLabel?: string }) => void;
 * }} props
 */
export default function GrillaMesTitularCalendario({
  anio,
  mes,
  diasMap,
  grupoLabel,
  grupoVistaId,
  vigenteDesde = null,
  vigenteHasta = null,
  hlgRows = [],
  hlgListo = false,
  etiquetasGrupo = {},
  gsoPermiteEscritura = true,
  gsoSoloLecturaMotivo = null,
  materializadoLazy = false,
  onDiaClick,
}) {
  const map = diasMap && typeof diasMap === "object" ? diasMap : {};
  const totalDias = diasEnMes(anio, mes);
  const offset = primerDiaSemana(anio, mes) - 1;
  const mesPad = String(mes).padStart(2, "0");
  const usaTramoExplicito = Boolean(vigenteDesde && vigenteHasta);

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
          const eventos = cell.eventos;
          const labelLicencia = etiquetaCelda(eventos);
          const tieneLicencia = Boolean(labelLicencia);
          const tieneEventos = Array.isArray(eventos) && eventos.length > 0;

          const fueraTramo = usaTramoExplicito
            ? diaFueraVigenciaTramo(fechaYmd, vigenteDesde, vigenteHasta)
            : false;
          const asignadoAlGrupo = titularDiaAsignadoAGrupo(hlgRows, grupoVistaId, fechaYmd);
          const sinAsignacionGrupo = !usaTramoExplicito && hlgListo && !asignadoAlGrupo;
          const celdaInactiva = fueraTramo || sinAsignacionGrupo;

          if (celdaInactiva) {
            return celdaVacia(`pad-hlg-${dia}`);
          }

          const colPos = (offset + i) % 7;
          const esFinDeSemana = colPos >= 5;
          const turnoId = cell.rda_turno_id || null;
          const egreso = cell.rda_egreso || null;
          const tipoDia = String(cell.tipo_dia || "").trim().toLowerCase().replace(/\s+/g, "_");
          const jornadaVis = celdaTieneJornadaVis(cell);
          const esNoLaborable =
            !jornadaVis && (tipoDia === "no_laborable" || tipoDia === "no-laborable");
          const esFranco = cell.es_franco === true && !esNoLaborable && !jornadaVis;
          const esFeriado = cell.es_feriado === true;
          const tipoEvento = cell.tipo_evento_institucional || null;
          const esIncompletoPlan = celdaEsIncompletoPlanVis(cell);
          const desalineacion = celdaTieneDesalineacionTeoria(eventos, cell);
          const desalineacionTeoria = desalineacion.desalineado;
          const imputacion = evaluarImputacionExternaCelda(eventos, grupoVistaId, etiquetasGrupo);
          const postPurge = evaluarPostPurgeHlgCelda(cell, eventos, {
            fechaYmd,
            vigenteHasta,
          });
          const teoriaPendiente = evaluarTeoriaPendienteLazyCelda(cell, eventos, {
            fechaYmd,
            vigenteHasta,
            materializadoLazy,
            postPurgeActivo: postPurge.activo,
          });
          const licenciaFranco = evaluarLicenciaEnFrancoCelda(cell, eventos);
          const esLaborable = !esFranco && !esNoLaborable && (jornadaVis || Boolean(turnoId) || esIncompletoPlan);

          if (!celdaInactiva && esNoLaborable && !tieneLicencia) {
            return celdaVacia(`pad-nl-${dia}`);
          }

          const ingreso = cell.rda_ingreso || null;
          const turnoLabel = esFranco
            ? "F"
            : textoHorarioTurno(cell) || turnoId;
          const tieneDatos =
            tieneEventos ||
            turnoId ||
            esFranco ||
            esFeriado ||
            jornadaVis ||
            esIncompletoPlan;
          const soloLectura = evaluarSoloLecturaCeldaGso({
            gsoPermiteEscritura,
            motivo: gsoSoloLecturaMotivo,
            tieneDatos: tieneDatos || tieneLicencia,
          });

          const bgCelda =
            teoriaPendiente.activo && tieneLicencia
              ? "bg-slate-200"
              : tieneLicencia
                ? ""
                : claseFondoCeldaCalendarioTitular({
                    esFeriado,
                    esFranco: esFranco && !esFeriado,
                    esLaborable: esLaborable && !esFeriado,
                  });

          const chipTurno = tieneLicencia
            ? "border-white/40 bg-white/25 text-white"
            : "border-emerald-800/40 bg-emerald-200/80 text-emerald-950";
          const chipFranco = "border-slate-600/50 bg-slate-400/60 text-slate-900";
          const chipFeriado = "border-amber-700/50 bg-amber-200/80 text-amber-950";
          const tachado = tieneLicencia && turnoId ? "line-through opacity-70" : "";

          const titleParts = [];
          if (tieneLicencia) titleParts.push(`Licencia: ${labelLicencia}`);
          if (esFeriado && tipoEvento) titleParts.push(etiquetaInstitucional(tipoEvento));
          if (turnoLabel && !esNoLaborable) titleParts.push(turnoLabel);
          const fichadasN = fichadasEsperadasDesdeCeldaVis(cell);
          const fichadasTitle = titleFichadasEsperadas(fichadasN);
          if (fichadasTitle) titleParts.push(fichadasTitle);
          if (esIncompletoPlan) titleParts.push("Laborable sin turno (corregir plan del mes)");
          if (desalineacionTeoria && desalineacion.tooltip) {
            titleParts.push(desalineacion.tooltip);
          }
          if (imputacion.activo && imputacion.tooltip) titleParts.push(imputacion.tooltip);
          if (postPurge.activo && postPurge.tooltip) titleParts.push(postPurge.tooltip);
          if (teoriaPendiente.activo && teoriaPendiente.tooltip) {
            titleParts.push(teoriaPendiente.tooltip);
          }
          if (licenciaFranco.activo && licenciaFranco.tooltip) {
            titleParts.push(licenciaFranco.tooltip);
          }
          if (soloLectura.activo && soloLectura.tooltip) titleParts.push(soloLectura.tooltip);

          const colorNumero =
            teoriaPendiente.activo && tieneLicencia
              ? "text-slate-800"
              : tieneLicencia
            ? "text-white"
            : esFeriado
              ? "text-amber-900"
              : esFranco
                ? "text-slate-700"
                : esLaborable
                  ? "text-emerald-900"
                  : esFinDeSemana
                    ? "text-rose-700"
                    : "text-slate-800";

          return (
            <GrillaMesCeldaLicencia
              key={dia}
              eventos={Array.isArray(eventos) ? eventos : []}
              celdaVis={cell}
              dia={dia}
              grupoVistaId={grupoVistaId}
              etiquetasGrupo={etiquetasGrupo}
              disabled={!tieneDatos && !tieneLicencia}
              onClick={() =>
                (tieneDatos || tieneLicencia) &&
                onDiaClick({
                  dia,
                  eventos: Array.isArray(eventos) ? eventos : [],
                  grupoLabel: grupoLabel || cell.etiqueta_grupo_corta || null,
                })
              }
              className={`${CLASE_CELDA_BASE} ${bgCelda}`.trim()}
              title={titleParts.join(" · ") || undefined}
            >
              <span className={`${CLASE_NUMERO_DIA} ${colorNumero}`}>{Number(dia)}</span>
              <div className="relative z-[1] flex w-full min-h-0 flex-1 flex-col items-center justify-center gap-1">
                {esFeriado && !tieneLicencia ? (
                  <span className={`${CLASE_CHIP} uppercase ${chipFeriado}`}>
                    {etiquetaInstitucional(tipoEvento)}
                  </span>
                ) : null}
                {turnoLabel && !esFranco && !esFeriado ? (
                  <span className={`${CLASE_CHIP} flex flex-col items-center tabular-nums ${chipTurno} ${tachado}`}>
                    <span>{turnoLabel}</span>
                    <GrillaFichadasEsperadasBadge valor={fichadasN} />
                  </span>
                ) : null}
                {esFranco && !tieneLicencia && !esFeriado ? (
                  <span className={`${CLASE_CHIP} ${chipFranco}`}>F</span>
                ) : null}
                {esIncompletoPlan && !tieneEventos ? (
                  <span className={`${CLASE_CHIP} border-rose-700 bg-rose-100 text-[8px] font-bold text-rose-950`}>
                    Sin turno
                  </span>
                ) : null}
              </div>
              {labelLicencia ||
              soloLectura.activo ||
              desalineacionTeoria ||
              imputacion.activo ||
              postPurge.activo ||
              teoriaPendiente.activo ||
              licenciaFranco.activo ? (
                <span
                  className={`${
                    labelLicencia
                      ? teoriaPendiente.activo
                        ? "relative z-[12] max-w-full shrink-0 truncate px-0.5 text-[clamp(0.55rem,2.2vw,0.75rem)] font-bold leading-tight text-slate-800 sm:text-[11px]"
                        : CLASE_LICENCIA
                      : "relative z-[12] flex items-center gap-0.5 text-[10px] font-bold text-slate-700"
                  } flex items-center gap-0.5`}
                >
                  {desalineacionTeoria ? (
                    <span title={desalineacion.tooltip || "Teoría modificada post-licencia"} aria-hidden>
                      ⚠
                    </span>
                  ) : null}
                  {imputacion.activo ? (
                    <span title={imputacion.tooltip} aria-hidden>
                      🔗
                    </span>
                  ) : null}
                  {postPurge.activo ? (
                    <span title={postPurge.tooltip} aria-hidden>
                      📅
                    </span>
                  ) : null}
                  {teoriaPendiente.activo ? (
                    <span title={teoriaPendiente.tooltip} aria-hidden>
                      ⏳
                    </span>
                  ) : null}
                  {licenciaFranco.activo ? (
                    <span title={licenciaFranco.tooltip} aria-hidden>
                      ℹ️
                    </span>
                  ) : null}
                  {soloLectura.activo ? (
                    <span title={soloLectura.tooltip} aria-hidden>
                      🔒
                    </span>
                  ) : null}
                  {labelLicencia}
                </span>
              ) : (
                <span className="h-0 shrink-0" aria-hidden />
              )}
            </GrillaMesCeldaLicencia>
          );
        })}
      </div>
    </div>
  );
}
