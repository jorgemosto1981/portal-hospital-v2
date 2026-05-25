import { TICKETERA } from "../solicitudes/ticketeraUi.js";

/**
 * @param {{ etiqueta_ui?: string, grupo_de_trabajo_id?: string, nivel_jerarquico?: number | null }} g
 */
function etiquetaGrupoOption(g) {
  return String(g.etiqueta_ui || g.grupo_de_trabajo_id || "").trim() || "Grupo";
}

/**
 * Selector de grupo ancla (paso 2 wizard LAO).
 */
export default function LaoGrupoAnclaPaso({
  gruposVigentes = [],
  grupoAnclaId = "",
  setGrupoAnclaId,
  requiereSeleccionGrupo = false,
  isLoading = false,
  error = "",
}) {
  const listaGrupos =
    gruposVigentes.length > 0
      ? gruposVigentes.map((g) => etiquetaGrupoOption(g)).join(", ")
      : "";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">Grupo de trabajo</p>
      {!isLoading && !error && listaGrupos ? (
        <p className="text-xs leading-relaxed text-slate-600">
          Tenés asignados: <span className="font-medium text-slate-800">{listaGrupos}</span>. Seleccioná uno.
          Tu ausencia aparecerá en la grilla operativa de todos tus grupos de trabajo.
        </p>
      ) : (
        <p className="text-xs text-slate-600">
          La licencia se imputa a un grupo vigente en la fecha de inicio del trámite.
        </p>
      )}

      {isLoading ? (
        <p className={`${TICKETERA.muted} text-xs`} role="status">
          Cargando grupos de trabajo vigentes…
        </p>
      ) : null}

      {error ? (
        <p className={TICKETERA.alertError} role="alert">
          {error}
        </p>
      ) : null}

      {!isLoading && !error && gruposVigentes.length === 0 ? (
        <p className="text-sm text-amber-800" role="alert">
          No hay grupo de trabajo vigente para la fecha elegida. Revisá tu historial laboral o contactá a
          RRHH.
        </p>
      ) : null}

      {requiereSeleccionGrupo && typeof setGrupoAnclaId === "function" ? (
        <select
          value={grupoAnclaId}
          onChange={(e) => setGrupoAnclaId(e.target.value)}
          className={TICKETERA.select}
          required
          aria-label="Grupo de trabajo para esta solicitud"
        >
          <option value="">—</option>
          {gruposVigentes.map((g) => (
            <option key={String(g.grupo_de_trabajo_id)} value={String(g.grupo_de_trabajo_id)}>
              {etiquetaGrupoOption(g)}
            </option>
          ))}
        </select>
      ) : null}

      {!requiereSeleccionGrupo && gruposVigentes.length === 1 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm text-slate-800">
          <span className="font-medium">{etiquetaGrupoOption(gruposVigentes[0])}</span>
        </p>
      ) : null}
    </div>
  );
}
