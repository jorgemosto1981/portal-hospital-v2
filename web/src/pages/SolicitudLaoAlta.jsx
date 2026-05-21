import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import LaoPreviewInfo from "../features/articulos/LaoPreviewInfo.jsx";
import { useLaoAltaPreview } from "../features/articulos/useLaoAltaPreview.js";
import { useLaoVersionAutoResolve } from "../features/articulos/useLaoVersionAutoResolve.js";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import Card from "../components/ui/Card.jsx";
import { LAO_ARTICULO_ID } from "../constants/laoArticulo.js";
import { crearSolicitudArticuloLaoBorrador } from "../services/solicitudesArticuloV2Service.js";
import { ymdHoyBa } from "../features/solicitudes/ticketeraUtils.js";

function fechaDesdeQuery(searchParams) {
  const f = String(searchParams.get("fecha") || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : "";
}

/**
 * Alta de solicitud LAO (MVP): formulario mínimo + preview en vivo y bloqueo de envío según `eligible`.
 */
export default function SolicitudLaoAlta() {
  const location = useLocation();
  const enTicketera = location.pathname.includes("/portal/solicitudes/lao");
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String((claims && claims.persona_id) || "").trim();
  const [searchParams] = useSearchParams();
  const fechaInicial = useMemo(() => fechaDesdeQuery(searchParams) || ymdHoyBa(), [searchParams]);

  const [articuloId, setArticuloId] = useState(() => searchParams.get("articulo_id") || LAO_ARTICULO_ID);
  const [versionId, setVersionId] = useState("");
  const [fechaDesde, setFechaDesde] = useState(fechaInicial);
  const [anioOrigenBolsa, setAnioOrigenBolsa] = useState("");
  const [enviando, setEnviando] = useState(false);

  const onResolvedVersionId = useCallback((verId) => {
    setVersionId(verId);
  }, []);

  const { resolviendo, errorVersion } = useLaoVersionAutoResolve({
    articuloId,
    anioOrigenBolsa,
    onResolvedVersionId,
  });

  useEffect(() => {
    const qArt = searchParams.get("articulo_id");
    if (qArt && /^art_/i.test(qArt)) setArticuloId(qArt);
  }, [searchParams]);

  useEffect(() => {
    const qFecha = fechaDesdeQuery(searchParams);
    if (qFecha) setFechaDesde(qFecha);
  }, [searchParams]);

  const { simulacion, error, cargando, puedeLlamar } = useLaoAltaPreview({
    articuloId,
    versionId,
    fechaDesde,
    anioOrigenBolsa,
  });

  const enviarHabilitado = Boolean(simulacion?.eligible) && !claimsLoading && /^per_/i.test(personaId);

  const onEnviar = useCallback(async () => {
    if (!enviarHabilitado || enviando) return;
    if (!/^per_/i.test(personaId)) {
      toast.error("Tu sesión no tiene persona_id; no se puede enviar la solicitud.");
      return;
    }
    setEnviando(true);
    try {
      const { solicitud_id } = await crearSolicitudArticuloLaoBorrador({
        personaId,
        articuloId: articuloId.trim(),
        versionAplicadaId: versionId.trim(),
        fechaDesde: fechaDesde.trim(),
        anioOrigenBolsa: Number(anioOrigenBolsa),
      });
      toast.success(`Solicitud creada: ${solicitud_id}. El sistema validará y actualizará el estado.`);
    } catch (e) {
      const msg = e && typeof e.message === "string" ? e.message : "No se pudo guardar la solicitud.";
      toast.error(msg);
    } finally {
      setEnviando(false);
    }
  }, [anioOrigenBolsa, articuloId, enviarHabilitado, enviando, fechaDesde, personaId, versionId]);

  return (
    <div className={enTicketera ? "" : "mx-auto w-full max-w-lg px-4 py-6"}>
      {enTicketera ? (
        <p className="mb-3 text-xs text-slate-500">
          Carril LAO (Patrón A) ·{" "}
          <Link to="/portal/solicitudes" className="font-medium text-blue-700 hover:underline">
            cambiar fecha o carril
          </Link>
        </p>
      ) : null}
      <h2 className="text-lg font-semibold text-slate-900">Nueva solicitud (LAO)</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Completá los datos y el sistema simula Stock vs proporcional, guardas 01/07 y TSE. El envío queda bloqueado si la
        simulación no habilita el trámite.
      </p>

      <Card className="mt-6 space-y-4 p-4 md:p-5">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">articulo_id</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={articuloId}
            onChange={(e) => setArticuloId(e.target.value)}
            placeholder="art_…"
            className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 outline-none ring-blue-100 focus-visible:ring-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">version_aplicada_id</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            placeholder="ver_… (auto por año bolsa)"
            className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 outline-none ring-blue-100 focus-visible:ring-2"
          />
          {resolviendo ? (
            <p className="text-xs text-slate-500">Resolviendo versión LAO del ejercicio…</p>
          ) : null}
          {errorVersion ? <p className="text-xs text-amber-700">{errorVersion}</p> : null}
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">anio_origen_bolsa</span>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            value={anioOrigenBolsa}
            onChange={(e) => setAnioOrigenBolsa(e.target.value)}
            placeholder="2026"
            className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 outline-none ring-blue-100 focus-visible:ring-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">fecha_desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 outline-none ring-blue-100 focus-visible:ring-2"
          />
        </label>

        <LaoPreviewInfo simulacion={simulacion} error={error} cargando={cargando} />

        {!puedeLlamar ? (
          <p className="text-xs text-slate-500">Ingresá IDs válidos (art_/ver_ ULID), año bolsa y fecha para simular.</p>
        ) : null}

        {puedeLlamar && !claimsLoading && !/^per_/i.test(personaId) ? (
          <p className="text-xs text-amber-700">
            Falta persona_id en el token de sesión (sync de claims). Volvé a iniciar sesión o contactá a soporte.
          </p>
        ) : null}

        <button
          type="button"
          disabled={!enviarHabilitado || cargando || enviando}
          onClick={onEnviar}
          className="min-h-[44px] w-full touch-manipulation rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-emerald-200 focus-visible:ring-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar solicitud
        </button>
      </Card>
    </div>
  );
}
