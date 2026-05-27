import { useState } from "react";
import toast from "react-hot-toast";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeRrhh } from "../routing/portalRole.js";
import DiaGrillaDetalleModal from "./DiaGrillaDetalleModal.jsx";
import ModalCoberturaParcial from "./ModalCoberturaParcial.jsx";
import GrillaMesEquipoTabla from "./GrillaMesEquipoTabla.jsx";
import GrillaMesSelector from "./GrillaMesSelector.jsx";
import GrillaMesTitularCalendario from "./GrillaMesTitularCalendario.jsx";
import { useAsistenciaOutbox } from "./useAsistenciaOutbox.js";
import { useGrillaMesVista } from "./useGrillaMesVista.js";
import { aplicarBatchAsistencia } from "../../services/coberturaParcialService.js";

export default function GrillaMesLicenciasPanel() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const bandejaPath = esRrhh ? "/portal/rrhh/solicitudes-articulo" : "/portal/jefe/solicitudes";
  const personaId = String(claims?.persona_id || "").trim();

  const vista = useGrillaMesVista({ personaId, claims, esRrhh });
  const [diaModal, setDiaModal] = useState(null);
  const [coberturaModal, setCoberturaModal] = useState(null);
  const [aplicandoBatch, setAplicandoBatch] = useState(false);
  const outbox = useAsistenciaOutbox({ editorPersonaId: personaId, periodo: vista.periodo });

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

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold text-slate-900">Calendario de licencias (vista mes)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Proyección MDC en <code className="text-xs">vistas_grilla_mes_agente</code>. Titular, equipo o sector
        (RRHH) desde un solo selector — el período se conserva al cambiar de vista.
      </p>
      <p className="mt-2 text-sm text-slate-600">{vista.hintModo}</p>

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
        onCargar={() => void vista.cargar()}
        cargandoDatos={vista.loading}
      />

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
          <p className="font-medium">Cambios pendientes: {outbox.count}</p>
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

      {vista.data && !vista.loading ? (
        <p className="mt-2 text-xs text-slate-500">
          {vista.esModoTitular && vista.titularVisMeta ? (
            vista.titularVisMeta.existe ? (
              <>
                Doc <span className="font-mono">{vista.titularVisMeta.vis_id}</span>
              </>
            ) : (
              <>
                Sin documento <span className="font-mono">{vista.titularVisMeta.vis_id}</span> para este mes.
              </>
            )
          ) : (
            <>
              {vista.data.total_personas} persona(s) · corte {vista.data.fecha_corte}
              {vista.data.truncado ? " · listado truncado (máx. 60)" : ""}
            </>
          )}
        </p>
      ) : null}

      {vista.esModoTitular ? (
        <GrillaMesTitularCalendario
          anio={vista.anio}
          mes={vista.mes}
          diasMap={vista.titularDias}
          gruposEquipo={vista.gruposEquipo}
          onDiaClick={({ dia, eventos, grupoLabel }) => {
            const cell = vista.titularDias?.[dia] || {};
            const fechaYmd = `${vista.anio}-${String(vista.mes).padStart(2, "0")}-${dia}`;
            setDiaModal({
              dia,
              fechaYmd,
              personaId,
              eventos,
              personaLabel: "Mi calendario",
              grupoLabel,
              turnoTeorico: {
                rda_turno_id: cell.rda_turno_id,
                es_franco: cell.es_franco,
                capa_teorica: {
                  tipo_dia: cell.es_franco ? "franco" : "laborable",
                  ingreso: cell.rda_ingreso,
                  egreso: cell.rda_egreso,
                },
              },
            });
          }}
        />
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
          grupoId={vista.grupoId}
          periodo={vista.periodo}
          onCerrar={() => setCoberturaModal(null)}
          onRegistrado={() => {}}
          onDesactualizado={() => void vista.cargar()}
          onAgregarOutbox={(op) =>
            outbox.addOp({
              ...op,
              grupoId: vista.grupoId || "",
              periodo: vista.periodo,
            })
          }
        />
      ) : null}

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Leyenda (MDC → celda)</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>
            <span
              className="mr-1 inline-block h-3 w-5 align-middle rounded border border-blue-900/25"
              style={{ backgroundColor: "#3B82F6" }}
            />{" "}
            Consolidado / aprobado — fondo <span className="font-mono">#3B82F6</span>, texto claro.
          </li>
          <li>
            <span className="mr-1 inline-block h-3 w-5 align-middle rounded border-2 border-dashed border-amber-900 bg-[#F59E0B]" />{" "}
            En revisión — fondo <span className="font-mono">#F59E0B</span> + borde punteado ámbar oscuro.
          </li>
          <li>Pasar el mouse: artículo, estado legible, <span className="font-mono">sol_id</span> abreviado (en equipo, nombre de la fila).</li>
          <li>Clic: detalle del día; desde ahí, cobertura parcial por tramos (vista equipo / jefe).</li>
        </ul>
      </div>
    </div>
  );
}
