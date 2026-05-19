import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Card from "../components/ui/Card.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { callListarArticulosIngresoAgente } from "../services/callables.js";
import { ymdHoyBa } from "../features/solicitudes/ticketeraUtils.js";

export default function TicketeraHub() {
  const nav = useNavigate();
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();

  const [fechaDesde, setFechaDesde] = useState(ymdHoyBa);
  const [cargando, setCargando] = useState(false);
  const [conteoPatronB, setConteoPatronB] = useState(/** @type {number | null} */ (null));
  const [motivoVacio, setMotivoVacio] = useState("");
  const [errorListado, setErrorListado] = useState("");

  const recargar = useCallback(async () => {
    if (!/^per_/i.test(personaId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
      setConteoPatronB(0);
      setMotivoVacio("");
      setErrorListado("");
      return;
    }
    setCargando(true);
    setMotivoVacio("");
    setErrorListado("");
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: fechaDesde });
      const list = res?.data?.articulos || [];
      setConteoPatronB(list.length);
      if (list.length === 0) {
        const ev = res?.data?.elegibilidad_vacia;
        const msg = Array.isArray(ev?.mensajes) ? String(ev.mensajes[0] || "").trim() : "";
        setMotivoVacio(msg);
      }
    } catch (e) {
      setConteoPatronB(0);
      setMotivoVacio("");
      setErrorListado(e?.message || "No se pudo consultar artículos (revisá sesión o red).");
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, personaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  function irPatronB() {
    if (!conteoPatronB) return;
    nav(`/portal/solicitudes/patron-b?fecha=${encodeURIComponent(fechaDesde)}`);
  }

  return (
    <div className="space-y-4">
      {!claimsLoading && !/^per_/i.test(personaId) ? (
        <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
      ) : null}

      <Card className="space-y-4 p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Fecha de la solicitud</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          />
        </label>
        {cargando ? <p className="text-sm text-slate-500">Actualizando artículos disponibles…</p> : null}
        {errorListado ? <p className="text-sm text-red-700">{errorListado}</p> : null}
      </Card>

      <p className="text-sm font-medium text-slate-700">Tipo de trámite</p>

      <button
        type="button"
        disabled={cargando || !conteoPatronB}
        onClick={irPatronB}
        className="flex w-full flex-col rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-left shadow-sm transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-sm font-semibold text-sky-950">Asuntos particulares y similares</span>
        <span className="mt-1 text-xs text-sky-800">
          {cargando
            ? "Verificando elegibilidad…"
            : conteoPatronB
              ? `${conteoPatronB} artículo(s) disponible(s) para esa fecha`
              : motivoVacio || "No hay artículos Patrón B para esa fecha"}
        </span>
      </button>

      <Link
        to="/portal/solicitudes/lao"
        className="flex w-full flex-col rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left shadow-sm transition-colors hover:bg-emerald-100"
      >
        <span className="text-sm font-semibold text-emerald-950">Licencia anual ordinaria (LAO)</span>
        <span className="mt-1 text-xs text-emerald-800">Cálculo de días, preview y envío (Patrón A)</span>
      </Link>
    </div>
  );
}
