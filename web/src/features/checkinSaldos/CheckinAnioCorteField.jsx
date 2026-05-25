import { listAniosCortePortalOpciones } from "./checkinFilasUtils.js";

export function CheckinAnioCorteField({ anioCorteA, setAnioCorteA, anioAValido, readOnly }) {
  const opciones = listAniosCortePortalOpciones();

  return (
    <label className="block space-y-1 text-sm text-slate-700">
      <span className="text-xs font-semibold tracking-wide text-slate-600">
        Año de corte del portal <span className="font-normal text-slate-500">(A)</span>
      </span>
      <p className="text-xs text-slate-500">
        Go-live del portal: años de bolsa LAO deben ser <strong>menores</strong> a A (válido para todos los artículos
        en esta sesión).
      </p>
      <select
        value={anioCorteA}
        disabled={readOnly}
        onChange={(e) => setAnioCorteA(e.target.value)}
        className={[
          "min-h-11 w-full touch-manipulation rounded-xl border bg-white px-3 text-base text-slate-900",
          anioAValido ? "border-slate-200" : "border-red-300 ring-1 ring-red-100",
        ].join(" ")}
      >
        <option value="">Elegir año A…</option>
        {opciones.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
