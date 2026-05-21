/** Modos de consulta calendario GSO (C2c). */
export const GRILLA_MES_MODO = {
  TITULAR: "TITULAR",
  EQUIPO: "EQUIPO",
  SECTOR: "SECTOR",
};

/**
 * @param {{
 *   periodo: string;
 *   onPeriodoChange: (v: string) => void;
 *   modo: string;
 *   onModoChange: (v: string) => void;
 *   grupoId: string;
 *   onGrupoIdChange: (v: string) => void;
 *   gruposEquipo: Array<{ grupo_de_trabajo_id?: string; etiqueta_ui?: string }>;
 *   gruposSector: Array<{ id: string; nombre?: string; codigo?: string; titulo?: string; activo?: boolean }>;
 *   resolverCargando: boolean;
 *   sectorCargando: boolean;
 *   esRrhh: boolean;
 *   onCargar: () => void;
 *   cargandoDatos: boolean;
 * }} props
 */
export default function GrillaMesSelector({
  periodo,
  onPeriodoChange,
  modo,
  onModoChange,
  grupoId,
  onGrupoIdChange,
  gruposEquipo,
  gruposSector,
  resolverCargando,
  sectorCargando,
  esRrhh,
  onCargar,
  cargandoDatos,
}) {
  const muestraGrupoEquipo = modo === GRILLA_MES_MODO.EQUIPO;
  const muestraGrupoSector = modo === GRILLA_MES_MODO.SECTOR && esRrhh;

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
        Período
        <input
          type="month"
          value={periodo}
          onChange={(e) => onPeriodoChange(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>

      <label className="flex min-w-[11rem] flex-col gap-1 text-xs font-medium text-slate-600">
        Vista
        <select
          value={modo}
          onChange={(e) => onModoChange(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value={GRILLA_MES_MODO.TITULAR}>Titular (mi caso)</option>
          <option value={GRILLA_MES_MODO.EQUIPO}>Equipo (mi grupo)</option>
          {esRrhh ? <option value={GRILLA_MES_MODO.SECTOR}>Sector (RRHH)</option> : null}
        </select>
      </label>

      {muestraGrupoEquipo ? (
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Grupo de trabajo
          {resolverCargando ? (
            <span className="text-sm text-slate-500">Cargando grupos vigentes…</span>
          ) : gruposEquipo.length === 0 ? (
            <span className="text-sm text-amber-700">Sin HLg vigente al cierre del mes.</span>
          ) : (
            <select
              value={grupoId}
              onChange={(e) => onGrupoIdChange(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Elegir grupo…</option>
              {gruposEquipo.map((g) => {
                const id = String(g.grupo_de_trabajo_id || "");
                const label = String(g.etiqueta_ui || id);
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}
        </label>
      ) : null}

      {muestraGrupoSector ? (
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Sector / grupo
          {sectorCargando ? (
            <span className="text-sm text-slate-500">Cargando catálogo…</span>
          ) : (
            <select
              value={grupoId}
              onChange={(e) => onGrupoIdChange(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Elegir sector…</option>
              {gruposSector.map((g) => {
                const id = String(g.id || "");
                const nombre = String(g.nombre || g.codigo || g.titulo || "").trim();
                return (
                  <option key={id} value={id}>
                    {nombre || id}
                  </option>
                );
              })}
            </select>
          )}
        </label>
      ) : null}

      <button
        type="button"
        onClick={onCargar}
        disabled={
          cargandoDatos ||
          resolverCargando ||
          (muestraGrupoEquipo && (!grupoId || gruposEquipo.length === 0)) ||
          (muestraGrupoSector && (!grupoId || sectorCargando))
        }
        className="h-11 shrink-0 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {cargandoDatos ? "Cargando…" : "Cargar"}
      </button>
    </div>
  );
}
