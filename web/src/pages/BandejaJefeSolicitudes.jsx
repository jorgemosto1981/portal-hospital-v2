import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import BandejaJefeSolicitudDetalle from "../features/solicitudes/BandejaJefeSolicitudDetalle.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { claimsIncludeJefe, claimsIncludeRrhh } from "../features/routing/portalRole.js";
import BandejaSolicitudResumenFilas from "../features/solicitudes/BandejaSolicitudResumenFilas.jsx";
import {
  FILTROS_VISTA_JEFE,
  useBandejaJefeSolicitudes,
} from "../features/solicitudes/useBandejaJefeSolicitudes.js";
import { callResolverDecisionJefeSolicitud } from "../services/callables.js";
import { periodosVentanaJefe, rangoFechasVentanaJefe } from "../features/jefe/periodoJefe.js";

export default function BandejaJefeSolicitudes() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const esJefe = claimsIncludeJefe(claims);
  const periodos = periodosVentanaJefe();
  const rango = rangoFechasVentanaJefe();

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
  } = useBandejaJefeSolicitudes({
    fechaDesdeMin: rango.desdeYmd,
    fechaHastaMax: rango.hastaYmd,
  });

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

  async function decidir(decision) {
    if (!selId || procesando) return;
    setProcesando(true);
    const t = toast.loading(decision === "aprobar" ? "Aprobando…" : "Rechazando…");
    try {
      await callResolverDecisionJefeSolicitud({
        solicitud_id: selId,
        decision,
        motivo: motivo.trim() || undefined,
      });
      toast.success(
        decision === "aprobar" ? "Solicitud aprobada (cierre jerárquico)." : "Solicitud rechazada.",
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

  if (!esJefe && !esRrhh) {
    return (
      <Card className="mx-auto mt-6 w-full max-w-2xl p-4">
        <p className="text-sm text-slate-700">Sin permisos de jefatura para esta sección.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bandeja — revisión jefe</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Filtrá por estado o titular. Orden: fecha de inicio, de la más antigua a la más próxima.
          <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            Ventana activa: {periodos[0]} · {periodos[1]} · {periodos[2]}
          </span>
          {esRrhh ? (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
              Sesión RRHH
            </span>
          ) : (
            <span className="block text-slate-500">Solo trámites donde sos autorizador jerárquico (HLg).</span>
          )}
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
            {FILTROS_VISTA_JEFE.map((f) => (
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
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Usuario (nombre o DNI)</span>
            <input
              type="search"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={aplicarFiltros}
          disabled={cargando}
          className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          Buscar
        </button>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
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
            className="text-sm font-medium text-blue-700 hover:underline disabled:opacity-50"
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
                      ? "border-blue-400 shadow-sm ring-1 ring-blue-200"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSel(s.solicitud_id)}
                    className={[
                      "w-full px-4 py-3 text-left",
                      expanded ? "bg-blue-50/90" : "hover:bg-slate-50",
                    ].join(" ")}
                    aria-expanded={expanded}
                  >
                    <BandejaSolicitudResumenFilas
                      s={s}
                      etiquetaClassName="mt-1 text-xs font-medium text-blue-800"
                    />
                  </button>
                  {expanded ? (
                    <BandejaJefeSolicitudDetalle
                      sel={s}
                      motivo={motivo}
                      setMotivo={setMotivo}
                      procesando={procesando}
                      onDecidir={decidir}
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
              className="mt-4 min-h-11 w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
            >
              {cargandoMas ? "Cargando más…" : "Cargar más solicitudes"}
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
