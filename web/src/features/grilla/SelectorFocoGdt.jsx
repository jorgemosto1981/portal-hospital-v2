import { useEffect, useState } from "react";

import { RX_GDT } from "./grillaGrupoUtils.js";

function etiquetaCatalogo(row) {
  const nombre = String(row.nombre || row.codigo || row.titulo || "").trim();
  const id = String(row.id || "").trim();
  return nombre || id;
}

/**
 * Selector de foco GDT (T-05). La URL se actualiza solo al confirmar con «Ver».
 *
 * @param {{
 *   origenGrupos: "catalogo" | "hlg_vigente";
 *   gruposCatalogo?: Array<{ id?: string; nombre?: string; codigo?: string; titulo?: string }>;
 *   gruposHlg?: Array<{ grupo_de_trabajo_id?: string; etiqueta_ui?: string }>;
 *   catalogoCargando?: boolean;
 *   hlgCargando?: boolean;
 *   grupoIdConfirmado: string;
 *   periodoConfirmado: string;
 *   periodoPorDefecto: string;
 *   onConfirmarCarga: (args: { grupoId: string; periodo: string }) => void;
 *   onVerTitular?: (args: { periodo: string }) => void;
 *   muestraAtajoTitular?: boolean;
 *   focoTitularActivo?: boolean;
 *   disabled?: boolean;
 * }} props
 */
export default function SelectorFocoGdt({
  origenGrupos,
  gruposCatalogo = [],
  gruposHlg = [],
  catalogoCargando = false,
  hlgCargando = false,
  grupoIdConfirmado,
  periodoConfirmado,
  periodoPorDefecto,
  onConfirmarCarga,
  onVerTitular,
  muestraAtajoTitular = false,
  focoTitularActivo = false,
  disabled = false,
}) {
  const esCatalogo = origenGrupos === "catalogo";
  const cargando = esCatalogo ? catalogoCargando : hlgCargando;

  const [local, setLocal] = useState(() => ({
    grupoId: grupoIdConfirmado,
    periodo: periodoConfirmado || periodoPorDefecto,
  }));

  useEffect(() => {
    setLocal({
      grupoId: grupoIdConfirmado,
      periodo: periodoConfirmado || periodoPorDefecto,
    });
  }, [grupoIdConfirmado, periodoConfirmado, periodoPorDefecto]);

  const pendienteEquipo =
    RX_GDT.test(local.grupoId) &&
    (local.grupoId !== grupoIdConfirmado || local.periodo !== periodoConfirmado);

  const puedeVerEquipo = pendienteEquipo && !disabled && !cargando;

  return (
    <div className="flex flex-col gap-3">
      {focoTitularActivo ? (
        <p className="inline-flex w-fit items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          Foco: Mi grilla (Titular)
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
          Período
          <input
            type="month"
            value={local.periodo}
            disabled={disabled}
            onChange={(e) => setLocal((p) => ({ ...p, periodo: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50"
          />
        </label>

        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          {esCatalogo ? "Sector / grupo de trabajo" : "Grupo de trabajo"}
          {cargando ? (
            <span className="text-sm text-slate-500">
              {esCatalogo ? "Cargando catálogo de sectores…" : "Cargando grupos vigentes…"}
            </span>
          ) : esCatalogo ? (
            <select
              value={local.grupoId}
              disabled={disabled || gruposCatalogo.length === 0}
              onChange={(e) => setLocal((p) => ({ ...p, grupoId: e.target.value }))}
              className="h-11 rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm disabled:opacity-50"
            >
              <option value="">Elegir sector…</option>
              {gruposCatalogo.map((g) => {
                const id = String(g.id || "").trim();
                if (!RX_GDT.test(id)) return null;
                return (
                  <option key={id} value={id}>
                    {etiquetaCatalogo(g)}
                  </option>
                );
              })}
            </select>
          ) : gruposHlg.length === 0 ? (
            <span className="text-sm text-amber-700">Sin HLg vigente al cierre del mes.</span>
          ) : (
            <select
              value={local.grupoId}
              disabled={disabled}
              onChange={(e) => setLocal((p) => ({ ...p, grupoId: e.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-50"
            >
              <option value="">Elegir grupo…</option>
              {gruposHlg.map((g) => {
                const id = String(g.grupo_de_trabajo_id || "").trim();
                const label = String(g.etiqueta_ui || id).trim();
                if (!RX_GDT.test(id)) return null;
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}
        </label>

        <button
          type="button"
          disabled={!puedeVerEquipo}
          onClick={() => {
            if (!RX_GDT.test(local.grupoId)) return;
            onConfirmarCarga({ grupoId: local.grupoId, periodo: local.periodo });
          }}
          className="h-11 shrink-0 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          Ver
        </button>

        {muestraAtajoTitular && onVerTitular ? (
        <button
          type="button"
          disabled={disabled || cargando || gruposHlg.length === 0}
          onClick={() => onVerTitular({ periodo: local.periodo })}
          className="h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Ver mi grilla (titular)
        </button>
        ) : null}
      </div>
    </div>
  );
}
