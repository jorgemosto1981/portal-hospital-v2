import { useCallback, useEffect, useMemo, useState } from "react";

import { parseLineaRelojBiometrico } from "../../../../../../shared/utils/fichadasValidacionMarcas.js";
import {
  CATALOGO_TOKENS_MASCARA,
  EJEMPLOS_MASCARA_RAPIDOS,
  MASCARA_RELOJ_DEFAULT,
  extraerCamposSegunMascara,
} from "../mascaraTokensParse.js";

/**
 * @param {{
 *   mascaraActual?: string;
 *   onUsarMascara?: (mascara: string) => void;
 *   disabled?: boolean;
 * }} props
 */
export default function MascaraAyudaPanel({ mascaraActual = "", onUsarMascara, disabled }) {
  const [abierto, setAbierto] = useState(false);
  const [lineaPrueba, setLineaPrueba] = useState(EJEMPLOS_MASCARA_RAPIDOS[1].linea);
  const [mascaraPrueba, setMascaraPrueba] = useState(
    mascaraActual?.trim() || EJEMPLOS_MASCARA_RAPIDOS[1].mascara,
  );

  useEffect(() => {
    if (mascaraActual?.trim()) setMascaraPrueba(mascaraActual.trim());
  }, [mascaraActual]);

  const simulacion = useMemo(
    () => extraerCamposSegunMascara(lineaPrueba, mascaraPrueba),
    [lineaPrueba, mascaraPrueba],
  );

  const parserServidor = useMemo(
    () => parseLineaRelojBiometrico(lineaPrueba, { mascara_tokens: mascaraPrueba }),
    [lineaPrueba, mascaraPrueba],
  );

  const aplicarEjemplo = useCallback((ej) => {
    setLineaPrueba(ej.linea);
    setMascaraPrueba(ej.mascara);
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-800"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span>Asistente de máscaras TXT</span>
        <span className="text-xs font-normal text-slate-500">{abierto ? "Ocultar" : "Mostrar ayuda"}</span>
      </button>

      {abierto ? (
        <div className="space-y-4 border-t border-slate-200 px-3 pb-4 pt-3 text-sm">
          <p className="text-xs text-slate-600">
            Los separadores de la máscara (espacios, comas, barras) deben coincidir{" "}
            <strong>exactamente</strong> con cada línea del archivo. Probá una línea testigo antes de guardar el
            reloj.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Token</th>
                  <th className="px-2 py-1.5 font-medium">Significado</th>
                  <th className="px-2 py-1.5 font-medium">Ejemplo</th>
                </tr>
              </thead>
              <tbody>
                {CATALOGO_TOKENS_MASCARA.map((row) => (
                  <tr key={row.token} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 font-mono text-violet-800">{row.token}</td>
                    <td className="px-2 py-1.5 text-slate-700">{row.significado}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-500">{row.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            {EJEMPLOS_MASCARA_RAPIDOS.map((ej) => (
              <button
                key={ej.id}
                type="button"
                disabled={disabled}
                className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                onClick={() => aplicarEjemplo(ej)}
              >
                {ej.label}
              </button>
            ))}
            {onUsarMascara ? (
              <button
                type="button"
                disabled={disabled || !mascaraPrueba.trim()}
                className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                onClick={() => onUsarMascara(mascaraPrueba.trim())}
              >
                Usar esta máscara en el formulario
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              1. Línea testigo de tu TXT
              <input
                type="text"
                disabled={disabled}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs"
                value={lineaPrueba}
                onChange={(e) => setLineaPrueba(e.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              2. Máscara de tokens
              <input
                type="text"
                disabled={disabled}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs font-semibold tracking-wide text-violet-800"
                value={mascaraPrueba}
                onChange={(e) => setMascaraPrueba(e.target.value)}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs">
            <p className="font-medium text-slate-700">Vista previa según máscara</p>
            {simulacion.ok ? (
              <dl className="grid gap-1.5 sm:grid-cols-2 font-mono">
                <div>
                  <dt className="text-slate-500">Tarjeta</dt>
                  <dd className="font-semibold text-emerald-700">{simulacion.campos.numero_tarjeta || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Fecha (normalizada)</dt>
                  <dd className="font-semibold text-emerald-700">{simulacion.campos.fecha_ymd || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Hora</dt>
                  <dd className="font-semibold text-emerald-700">{simulacion.campos.hora_hm || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Reloj / función</dt>
                  <dd className="font-semibold text-emerald-700">
                    {[simulacion.campos.numero_reloj, simulacion.campos.codigo_funcion].filter(Boolean).join(" · ") ||
                      "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <ul className="list-disc pl-4 text-amber-900">
                {(simulacion.errores.length ? simulacion.errores : ["No se pudo extraer tarjeta."]).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={`rounded-lg border p-3 text-xs ${
              parserServidor.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="font-medium text-slate-800">Mismo parser que import / apply en servidor</p>
            <p className="mt-1 text-slate-600">
              Usa la máscara de prueba de arriba (default del hospital:{" "}
              <span className="font-mono">{MASCARA_RELOJ_DEFAULT}</span>).
            </p>
            {parserServidor.ok ? (
              <p className="mt-2 font-mono text-emerald-800">
                OK · tarjeta {parserServidor.numero_tarjeta} · {parserServidor.fecha_ymd} {parserServidor.hora_hm} ·
                reloj {parserServidor.numero_reloj} · código {parserServidor.codigo_dispositivo}
              </p>
            ) : (
              <p className="mt-2 text-amber-900">{parserServidor.mensaje || "Línea no válida para import estándar."}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
