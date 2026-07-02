import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import BandejaJuntaSolicitudDetalle from "../features/solicitudes/BandejaJuntaSolicitudDetalle.jsx";
import BandejaSolicitudResumenFilas from "../features/solicitudes/BandejaSolicitudResumenFilas.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { claimsIncludeJuntaMedica } from "../features/routing/portalRole.js";
import { useBandejaJuntaSolicitudes } from "../features/solicitudes/useBandejaJuntaSolicitudes.js";
import { callRegistrarDictamenJuntaMedica } from "../services/callables.js";

export default function BandejaJuntaSolicitudes() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const puedeJunta = claimsIncludeJuntaMedica(claims);

  const {
    lista,
    cargando,
    cargandoMas,
    error,
    hasMore,
    totalFiltrado,
    dni,
    setDni,
    usuario,
    setUsuario,
    recargar,
    cargarMas,
    aplicarFiltros,
  } = useBandejaJuntaSolicitudes();

  const [selId, setSelId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [procesando, setProcesando] = useState(false);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fromUrl = String(searchParams.get("sol_id") || "").trim();
    if (/^sol_/i.test(fromUrl)) setSelId(fromUrl);
  }, [searchParams, lista]);

  const sel = lista.find((s) => s.solicitud_id === selId) || null;

  const toggleSel = useCallback((id) => {
    setSelId((prev) => (prev === id ? "" : id));
    setObservacion("");
  }, []);

  async function dictaminar(dictamenFavorable) {
    if (!sel || procesando || sel.puede_dictaminar !== true) return;
    setProcesando(true);
    const t = toast.loading(dictamenFavorable ? "Registrando dictamen favorable…" : "Registrando rechazo…");
    try {
      const res = await callRegistrarDictamenJuntaMedica({
        solicitud_id: sel.solicitud_id,
        dictamen_favorable: dictamenFavorable,
        observacion_junta: observacion.trim() || undefined,
      });
      const data = res?.data || {};
      toast.success(String(data.mensaje_ui || "Dictamen registrado."), { id: t });
      setSelId("");
      setObservacion("");
      await recargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo registrar el dictamen.", { id: t });
    } finally {
      setProcesando(false);
    }
  }

  if (!puedeJunta) {
    return (
      <Card className="mx-auto mt-6 w-full max-w-2xl p-4">
        <p className="text-sm text-slate-700">Sin permisos de junta médica para esta sección.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bandeja — junta médica</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Trámites derivados por el auditor a espera de dictamen. Orden: fecha de inicio, de la más antigua a la más
          próxima.
        </p>
      </header>

      <Card className="mt-4 space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Filtros</p>
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
          className="min-h-11 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
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
            className="text-sm font-medium text-violet-800 hover:underline disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        <div className="p-4">
          {cargando && lista.length === 0 ? <p className="text-sm text-slate-500">Cargando…</p> : null}
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          {!cargando && !error && lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay trámites en espera de junta.</p>
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
                      etiquetaClassName="mt-1 text-xs font-medium text-violet-900"
                    />
                  </button>
                  {expanded ? (
                    <BandejaJuntaSolicitudDetalle
                      sel={s}
                      observacion={observacion}
                      setObservacion={setObservacion}
                      procesando={procesando}
                      onDictaminar={dictaminar}
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
              {cargandoMas ? "Cargando más…" : "Cargar más trámites"}
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
