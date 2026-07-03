import Cie10Select from "./Cie10Select.jsx";
import { useCie10Catalogo } from "./useCie10Catalogo.js";

/**
 * @param {{
 *   value: { codigo: string, descripcion: string } | null,
 *   onChange: (payload: { codigo: string, descripcion: string } | null) => void,
 *   obligatorio?: boolean,
 *   disabled?: boolean,
 *   origenAviso?: boolean,
 * }} props
 */
export default function BandejaAuditorCie10Imputacion({
  value,
  onChange,
  obligatorio = false,
  disabled = false,
  origenAviso = false,
}) {
  const { opciones, cargando, error } = useCie10Catalogo();
  const codigo = String(value?.codigo || "").trim();
  const descripcion = String(value?.descripcion || "").trim();
  const tieneValor = Boolean(codigo && descripcion);

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnóstico CIE-10</p>
      <p className="text-xs text-slate-600">
        {obligatorio
          ? "Obligatorio para licencia larga (Art. 16/19). Elegí código y descripción del catálogo."
          : "Opcional en licencia corta. Recomendado para trazabilidad clínica del dictamen."}
      </p>
      {origenAviso && tieneValor ? (
        <p className="text-xs text-teal-800">
          Precargado desde el aviso del agente. Podés cambiarlo antes de dictaminar.
        </p>
      ) : null}
      {cargando ? <p className="text-sm text-slate-600">Cargando catálogo CIE-10…</p> : null}
      {error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error} Podés reintentar recargando la página.
        </p>
      ) : null}
      {!cargando && !error && opciones.length === 0 ? (
        <p className="text-sm text-amber-900">
          Catálogo vacío. Verificá cfg_cie10 en configuración institucional.
        </p>
      ) : null}
      <Cie10Select
        opciones={opciones}
        valueCodigo={codigo}
        required={obligatorio}
        disabled={disabled || cargando}
        onChange={(payload) => onChange(payload)}
      />
      {tieneValor ? (
        <p className="text-xs text-slate-600">
          Seleccionado: <span className="font-medium text-slate-800">{codigo}</span> — {descripcion}
        </p>
      ) : obligatorio ? (
        <p className="text-sm text-amber-900">Indicá un código CIE-10 antes del dictamen favorable.</p>
      ) : (
        <p className="text-xs text-slate-500">Sin CIE-10 — el dictamen corto puede continuar.</p>
      )}
      {tieneValor && !disabled ? (
        <button
          type="button"
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
          onClick={() => onChange(null)}
        >
          Limpiar selección
        </button>
      ) : null}
    </section>
  );
}
