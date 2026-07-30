import { useCallback, useEffect, useState } from "react";

import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import AprobarPaseGdtModal from "../../features/plantel/AprobarPaseGdtModal.jsx";
import { PAGE_SIZE_TC, PasesGdtTcToolbar, formatTsMs } from "../../features/plantel/pasesGdtTcUi.jsx";
import {
  callListarPasesGdtPendientesRrhh,
  callListarPasesGdtPendientesTcRrhh,
  callRechazarPaseGdt,
  callTomarConocimientoPaseGdtRrhh,
} from "../../services/callables.js";

/**
 * Bandeja RRHH — resolver externos + TC pendiente/histórico.
 * Ruta: /portal/rrhh/pases-gdt
 */
export default function BandejaPasesGdtRrhhPage() {
  const [vista, setVista] = useState(/** @type {"resolver" | "tc" | "historico"} */ ("resolver"));
  const [items, setItems] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [itemsTc, setItemsTc] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [metaTc, setMetaTc] = useState({
    total: 0,
    page: 1,
    total_pages: 1,
    has_prev: false,
    has_next: false,
    truncated: false,
  });
  const [ordenTc, setOrdenTc] = useState("creado_en");
  const [pageTc, setPageTc] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [paseAprobar, setPaseAprobar] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [paseRechazar, setPaseRechazar] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [tcEnCurso, setTcEnCurso] = useState(/** @type {string | null} */ (null));
  const [countTcPendiente, setCountTcPendiente] = useState(0);
  const [countTcHistorico, setCountTcHistorico] = useState(0);

  const cargarResolver = useCallback(async () => {
    const res = await callListarPasesGdtPendientesRrhh({});
    setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
  }, []);

  const cargarTc = useCallback(
    async (opts = {}) => {
      const vistaTc = opts.vistaTc || (vista === "historico" ? "historico" : "pendiente");
      const orden = opts.orden ?? ordenTc;
      const page = opts.page ?? pageTc;
      const res = await callListarPasesGdtPendientesTcRrhh({
        vista: vistaTc,
        orden,
        direccion: "desc",
        page,
        page_size: PAGE_SIZE_TC,
      });
      const data = res?.data || {};
      setItemsTc(Array.isArray(data.items) ? data.items : []);
      setMetaTc({
        total: Number(data.total) || 0,
        page: Number(data.page) || 1,
        total_pages: Number(data.total_pages) || 1,
        has_prev: data.has_prev === true,
        has_next: data.has_next === true,
        truncated: data.truncated === true,
      });
      if (vistaTc === "historico") setCountTcHistorico(Number(data.total) || 0);
      else setCountTcPendiente(Number(data.total) || 0);
    },
    [vista, ordenTc, pageTc],
  );

  const refrescarContadoresTc = useCallback(async () => {
    const [pend, hist] = await Promise.all([
      callListarPasesGdtPendientesTcRrhh({
        vista: "pendiente",
        page: 1,
        page_size: PAGE_SIZE_TC,
        orden: "creado_en",
        direccion: "desc",
      }),
      callListarPasesGdtPendientesTcRrhh({
        vista: "historico",
        page: 1,
        page_size: PAGE_SIZE_TC,
        orden: "creado_en",
        direccion: "desc",
      }),
    ]);
    setCountTcPendiente(Number(pend?.data?.total) || 0);
    setCountTcHistorico(Number(hist?.data?.total) || 0);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (vista === "resolver") {
        await Promise.all([cargarResolver(), refrescarContadoresTc()]);
      } else {
        await Promise.all([
          cargarTc({
            vistaTc: vista === "historico" ? "historico" : "pendiente",
          }),
          cargarResolver(),
        ]);
        // Contador de la otra pestaña TC
        const other = vista === "historico" ? "pendiente" : "historico";
        const resOther = await callListarPasesGdtPendientesTcRrhh({
          vista: other,
          page: 1,
          page_size: PAGE_SIZE_TC,
          orden: "creado_en",
          direccion: "desc",
        });
        if (other === "historico") setCountTcHistorico(Number(resOther?.data?.total) || 0);
        else setCountTcPendiente(Number(resOther?.data?.total) || 0);
      }
    } catch (e) {
      setError(e?.message || "No se pudo cargar la bandeja de pases.");
      if (vista === "resolver") setItems([]);
      else setItemsTc([]);
    } finally {
      setLoading(false);
    }
  }, [vista, cargarResolver, cargarTc, refrescarContadoresTc]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 5000);
  };

  const cambiarVista = (next) => {
    setVista(next);
    if (next === "tc" || next === "historico") {
      setPageTc(1);
    }
  };

  const confirmarRechazo = async () => {
    if (!paseRechazar?.pase_id) return;
    if (motivoRechazo.trim().length < 3) {
      setError("Indicá un motivo de rechazo (mín. 3 caracteres).");
      return;
    }
    setRechazando(true);
    setError("");
    try {
      await callRechazarPaseGdt({
        pase_id: paseRechazar.pase_id,
        motivo_rechazo: motivoRechazo.trim(),
      });
      setPaseRechazar(null);
      setMotivoRechazo("");
      showFeedback("Pase rechazado. El HLg no fue modificado.");
      await cargar();
    } catch (e) {
      setError(e?.message || "No se pudo rechazar el pase.");
    } finally {
      setRechazando(false);
    }
  };

  const confirmarTc = async (paseId) => {
    if (!paseId) return;
    setTcEnCurso(String(paseId));
    setError("");
    try {
      await callTomarConocimientoPaseGdtRrhh({ pase_id: paseId });
      showFeedback("Toma de conocimiento registrada.");
      await cargar();
    } catch (e) {
      setError(e?.message || "No se pudo registrar la toma de conocimiento.");
    } finally {
      setTcEnCurso(null);
    }
  };

  const esVistaTc = vista === "tc" || vista === "historico";
  const listaActiva = vista === "resolver" ? items : itemsTc;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pases GDT</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Resolvé traslados externos, tomá conocimiento de pases internos o consultá el histórico.
          </p>
        </div>
        <PrimaryButton type="button" onClick={cargar} disabled={loading} className="sm:w-auto">
          {loading ? "Actualizando…" : "Actualizar"}
        </PrimaryButton>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
        {[
          { id: "resolver", label: "A resolver", count: items.length },
          { id: "tc", label: "Tomar conocimiento", count: countTcPendiente },
          { id: "historico", label: "Ya se tomó conocimiento", count: countTcHistorico },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
              vista === tab.id
                ? "border border-b-white border-slate-200 bg-white text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => cambiarVista(/** @type {any} */ (tab.id))}
          >
            {tab.label}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-600">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {esVistaTc ? (
        <PasesGdtTcToolbar
          orden={ordenTc}
          onOrdenChange={(v) => {
            setOrdenTc(v);
            setPageTc(1);
          }}
          page={metaTc.page}
          totalPages={metaTc.total_pages}
          total={metaTc.total}
          hasPrev={metaTc.has_prev}
          hasNext={metaTc.has_next}
          truncated={metaTc.truncated}
          disabled={loading}
          onPrev={() => setPageTc((p) => Math.max(1, p - 1))}
          onNext={() => setPageTc((p) => p + 1)}
        />
      ) : null}

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
                <th className="px-3 py-2.5 font-semibold">Origen</th>
                <th className="px-3 py-2.5 font-semibold">
                  {vista === "resolver" ? "Destino sugerido" : "Destino"}
                </th>
                <th className="px-3 py-2.5 font-semibold">Fecha</th>
                {vista === "historico" ? (
                  <th className="px-3 py-2.5 font-semibold">TC RRHH</th>
                ) : null}
                <th className="px-3 py-2.5 font-semibold text-right">
                  {vista === "historico" ? "Estado" : "Acciones"}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && listaActiva.length === 0 ? (
                <tr>
                  <td colSpan={vista === "historico" ? 6 : 5} className="px-3 py-8 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {!loading && listaActiva.length === 0 ? (
                <tr>
                  <td colSpan={vista === "historico" ? 6 : 5} className="px-3 py-8 text-center text-slate-500">
                    {vista === "resolver"
                      ? "No hay pases pendientes de resolución."
                      : vista === "historico"
                        ? "No hay pases con toma de conocimiento registrada."
                        : "No hay pases pendientes de toma de conocimiento."}
                  </td>
                </tr>
              ) : null}
              {listaActiva.map((it) => {
                const nombre =
                  [it.agente_apellido, it.agente_nombre].filter(Boolean).join(", ") ||
                  it.agente_persona_id;
                const destino =
                  vista === "resolver"
                    ? String(it.destino_sugerido_texto || "—")
                    : String(it.gdt_destino_nombre || it.gdt_destino_id || "—");
                const tcPor =
                  [it.rrhh_toma_conocimiento_por_apellido, it.rrhh_toma_conocimiento_por_nombre]
                    .filter(Boolean)
                    .join(", ") || it.rrhh_toma_conocimiento_por;
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
                      {String(it.gdt_origen_nombre || it.gdt_origen_id || "—")}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{destino}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">
                      {String(it.fecha_efectiva || "—")}
                    </td>
                    {vista === "historico" ? (
                      <td className="px-3 py-3 text-slate-700">
                        <p className="whitespace-nowrap text-xs">
                          {formatTsMs(/** @type {number|null} */ (it.rrhh_toma_conocimiento_en_ms))}
                        </p>
                        {tcPor ? <p className="mt-0.5 text-xs text-slate-500">{String(tcPor)}</p> : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-3 text-right">
                      {vista === "resolver" ? (
                        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                          <button
                            type="button"
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            onClick={() => setPaseAprobar(it)}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setMotivoRechazo("");
                              setPaseRechazar(it);
                            }}
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : vista === "tc" ? (
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

      <AprobarPaseGdtModal
        abierto={Boolean(paseAprobar)}
        pase={/** @type {any} */ (paseAprobar)}
        onCerrar={() => setPaseAprobar(null)}
        onExito={(data) => {
          showFeedback(
            `Pase aprobado. Nuevo HLg desde ${data.fecha_inicio_destino || "el día siguiente"} (${data.pase_id || "ok"}).`,
          );
          cargar();
        }}
      />

      {paseRechazar ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !rechazando) setPaseRechazar(null);
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">Rechazar pase</h2>
            <p className="mt-1 text-xs text-slate-500">
              No se modifica el HLg del agente. Indicá el motivo del rechazo.
            </p>
            <textarea
              className="mt-3 min-h-[5rem] w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              value={motivoRechazo}
              onChange={(ev) => setMotivoRechazo(ev.target.value)}
              disabled={rechazando}
              placeholder="Motivo del rechazo…"
              maxLength={500}
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
              <PrimaryButton
                type="button"
                disabled={rechazando || motivoRechazo.trim().length < 3}
                onClick={confirmarRechazo}
                className="sm:w-auto"
              >
                {rechazando ? "Rechazando…" : "Confirmar rechazo"}
              </PrimaryButton>
              <button
                type="button"
                className="min-h-12 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={rechazando}
                onClick={() => setPaseRechazar(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
