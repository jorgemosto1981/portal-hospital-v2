import CausalLargaSelect from "./CausalLargaSelect.jsx";
import { useCausalLargaCatalogo } from "./useCausalLargaCatalogo.js";

/**
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   obligatorio?: boolean,
 *   disabled?: boolean,
 *   origenAviso?: boolean,
 * }} props
 */
export default function BandejaAuditorCausalLargaImputacion({
  value = "",
  onChange,
  obligatorio = false,
  disabled = false,
  origenAviso = false,
}) {
  const { opciones, cargando, error } = useCausalLargaCatalogo();
  const id = String(value || "").trim();
  const tieneValor = /^cfg_cld_/i.test(id);

  if (!obligatorio && !tieneValor && !origenAviso) return null;

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Causal Art. 19</p>
      <p className="text-xs text-slate-600">
        Obligatoria al imputar licencia larga (Art. 16). En aviso Caja Negra la define el auditor.
      </p>
      {origenAviso && tieneValor ? (
        <p className="text-xs text-teal-800">Precargada desde el aviso del agente.</p>
      ) : null}
      {cargando ? <p className="text-sm text-slate-600">Cargando causales…</p> : null}
      {error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
      ) : null}
      <CausalLargaSelect
        opciones={opciones}
        value={id}
        required={obligatorio}
        disabled={disabled || cargando}
        onChange={onChange}
      />
      {obligatorio && !tieneValor ? (
        <p className="text-sm text-amber-900">Elegí causal Art. 19 antes del dictamen favorable.</p>
      ) : null}
    </section>
  );
}
