import { useCallback, useEffect, useState } from "react";

import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { PAGE_SIZE_TC, PasesGdtTcToolbar, formatTsMs } from "../../features/plantel/pasesGdtTcUi.jsx";
import {
  callListarPasesGdtPendientesTcJefe,
  callTomarConocimientoPaseGdtJefe,
} from "../../services/callables.js";

/**
 * Bandeja jefe — TC pendiente + histórico de pases GDT.
 * Ruta: /portal/jefe/pases-gdt-tc
 */
export default function BandejaPasesGdtTcJefePage() {
  const [vista, setVista] = useState(/** @type {"pendiente" | "historico"} */ ("pendiente"));
  const [items, setItems] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    total_pages: 1,
    has_prev: false,
    has_next: false,
    truncated: false,
  });
  const [countPendiente, setCountPendiente] = useState(0);
  const [countHistorico, setCountHistorico] = useState(0);
  const [orden, setOrden] = useState("creado_en");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [tcEnCurso, setTcEnCurso] = useState(/** @type {string | null} */ (null));

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, resOther] = await Promise.all([
        callListarPasesGdtPendientesTcJefe({
          vista,
          orden,
          direccion: "desc",
          page,
          page_size: PAGE_SIZE_TC,
        }),
        callListarPasesGdtPendientesTcJefe({
          vista: vista === "historico" ? "pendiente" : "historico",
          orden: "creado_en",
          direccion: "desc",
          page: 1,
          page_size: PAGE_SIZE_TC,
        }),
      ]);
      const data = res?.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setMeta({
        total: Number(data.total) || 0,
        page: Number(data.page) || 1,
        total_pages: Number(data.total_pages) || 1,
        has_prev: data.has_prev === true,
        has_next: data.has_next === true,
        truncated: data.truncated === true,
      });
      if (vista === "historico") {
        setCountHistorico(Number(data.total) || 0);
        setCountPendiente(Number(resOther?.data?.total) || 0);
      } else {
        setCountPendiente(Number(data.total) || 0);
        setCountHistorico(Number(resOther?.data?.total) || 0);
      }
      if (data.warning) {
        // soft warning — no bloquea
        console.warn(data.warning);
      }
    } catch (e) {
      setError(e?.message || "No se pudo cargar la bandeja de pases.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [vista, orden, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 5000);
  };

  const confirmarTc = async (paseId) => {
    if (!paseId) return;
    setTcEnCurso(String(paseId));
    setError("");
    try {
      await callTomarConocimientoPaseGdtJefe({ pase_id: paseId });
      showFeedback("Toma de conocimiento registrada.");
      await cargar();
    } catch (e) {
      setError(e?.message || "No se pudo registrar la toma de conocimiento.");
    } finally {
      setTcEnCurso(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pases GDT — toma de conocimiento</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Acusá recibo de pases ya ejecutados o consultá los que ya tomaste conocimiento. No modifica el
            HLg.
          </p>
        </div>
        <PrimaryButton type="button" onClick={cargar} disabled={loading} className="sm:w-auto">
          {loading ? "Actualizando…" : "Actualizar"}
        </PrimaryButton>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
        {[
          { id: "pendiente", label: "Pendientes", count: countPendiente },
          { id: "historico", label: "Ya se tomó conocimiento", count: countHistorico },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
              vista === tab.id
                ? "border border-b-white border-slate-200 bg-white text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => {
              setVista(/** @type {any} */ (tab.id));
              setPage(1);
            }}
          >
            {tab.label}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-600">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <PasesGdtTcToolbar
        orden={orden}
        onOrdenChange={(v) => {
          setOrden(v);
          setPage(1);
        }}
        page={meta.page}
        totalPages={meta.total_pages}
        total={meta.total}
        hasPrev={meta.has_prev}
        hasNext={meta.has_next}
        truncated={meta.truncated}
        disabled={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      {feedback ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Agente</th>
                <th className="px-3 py-2.5 font-semibold">Origen → destino</th>
                <th className="px-3 py-2.5 font-semibold">Fecha</th>
                {vista === "historico" ? (
                  <th className="px-3 py-2.5 font-semibold">Tu TC</th>
                ) : null}
                <th className="px-3 py-2.5 font-semibold text-right">
                  {vista === "historico" ? "Estado" : "Acción"}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={vista === "historico" ? 5 : 4}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={vista === "historico" ? 5 : 4}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    {vista === "historico"
                      ? "No tenés pases con toma de conocimiento registrada."
                      : "No tenés pases pendientes de toma de conocimiento."}
                  </td>
                </tr>
              ) : null}
              {items.map((it) => {
                const nombre =
                  [it.agente_apellido, it.agente_nombre].filter(Boolean).join(", ") ||
                  it.agente_persona_id;
                const origen = String(it.gdt_origen_nombre || it.gdt_origen_id || "—");
                const destino = String(it.gdt_destino_nombre || it.gdt_destino_id || "—");
                return (
                  <tr key={String(it.pase_id)} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{nombre}</p>
                      <p className="text-xs text-slate-500">DNI {it.agente_dni || "—"}</p>
                      {it.tipo_pase ? (
                        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {String(it.tipo_pase)}
                          {it.estado ? ` · ${String(it.estado)}` : ""}
                        </p>
                      ) : null}
                      {it.motivo ? (
                        <p className="mt-1 max-w-xs text-xs text-slate-500 line-clamp-2">
                          {String(it.motivo)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <span>{origen}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span>{destino}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">
                      {String(it.fecha_efectiva || "—")}
                    </td>
                    {vista === "historico" ? (
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-700">
                        {formatTsMs(
                          /** @type {number|null} */ (
                            it.jefe_toma_conocimiento_en_ms || it.tc_en_ms
                          ),
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-3 text-right">
                      {vista === "pendiente" ? (
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                          disabled={tcEnCurso === String(it.pase_id)}
                          onClick={() => confirmarTc(it.pase_id)}
                        >
                          {tcEnCurso === String(it.pase_id)
                            ? "Registrando…"
                            : "Tomar conocimiento"}
                        </button>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          Acusado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
