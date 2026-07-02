import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import BandejaAuditorSolicitudDetalle from "../features/solicitudes/BandejaAuditorSolicitudDetalle.jsx";
import BandejaSolicitudResumenFilas from "../features/solicitudes/BandejaSolicitudResumenFilas.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { claimsIncludeAuditorMedico } from "../features/routing/portalRole.js";
import {
  FILTROS_VISTA_AUDITOR,
  useBandejaAuditorSolicitudes,
} from "../features/solicitudes/useBandejaAuditorSolicitudes.js";
import { callClasificarSolicitudMedicaAuditor } from "../services/callables.js";

export default function BandejaAuditorSolicitudes() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const puedeAuditar = claimsIncludeAuditorMedico(claims);

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
  } = useBandejaAuditorSolicitudes();

  const [selId, setSelId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [imputacionArticulo, setImputacionArticulo] = useState(null);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fromUrl = String(searchParams.get("sol_id") || "").trim();
    if (/^sol_/i.test(fromUrl)) setSelId(fromUrl);
  }, [searchParams, lista]);

  const sel = lista.find((s) => s.solicitud_id === selId) || null;

  useEffect(() => {
    setImputacionArticulo(null);
  }, [sel?.solicitud_id]);

  const toggleSel = useCallback((id) => {
    setSelId((prev) => (prev === id ? "" : id));
    setObservacion("");
    setImputacionArticulo(null);
  }, []);

  async function clasificar(dictamenFavorable) {
    if (!sel || procesando || sel.puede_clasificar !== true) return;
    setProcesando(true);
    const t = toast.loading(dictamenFavorable ? "Registrando dictamen favorable…" : "Registrando rechazo…");
    try {
      const res = await callClasificarSolicitudMedicaAuditor({
        solicitud_id: sel.solicitud_id,
        articulo_id: imputacionArticulo?.articulo_id || sel.articulo_id,
        version_id_aplicada: imputacionArticulo?.version_id_aplicada || sel.version_aplicada_id,
        fecha_desde: sel.fecha_desde,
        fecha_hasta: sel.fecha_hasta,
        grupo_trabajo_id_ancla: sel.grupo_trabajo_id_ancla || undefined,
        observacion_auditor: observacion.trim() || undefined,
        dictamen_favorable: dictamenFavorable,
        causal_larga_duracion_id: sel.causal_larga_duracion_id || undefined,
      });
      const data = res?.data || {};
      const estado = String(data.estado_solicitud_id || "");
      let msg = "Clasificación registrada.";
      if (estado.includes("junta")) msg = "Derivado a junta médica.";
      else if (estado.includes("aprobada")) msg = "Licencia aprobada y consolidada en grilla.";
      else if (estado.includes("rechazada")) msg = "Aviso rechazado.";
      toast.success(msg, { id: t });
      setSelId("");
      setObservacion("");
      await recargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo clasificar.", { id: t });
    } finally {
      setProcesando(false);
    }
  }

  if (!puedeAuditar) {
    return (
      <Card className="mx-auto mt-6 w-full max-w-2xl p-4">
        <p className="text-sm text-slate-700">Sin permisos de auditoría médica para esta sección.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bandeja — auditoría médica</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Cola de avisos en pendiente de clasificación. Por defecto se muestran avisos completos (con certificado).
          Orden: fecha de inicio, de la más antigua a la más próxima.
        </p>
      </header>

      <Card className="mt-4 space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Filtros</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Vista</span>
          <select
            value={filtroVista}
            onChange={(e) => setFiltroVista(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {FILTROS_VISTA_AUDITOR.map((f) => (
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
          className="min-h-11 w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
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
            className="text-sm font-medium text-teal-800 hover:underline disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        <div className="p-4">
          {cargando && lista.length === 0 ? <p className="text-sm text-slate-500">Cargando…</p> : null}
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          {!cargando && !error && lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay avisos con estos filtros.</p>
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
                      ? "border-teal-400 shadow-sm ring-1 ring-teal-200"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSel(s.solicitud_id)}
                    className={[
                      "w-full px-4 py-3 text-left",
                      expanded ? "bg-teal-50/90" : "hover:bg-slate-50",
                    ].join(" ")}
                    aria-expanded={expanded}
                  >
                    <BandejaSolicitudResumenFilas
                      s={s}
                      etiquetaClassName={[
                        "mt-1 text-xs font-medium",
                        s.es_licencia_incompleta ? "text-amber-800" : "text-teal-900",
                      ].join(" ")}
                    />
                  </button>
                  {expanded ? (
                    <BandejaAuditorSolicitudDetalle
                      sel={s}
                      imputacionArticulo={s.solicitud_id === selId ? imputacionArticulo : null}
                      onImputacionArticuloChange={setImputacionArticulo}
                      observacion={observacion}
                      setObservacion={setObservacion}
                      procesando={procesando}
                      onClasificar={clasificar}
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
              className="mt-4 min-h-11 w-full rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:opacity-50"
            >
              {cargandoMas ? "Cargando más…" : "Cargar más avisos"}
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
