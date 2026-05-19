import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { useSolicitud64AAlta } from "../features/solicitudes/useSolicitud64AAlta.js";

/**
 * Alta solicitud 64-A (asuntos particulares, Patrón B) — MVP slice ticketera.
 */
export default function Solicitud64AAlta() {
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();

  const {
    fechaDesde,
    setFechaDesde,
    articulos,
    articuloSel,
    setArticuloSel,
    cargando,
    error,
    motivoVacio,
    enviando,
    recargar,
    enviar,
  } = useSolicitud64AAlta({ personaId });

  const puedeEnviar = Boolean(articuloSel) && !cargando && !enviando && /^per_/i.test(personaId);

  async function onEnviar() {
    const solId = await enviar();
    if (solId) {
      toast.success(`Solicitud aceptada (${solId}). Estado: en revisión por jefe.`);
      await recargar();
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Asuntos particulares (64-A)</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Un día por solicitud. El saldo del ciclo se reserva al enviar. Solo aparecen artículos para los que cumplís
        requisitos de cargo y rol.
      </p>

      <Card className="mt-6 space-y-4 p-4">
        {!claimsLoading && !/^per_/i.test(personaId) ? (
          <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Fecha del permiso</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          />
        </label>

        {cargando ? <p className="text-sm text-slate-500">Buscando artículos disponibles…</p> : null}

        {!cargando && articulos.length === 0 && !error ? (
          <p className="text-sm text-slate-600">
            {motivoVacio ||
              "No hay artículos disponibles para esa fecha (revisá cargo vigente, rol en cargo o requisitos del artículo)."}
          </p>
        ) : null}

        {articulos.length > 1 ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Artículo</span>
            <select
              value={articuloSel?.articulo_id || ""}
              onChange={(e) => {
                const art = articulos.find((a) => a.articulo_id === e.target.value);
                setArticuloSel(art || null);
              }}
              className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base"
            >
              <option value="">Elegí un artículo</option>
              {articulos.map((a) => (
                <option key={a.articulo_id} value={a.articulo_id}>
                  {a.codigo_grilla || a.nombre || a.articulo_id}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {articuloSel ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">{articuloSel.codigo_grilla || "64-A"}</span>
            {articuloSel.nombre ? ` — ${articuloSel.nombre}` : ""}
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          disabled={!puedeEnviar}
          onClick={onEnviar}
          className="min-h-[44px] w-full touch-manipulation rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar solicitud (1 día)"}
        </button>
      </Card>
    </div>
  );
}
