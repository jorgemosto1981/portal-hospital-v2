import { useEffect, useState } from "react";

import { callObtenerPlantelPorGdt } from "../../services/callables.js";
import { ymdHoyBa } from "../solicitudes/ticketeraUtils.js";

/**
 * @param {{
 *   gdtId: string;
 *   gdtNombre?: string;
 *   aFecha?: string;
 * }} props
 */
export default function TablaPlantelGdt({ gdtId, gdtNombre = "", aFecha }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const id = String(gdtId || "").trim();
    if (!/^gdt_/i.test(id)) {
      setPayload(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    let cancel = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const fecha =
          typeof aFecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(aFecha.trim())
            ? aFecha.trim()
            : ymdHoyBa();
        const res = await callObtenerPlantelPorGdt({ gdt_id: id, a_fecha: fecha });
        if (cancel) return;
        setPayload(res?.data || null);
      } catch (e) {
        if (cancel) return;
        setPayload(null);
        const code = e?.code ? String(e.code) : "";
        const msg = e?.message || "No se pudo cargar el plantel.";
        if (code.includes("permission-denied") || /permission/i.test(msg)) {
          setError(
            "Sin jurisdicción de lectura en este GDT (MVP: requiere HLg vigente en el grupo).",
          );
        } else {
          setError(msg);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [gdtId, aFecha]);

  if (!gdtId) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        Seleccioná un grupo de trabajo en el árbol para ver su plantel.
      </div>
    );
  }

  const titulo = gdtNombre || payload?.gdt?.nombre || gdtId;
  const integrantes = Array.isArray(payload?.integrantes) ? payload.integrantes : [];
  const total = typeof payload?.total === "number" ? payload.total : integrantes.length;
  const fechaRef = payload?.a_fecha || aFecha || ymdHoyBa();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 shrink-0">
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Vigentes al {fechaRef}
          {!loading && !error ? ` · ${total} integrante${total === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando plantel…</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Apellido</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">DNI</th>
                <th className="px-3 py-2">Nivel</th>
                <th className="px-3 py-2">Vigencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {integrantes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Sin integrantes vigentes en este grupo.
                  </td>
                </tr>
              ) : (
                integrantes.map((row) => (
                  <tr key={row.hlg_id || `${row.persona_id}-${row.fecha_inicio}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900" title={row.hlg_id || undefined}>
                      {row.apellido || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-800">{row.nombre || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">{row.dni || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {row.nivel_jerarquico == null ? "—" : row.nivel_jerarquico}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {row.fecha_inicio || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
