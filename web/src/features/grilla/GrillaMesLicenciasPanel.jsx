import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeJefe, claimsIncludeRrhh } from "../routing/portalRole.js";
import DiaGrillaDetalleModal from "./DiaGrillaDetalleModal.jsx";
import ModalCoberturaParcial from "./ModalCoberturaParcial.jsx";
import GrillaMesEquipoTabla from "./GrillaMesEquipoTabla.jsx";
import GrillaMesTitularCalendario from "./GrillaMesTitularCalendario.jsx";
import GrillaMesSelector from "./GrillaMesSelector.jsx";
import { useAsistenciaOutbox } from "./useAsistenciaOutbox.js";
import { useGrillaMesVista } from "./useGrillaMesVista.js";
import { aplicarBatchAsistencia } from "../../services/coberturaParcialService.js";
import { callCerrarPeriodoLiquidacion } from "../../services/callables.js";
import { RX_GDT } from "./grillaGrupoUtils.js";
import { periodosVentanaJefe } from "../jefe/periodoJefe.js";

function parsePeriodo(periodo) {
  const [yyyy, mm] = String(periodo || "").split("-");
  const anio = Number(yyyy);
  const mes = Number(mm);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

function sumarMeses(basePeriodo, delta) {
  const ref = parsePeriodo(basePeriodo);
  if (!ref) return basePeriodo;
  const d = new Date(ref.anio, ref.mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelPeriodo(periodo) {
  const ref = parsePeriodo(periodo);
  if (!ref) return periodo;
  return new Date(ref.anio, ref.mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {{ variant?: "default" | "rrhh" }} props
 */
export default function GrillaMesLicenciasPanel({ variant = "default" }) {
  const esVistaRrhh = variant === "rrhh";
  const abrirAyuda = (termino) => {
    window.dispatchEvent(new CustomEvent("portal-help-open", { detail: { termino } }));
  };
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const esJefe = claimsIncludeJefe(claims);
  const bandejaPath = esRrhh ? "/portal/rrhh/solicitudes-articulo" : "/portal/jefe/solicitudes";
  const personaId = String(claims?.persona_id || "").trim();

  const vista = useGrillaMesVista({ personaId, claims, esRrhh, preferSector: esVistaRrhh });
  const [diaModal, setDiaModal] = useState(null);
  const [coberturaModal, setCoberturaModal] = useState(null);
  const [aplicandoBatch, setAplicandoBatch] = useState(false);
  const [vistaModal, setVistaModal] = useState(null);
  const [cargaPendienteKey, setCargaPendienteKey] = useState("");
  const [cerrandoPeriodo, setCerrandoPeriodo] = useState(false);
  const outbox = useAsistenciaOutbox({ editorPersonaId: personaId, periodo: vista.periodo });
  const periodos = esJefe
    ? periodosVentanaJefe()
    : [sumarMeses(vista.periodo, -1), vista.periodo, sumarMeses(vista.periodo, 1)];
  const cargandoTarjeta = Boolean(cargaPendienteKey) || vista.loading;

  const handleCerrarPeriodoLiquidacion = async () => {
    if (!esVistaRrhh || cerrandoPeriodo) return;
    const gdt = String(vista.grupoId || "").trim();
    if (!RX_GDT.test(gdt)) {
      toast.error("Elegí un sector (grupo de trabajo) antes de cerrar el período.");
      return;
    }
    const ok = window.confirm(
      `¿Cerrar liquidación de ${labelPeriodo(vista.periodo)} para todo el sector? El mes quedará en solo lectura para cambios de turno.`,
    );
    if (!ok) return;
    setCerrandoPeriodo(true);
    try {
      const res = await callCerrarPeriodoLiquidacion({
        grupo_trabajo_id: gdt,
        anio: vista.anio,
        mes: vista.mes,
        motivo: "cierre_manual_rrhh_gso",
      });
      const n = res?.data?.actualizados ?? 0;
      toast.success(`Período cerrado (${n} vista(s) actualizadas).`);
      await vista.cargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo cerrar el período.");
    } finally {
      setCerrandoPeriodo(false);
    }
  };

  const handleAplicarCambios = async () => {
    if (!outbox.hasPending || aplicandoBatch) return;
    setAplicandoBatch(true);
    try {
      const result = await aplicarBatchAsistencia(outbox.ops, {
        editorPersonaId: personaId,
        periodo: vista.periodo,
      });
      toast.success(`Cambios aplicados: ${result?.aplicadas ?? outbox.count}.`);
      outbox.clear();
      await vista.cargar();
    } catch (e) {
      const msg = e?.message || "No se pudo aplicar el batch.";
      if (msg.includes("ASI-CONC")) {
        toast.error("La grilla cambió. Se conservaron tus pendientes para reintentar.");
        await vista.cargar();
      } else if (msg.includes("ASI-PER")) {
        toast.error("Período cerrado. Revisá los cambios pendientes.");
      } else {
        toast.error(msg);
      }
    } finally {
      setAplicandoBatch(false);
    }
  };

  function seleccionarTarjeta({ periodo, modo, grupoId = "", titulo }) {
    vista.setPeriodo(periodo);
    vista.onModoChange(modo);
    vista.setGrupoId(grupoId);
    setVistaModal({ titulo, periodo });
    setCargaPendienteKey(`${periodo}::${modo}::${grupoId || "-"}`);
  }

  useEffect(() => {
    if (!cargaPendienteKey) return;
    const [periodoTarget, modoTarget, grupoTarget] = cargaPendienteKey.split("::");
    const grupoNormalizado = grupoTarget === "-" ? "" : grupoTarget;
    const listoTitular = modoTarget === "TITULAR";
    const listo =
      vista.periodo === periodoTarget &&
      vista.modo === modoTarget &&
      (listoTitular || String(vista.grupoId || "") === grupoNormalizado);
    if (!listo) return;
    setCargaPendienteKey("");
    void vista.cargar();
  }, [cargaPendienteKey, vista]);

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Calendario licencias</h2>
        <p className="mt-1 text-sm text-slate-600">
          {esVistaRrhh
            ? "Vista sector: elegí grupo y período, o abrí una tarjeta rápida."
            : "Seleccioná una tarjeta para abrir la grilla mensual."}
        </p>
        {esVistaRrhh ? (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <GrillaMesSelector
              periodo={vista.periodo}
              onPeriodoChange={vista.setPeriodo}
              modo={vista.modo}
              onModoChange={vista.onModoChange}
              grupoId={vista.grupoId}
              onGrupoIdChange={vista.setGrupoId}
              gruposEquipo={vista.gruposEquipo}
              gruposSector={vista.gruposSector}
              resolverCargando={vista.resolverCargando}
              sectorCargando={vista.sectorCargando}
              esRrhh={esRrhh}
              onCargar={() =>
                seleccionarTarjeta({
                  periodo: vista.periodo,
                  modo: vista.modo,
                  grupoId: vista.grupoId,
                  titulo: `Sector · ${labelPeriodo(vista.periodo)}`,
                })
              }
              cargandoDatos={cargandoTarjeta}
            />
            <button
              type="button"
              disabled={cerrandoPeriodo || !RX_GDT.test(String(vista.grupoId || ""))}
              onClick={() => void handleCerrarPeriodoLiquidacion()}
              className="mt-3 min-h-11 w-full rounded-xl border border-amber-400 bg-amber-50 px-3 text-sm font-semibold text-amber-950 active:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cerrandoPeriodo ? "Cerrando período…" : "Cerrar período de liquidación (sector)"}
            </button>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {periodos.map((periodo, idx) => {
            const titulo = idx === 0 ? "Mes anterior" : idx === 1 ? "Mes actual" : "Mes próximo";
            return (
              <section key={periodo} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
                <p className="text-sm font-medium text-slate-900">{labelPeriodo(periodo)}</p>
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    disabled={cargandoTarjeta || vista.gruposEquipo.length === 0}
                    onClick={() => {
                      if (vista.gruposEquipo.length === 0) {
                        toast.error("Sin cargos vigentes en el mes seleccionado.");
                        return;
                      }
                      seleccionarTarjeta({
                        periodo,
                        modo: "TITULAR",
                        grupoId: "",
                        titulo: `Titular (mi caso) · ${labelPeriodo(periodo)}`,
                      });
                    }}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>Titular (mi caso)</span>
                    <span className="text-xs font-medium">{labelPeriodo(periodo)}</span>
                  </button>
                  {vista.gruposEquipo.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                      Sin grupos vigentes.
                    </p>
                  ) : (
                    vista.gruposEquipo.map((g) => {
                      const gid = String(g.grupo_de_trabajo_id || "");
                      const glabel = String(g.etiqueta_ui || gid);
                      return (
                        <button
                          key={`${periodo}-${gid}`}
                          type="button"
                          disabled={cargandoTarjeta}
                          onClick={() =>
                            seleccionarTarjeta({
                              periodo,
                              modo: "EQUIPO",
                              grupoId: gid,
                              titulo: `${glabel} · ${labelPeriodo(periodo)}`,
                            })
                          }
                          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="font-medium">{glabel}</span>
                          <span className="text-xs text-slate-600">{labelPeriodo(periodo)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {vista.resolverError ? (
        <p className="mt-2 text-sm text-amber-700">{vista.resolverError}</p>
      ) : null}
      {vista.error ? <p className="mt-2 text-sm text-rose-700">{vista.error}</p> : null}

      {outbox.pendingRecovery ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-medium">Tenés cambios pendientes de una sesión anterior ({outbox.pendingRecovery.count}).</p>
          <p className="mt-1 text-xs text-amber-800">Período {vista.periodo}. ¿Querés recuperarlos o descartarlos?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={outbox.recoverPending}
              className="min-h-11 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white active:bg-amber-800"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={outbox.discardPending}
              className="min-h-11 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 active:bg-amber-100"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {outbox.hasPending ? (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-900">
          <div className="flex items-center gap-2">
            <p className="font-medium">Cambios pendientes: {outbox.count}</p>
            <button
              type="button"
              onClick={() => abrirAyuda("Cambios Pendientes (Borrador)")}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300 bg-white text-xs font-bold text-indigo-700 active:bg-indigo-100"
              title="¿Cómo funciona Aplicar cambios?"
              aria-label="Ayuda sobre cambios pendientes"
            >
              ?
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void handleAplicarCambios()}
              disabled={aplicandoBatch}
              className="min-h-11 rounded-lg bg-indigo-700 px-3 text-sm font-semibold text-white active:bg-indigo-800 disabled:opacity-60"
            >
              {aplicandoBatch ? "Aplicando..." : "Aplicar cambios"}
            </button>
            <button
              type="button"
              onClick={outbox.clear}
              className="min-h-11 rounded-lg border border-indigo-300 bg-white px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-100"
            >
              Limpiar cola
            </button>
          </div>
        </div>
      ) : null}

      {vistaModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Grilla mensual">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setVistaModal(null)} aria-label="Cerrar modal" />
          <div className="relative z-10 flex h-[96vh] w-[98vw] flex-col rounded-2xl border border-slate-300 bg-white p-3 shadow-2xl sm:p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Calendario licencias</p>
                <h3 className="text-base font-semibold text-slate-900">{vistaModal.titulo}</h3>
              </div>
              <button type="button" onClick={() => setVistaModal(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {cargandoTarjeta ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    Cargando grilla...
                  </div>
                </div>
              ) : vista.esModoTitular ? (
                vista.titularCalendarios.length === 0 ? (
                  <p className="mt-8 text-center text-sm text-slate-600">
                    Sin cargos vigentes para este mes.
                  </p>
                ) : (
                  <div className="space-y-8 pb-4">
                    <p className="text-sm text-slate-600">
                      {vista.titularCalendarios.length === 1
                        ? "1 cargo vigente en el mes"
                        : `${vista.titularCalendarios.length} cargos vigentes en el mes`}
                      {" · "}
                      {vista.hintModo}
                    </p>
                    {vista.titularCalendarios.map((cal) => (
                      <section
                        key={cal.grupo_trabajo_id}
                        className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm"
                      >
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-violet-200/80 pb-2">
                          <h4 className="text-base font-semibold text-violet-950">{cal.grupo_label}</h4>
                          {cal.error_carga ? (
                            <span className="text-xs font-medium text-amber-800">Error al cargar turnos</span>
                          ) : cal.existe ? (
                            <span className="text-xs text-slate-500">Grilla sincronizada</span>
                          ) : (
                            <span className="text-xs text-amber-700">Sin materialización aún</span>
                          )}
                        </div>
                        <GrillaMesTitularCalendario
                          anio={vista.anio}
                          mes={vista.mes}
                          diasMap={cal.dias}
                          grupoLabel={cal.grupo_label}
                          onDiaClick={({ dia, eventos, grupoLabel }) => {
                            const cell = cal.dias?.[dia] || {};
                            const fechaYmd = `${vista.anio}-${String(vista.mes).padStart(2, "0")}-${dia}`;
                            setDiaModal({
                              dia,
                              fechaYmd,
                              personaId,
                              grupoTrabajoId: cal.grupo_trabajo_id,
                              eventos,
                              personaLabel: "Mi calendario",
                              grupoLabel: grupoLabel || cal.grupo_label,
                              turnoTeorico: {
                                rda_turno_id: cell.rda_turno_id,
                                es_franco: cell.es_franco,
                                capa_teorica: {
                                  tipo_dia: cell.tipo_dia
                                    || (cell.es_franco ? "franco" : "laborable"),
                                  ingreso: cell.rda_ingreso,
                                  egreso: cell.rda_egreso,
                                  es_feriado: cell.es_feriado,
                                  tipo_evento_institucional: cell.tipo_evento_institucional,
                                },
                              },
                            });
                          }}
                        />
                      </section>
                    ))}
                  </div>
                )
              ) : (
                <GrillaMesEquipoTabla
                  anio={vista.anio}
                  mes={vista.mes}
                  filas={vista.filas}
                  grupoSeleccionado={vista.grupoId}
                  onCeldaClick={({ dia, fechaYmd, personaId: pid, eventos, personaLabel, grupoLabel, turnoTeorico }) =>
                    setDiaModal({ dia, fechaYmd, personaId: pid, eventos, personaLabel, grupoLabel, turnoTeorico })
                  }
                />
              )}
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded border border-blue-900/25 bg-[#3B82F6] align-middle" />
                  Consolidado / aprobado
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded border-2 border-dashed border-amber-900 bg-[#F59E0B] align-middle" />
                  En revisión
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded bg-amber-100 ring-1 ring-amber-300 align-middle" />
                  Feriado / asueto
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded bg-rose-100 align-middle" />
                  Fin de semana
                </span>
                <span>Clic = detalles</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DiaGrillaDetalleModal
        open={diaModal != null}
        onClose={() => setDiaModal(null)}
        dia={diaModal?.dia ?? ""}
        eventos={diaModal?.eventos ?? []}
        bandejaPath={bandejaPath}
        subtitulo={diaModal?.personaLabel}
        grupoLabel={diaModal?.grupoLabel}
        turnoTeorico={diaModal?.turnoTeorico ?? null}
        personaId={diaModal?.personaId}
        fechaYmd={diaModal?.fechaYmd}
        onAbrirCobertura={
          diaModal?.personaId && diaModal?.fechaYmd
            ? () => {
                setCoberturaModal({
                  personaOrigenId: diaModal.personaId,
                  personaOrigenLabel: diaModal.personaLabel,
                  fechaYmd: diaModal.fechaYmd,
                });
              }
            : undefined
        }
      />

      {coberturaModal ? (
        <ModalCoberturaParcial
          personaOrigenId={coberturaModal.personaOrigenId}
          personaOrigenLabel={coberturaModal.personaOrigenLabel}
          fechaYmd={coberturaModal.fechaYmd}
          grupoId={diaModal?.grupoTrabajoId || vista.grupoActivoId}
          periodo={vista.periodo}
          onCerrar={() => setCoberturaModal(null)}
          onRegistrado={() => {}}
          onDesactualizado={() => void vista.cargar()}
          onAgregarOutbox={(op) =>
            outbox.addOp({
              ...op,
              grupoId: diaModal?.grupoTrabajoId || vista.grupoActivoId || "",
              periodo: vista.periodo,
            })
          }
        />
      ) : null}

    </div>
  );
}
