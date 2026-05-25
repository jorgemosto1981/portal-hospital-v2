import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import BandejaRrhhSolicitudDetalle from "../features/solicitudes/BandejaRrhhSolicitudDetalle.jsx";
import BandejaSolicitudResumenFilas from "../features/solicitudes/BandejaSolicitudResumenFilas.jsx";
import {
  FILTROS_VISTA_RRHH,
  useBandejaRrhhSolicitudes,
} from "../features/solicitudes/useBandejaRrhhSolicitudes.js";
import {
  callRegistrarTomaConocimientoRrhhSolicitud,
  callResolverDecisionRrhhSolicitud,
} from "../services/callables.js";

export default function BandejaRrhhSolicitudes() {
  const {
    lista,
    cargando,
    cargandoMas,
    error,
    hasMore,
    totalFiltrado,
    filtroVista,
    setFiltroVista,
    dni,
    setDni,
    usuario,
    setUsuario,
    recargar,
    cargarMas,
    aplicarFiltros,
  } = useBandejaRrhhSolicitudes();

  const [selId, setSelId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fromUrl = String(searchParams.get("sol_id") || "").trim();
    if (/^sol_/i.test(fromUrl)) setSelId(fromUrl);
  }, [searchParams, lista]);

  const sel = lista.find((s) => s.solicitud_id === selId) || null;

  const toggleSel = useCallback((id) => {
    setSelId((prev) => (prev === id ? "" : id));
    setMotivo("");
  }, []);

  async function registrarTomaConocimiento() {
    if (!selId || procesando) return;
    setProcesando(true);
    const t = toast.loading("Registrando toma de conocimiento…");
    try {
      await callRegistrarTomaConocimientoRrhhSolicitud({
        solicitud_id: selId,
        motivo: motivo.trim() || undefined,
      });
      toast.success("Toma de conocimiento registrada.", { id: t });
      setSelId("");
      setMotivo("");
      await recargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo registrar.", { id: t });
    } finally {
      setProcesando(false);
    }
  }

  async function decidir(decision) {
    if (!selId || procesando) return;
    setProcesando(true);
    const t = toast.loading(decision === "aprobar" ? "Aprobando…" : "Rechazando…");
    try {
      await callResolverDecisionRrhhSolicitud({
        solicitud_id: selId,
        decision,
        motivo: motivo.trim() || undefined,
      });
      toast.success(
        decision === "aprobar" ? "Solicitud aprobada (definitiva)." : "Solicitud rechazada.",
        { id: t },
      );
      setSelId("");
      setMotivo("");
      await recargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo completar la acción.", { id: t });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bandeja — revisión RRHH</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Filtrá por estado o titular. Orden: fecha de inicio de la licencia, de la más antigua a la más próxima.
        </p>
      </header>

      <Card className="mt-4 space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Filtros</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Estado / vista</span>
          <select
            value={filtroVista}
            onChange={(e) => setFiltroVista(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {FILTROS_VISTA_RRHH.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">DNI titular</span>
            <input
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Solo dígitos"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Usuario (nombre o DNI)</span>
            <input
              type="search"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Apellido, nombre…"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={aplicarFiltros}
          disabled={cargando}
          className="min-h-11 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          Buscar
        </button>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/60 px-4 py-3">
          <span className="text-sm font-semibold text-slate-800">
            Resultados
            {!cargando && !error && totalFiltrado != null ? (
              <span className="ml-2 text-xs font-normal text-slate-600">
                {lista.length} de {totalFiltrado}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            className="text-sm font-medium text-violet-800 hover:underline disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        <div className="p-4">
          {cargando && lista.length === 0 ? <p className="text-sm text-slate-500">Cargando…</p> : null}
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          {!cargando && !error && lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay solicitudes con estos filtros.</p>
          ) : null}

          <ul className="space-y-2">
            {lista.map((s) => {
              const expanded = selId === s.solicitud_id;
              return (
                <li
                  key={s.solicitud_id}
                  className={[
                    "overflow-hidden rounded-xl border transition-all",
                    expanded
                      ? "border-violet-400 shadow-sm ring-1 ring-violet-200"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSel(s.solicitud_id)}
                    className={[
                      "w-full px-4 py-3 text-left",
                      expanded ? "bg-violet-50/90" : "hover:bg-slate-50",
                    ].join(" ")}
                    aria-expanded={expanded}
                  >
                    <BandejaSolicitudResumenFilas
                      s={s}
                      etiquetaClassName="mt-1 text-xs font-medium text-violet-800"
                    />
                  </button>
                  {expanded ? (
                    <BandejaRrhhSolicitudDetalle
                      sel={s}
                      motivo={motivo}
                      setMotivo={setMotivo}
                      procesando={procesando}
                      onDecidir={decidir}
                      onTomaConocimiento={registrarTomaConocimiento}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <button
              type="button"
              disabled={cargandoMas || cargando}
              onClick={() => void cargarMas()}
              className="mt-4 min-h-11 w-full rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-50"
            >
              {cargandoMas ? "Cargando más…" : "Cargar más solicitudes"}
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
