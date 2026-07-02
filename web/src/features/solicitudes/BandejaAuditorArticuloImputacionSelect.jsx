import { useEffect } from "react";

import { useArticulosLicenciaMedicaAuditor } from "./useArticulosLicenciaMedicaAuditor.js";

/**
 * @param {{
 *   sel: Record<string, unknown> | null,
 *   imputacion: { articulo_id: string, version_id_aplicada: string, label?: string } | null,
 *   onImputacionChange: (v: { articulo_id: string, version_id_aplicada: string, label: string, es_larga_episodio?: boolean }) => void,
 * }} props
 */
export default function BandejaAuditorArticuloImputacionSelect({ sel, imputacion, onImputacionChange }) {
  const { opciones, cargando, error, valorDefault } = useArticulosLicenciaMedicaAuditor({
    articuloId: sel?.articulo_id,
    versionId: sel?.version_aplicada_id,
  });

  const valorKey =
    imputacion?.articulo_id && imputacion?.version_id_aplicada
      ? `${imputacion.articulo_id}|${imputacion.version_id_aplicada}`
      : valorDefault?.key || "";

  const seleccionado = opciones.find((o) => o.key === valorKey) || valorDefault;
  const esLargaSel = seleccionado?.es_larga_episodio === true;
  const tieneCie10 = Boolean(String(sel?.cie10_codigo || "").trim() && String(sel?.cie10_descripcion || "").trim());

  useEffect(() => {
    if (!valorDefault || !/^sol_/i.test(String(sel?.solicitud_id || ""))) return;
    if (imputacion?.articulo_id && imputacion?.version_id_aplicada) return;
    onImputacionChange({
      articulo_id: valorDefault.articulo_id,
      version_id_aplicada: valorDefault.version_id_aplicada,
      label: valorDefault.label,
      es_larga_episodio: valorDefault.es_larga_episodio,
    });
  }, [
    sel?.solicitud_id,
    valorDefault?.key,
    imputacion?.articulo_id,
    imputacion?.version_id_aplicada,
    onImputacionChange,
    valorDefault,
  ]);

  if (sel?.puede_clasificar !== true) return null;

  return (
    <section className="space-y-2 rounded-xl border border-teal-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Artículo a imputar (clasificación)
      </p>
      <p className="text-xs text-slate-600">
        En aviso Caja Negra el agente no elige norma; el auditor define si aplica Art. 14 (corta), Art. 16/19
        (larga) u otra licencia médica publicada.
      </p>

      {cargando ? <p className="text-sm text-slate-600">Cargando catálogo…</p> : null}
      {error ? <p className="text-sm text-amber-900">{error}</p> : null}

      {opciones.length > 0 ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Artículo y versión vigente</span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={valorKey}
            onChange={(e) => {
              const opt = opciones.find((o) => o.key === e.target.value);
              if (!opt) return;
              onImputacionChange({
                articulo_id: opt.articulo_id,
                version_id_aplicada: opt.version_id_aplicada,
                label: opt.label,
                es_larga_episodio: opt.es_larga_episodio,
              });
            }}
          >
            {opciones.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
                {o.codigo_grilla ? ` (${o.codigo_grilla})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {esLargaSel && !tieneCie10 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Licencia larga: el aviso no trae CIE-10. El dictamen favorable fallará hasta que el agente complete
          diagnóstico y causal (Patrón B) o el auditor no impute Art. 16.
        </p>
      ) : null}
    </section>
  );
}
