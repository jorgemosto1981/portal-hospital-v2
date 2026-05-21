import { useState } from "react";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeRrhh } from "../routing/portalRole.js";
import DiaGrillaDetalleModal from "./DiaGrillaDetalleModal.jsx";
import GrillaMesEquipoTabla from "./GrillaMesEquipoTabla.jsx";
import GrillaMesSelector from "./GrillaMesSelector.jsx";
import GrillaMesTitularCalendario from "./GrillaMesTitularCalendario.jsx";
import { useGrillaMesVista } from "./useGrillaMesVista.js";

export default function GrillaMesLicenciasPanel() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const bandejaPath = esRrhh ? "/portal/rrhh/solicitudes-articulo" : "/portal/jefe/solicitudes";
  const personaId = String(claims?.persona_id || "").trim();

  const vista = useGrillaMesVista({ personaId, claims, esRrhh });
  const [diaModal, setDiaModal] = useState(null);

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
          onDiaClick={({ dia, eventos }) => setDiaModal({ dia, eventos })}
        />
      ) : (
        <GrillaMesEquipoTabla
          anio={vista.anio}
          mes={vista.mes}
          filas={vista.filas}
          onCeldaClick={({ dia, eventos, personaLabel }) =>
            setDiaModal({ dia, eventos, personaLabel })
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
      />

      <p className="mt-3 text-xs text-slate-500">
        Clic en un día con licencia abre detalle y enlace a bandeja.{" "}
        <span className="inline-block h-3 w-3 rounded border border-dashed border-amber-400 align-middle" />{" "}
        borde punteado = solicitud aún en revisión · color desde MDC (#3B82F6 aprobado, #F59E0B pendiente).
      </p>
    </div>
  );
}
