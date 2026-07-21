import { useCallback, useMemo, useState } from "react";

import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import FormAlta770Rrhh from "../features/solicitudes/FormAlta770Rrhh.jsx";
import {
  ETIQUETA_ROL_NUEVA_SOLICITUD,
  rolPermiteTitularAjeno,
} from "../features/solicitudes/nuevaSolicitudPorRol.js";
import { TICKETERA } from "../features/solicitudes/ticketeraUi.js";
import { useNuevaSolicitudPorRol } from "../features/solicitudes/useNuevaSolicitudPorRol.js";
import { callBuscarPersonasNuevaSolicitudPorRol } from "../services/callables.js";

/**
 * Hub de artículos según `circuito_ingreso_ids` del rol actor.
 * @param {{ rolId: string }} props
 */
export default function NuevaSolicitudPorRolPage({ rolId }) {
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const actorPersonaId = String(claims?.persona_id || "").trim();
  const permiteAjeno = rolPermiteTitularAjeno(rolId);
  const etiquetaRol = ETIQUETA_ROL_NUEVA_SOLICITUD[rolId] || rolId;

  const [modoTitular, setModoTitular] = useState(/** @type {"propia"|"ajena"} */ ("propia"));
  const [titularAjeno, setTitularAjeno] = useState(
    /** @type {{ id: string, nombre: string, apellido: string, dni: string } | null} */ (null),
  );
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [form770Abierto, setForm770Abierto] = useState(false);

  const titularPersonaId = useMemo(() => {
    if (modoTitular === "ajena" && titularAjeno?.id) return String(titularAjeno.id).trim();
    return actorPersonaId;
  }, [modoTitular, titularAjeno, actorPersonaId]);

  const titularLabel = useMemo(() => {
    if (modoTitular === "ajena" && titularAjeno) {
      const nom = `${String(titularAjeno.apellido || "").trim()} ${String(titularAjeno.nombre || "").trim()}`.trim();
      const dni = String(titularAjeno.dni || "").trim();
      return [nom || titularAjeno.id, dni ? `DNI ${dni}` : ""].filter(Boolean).join(" · ");
    }
    return "vos (sesión actual)";
  }, [modoTitular, titularAjeno]);

  const listadoListo =
    !claimsLoading &&
    /^per_/i.test(titularPersonaId) &&
    (modoTitular === "propia" || Boolean(titularAjeno?.id));

  const { cargando, articulos, error, recargar } = useNuevaSolicitudPorRol({
    rolId,
    titularPersonaId,
    enabled: listadoListo,
  });

  const buscar = useCallback(async () => {
    const q = busqueda.trim();
    if (q.length < 2) {
      setErrorBusqueda("Ingresá al menos 2 caracteres (DNI o nombre).");
      return;
    }
    setBuscando(true);
    setErrorBusqueda("");
    try {
      const res = await callBuscarPersonasNuevaSolicitudPorRol({
        rol_id: rolId,
        query: q,
        limit: 20,
      });
      setResultados(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setResultados([]);
      setErrorBusqueda(e?.message || "No se pudo buscar personas.");
    } finally {
      setBuscando(false);
    }
  }, [busqueda, rolId]);

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nueva solicitud</p>
        <h1 className="text-xl font-semibold text-slate-900">Artículos · {etiquetaRol}</h1>
        <p className={TICKETERA.muted}>
          Se listan artículos cuya versión publicada habilita este rol en el circuito de ingreso.
        </p>
      </header>

      {!claimsLoading && !/^per_/i.test(actorPersonaId) ? (
        <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada.</p>
      ) : null}

      {permiteAjeno ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className={TICKETERA.label}>Titular de la solicitud</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={[
                "min-h-11 touch-manipulation rounded-xl border px-3 text-sm font-medium",
                modoTitular === "propia"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-700",
              ].join(" ")}
              onClick={() => {
                setModoTitular("propia");
                setTitularAjeno(null);
                setResultados([]);
                setForm770Abierto(false);
              }}
            >
              Para mí
            </button>
            <button
              type="button"
              className={[
                "min-h-11 touch-manipulation rounded-xl border px-3 text-sm font-medium",
                modoTitular === "ajena"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-700",
              ].join(" ")}
              onClick={() => {
                setModoTitular("ajena");
                setForm770Abierto(false);
              }}
            >
              Otro agente
            </button>
          </div>

          {modoTitular === "ajena" ? (
            <div className="space-y-2 pt-1">
              {titularAjeno ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">
                  <p className="font-medium">
                    {String(titularAjeno.apellido || "").trim()} {String(titularAjeno.nombre || "").trim()}
                  </p>
                  <p className="text-xs text-emerald-800/80">DNI {titularAjeno.dni || "—"}</p>
                  <button
                    type="button"
                    className="mt-2 min-h-10 text-sm font-medium text-sky-700 touch-manipulation"
                    onClick={() => {
                      setTitularAjeno(null);
                      setResultados([]);
                      setForm770Abierto(false);
                    }}
                  >
                    Cambiar agente
                  </button>
                </div>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className={TICKETERA.label}>Buscar por DNI o nombre</span>
                    <input
                      className={TICKETERA.input}
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      inputMode="search"
                      autoComplete="off"
                      placeholder="Ej. 28914247"
                    />
                  </label>
                  <button
                    type="button"
                    className={TICKETERA.btnSecondary}
                    disabled={buscando}
                    onClick={buscar}
                  >
                    {buscando ? "Buscando…" : "Buscar"}
                  </button>
                  {errorBusqueda ? <p className="text-sm text-red-700">{errorBusqueda}</p> : null}
                  <ul className="space-y-1">
                    {resultados.map((p) => (
                      <li key={String(p.id)}>
                        <button
                          type="button"
                          className="flex min-h-11 w-full touch-manipulation items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm active:bg-slate-50"
                          onClick={() => {
                            setTitularAjeno({
                              id: String(p.id || ""),
                              nombre: String(p.nombre || ""),
                              apellido: String(p.apellido || ""),
                              dni: String(p.dni || ""),
                            });
                            setResultados([]);
                            setBusqueda("");
                          }}
                        >
                          <span>
                            {String(p.apellido || "").trim()} {String(p.nombre || "").trim()}
                          </span>
                          <span className="text-xs text-slate-500">{String(p.dni || "")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {modoTitular === "ajena" && !titularAjeno ? (
        <p className={TICKETERA.muted}>Elegí un agente para ver los artículos aplicables.</p>
      ) : null}

      {form770Abierto && listadoListo ? (
        <FormAlta770Rrhh
          titularPersonaId={titularPersonaId}
          titularLabel={titularLabel}
          onCancel={() => setForm770Abierto(false)}
          onOk={() => {
            setForm770Abierto(false);
            recargar();
          }}
        />
      ) : null}

      {cargando ? <p className={TICKETERA.muted}>Cargando artículos del rol…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!cargando && listadoListo && articulos.length === 0 && !error ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className="text-sm text-slate-600">
            No hay artículos publicados con este rol en el circuito de ingreso.
          </p>
        </div>
      ) : null}

      {!cargando && !form770Abierto
        ? articulos.map((a) => {
            const pendiente = a.alta_disponible !== true;
            const noElegible = a.elegible_titular !== true;
            const clickable = a.alta_disponible === true;
            const Tag = clickable ? "button" : "div";
            return (
              <Tag
                key={String(a.articulo_id)}
                type={clickable ? "button" : undefined}
                className={`${TICKETERA.btnTileBase} ${TICKETERA.btnTilePatron} ${
                  clickable ? "cursor-pointer text-left" : "cursor-default"
                }`}
                onClick={
                  clickable
                    ? () => {
                        setForm770Abierto(true);
                      }
                    : undefined
                }
              >
                <span className={TICKETERA.codigoPatron}>{String(a.codigo_grilla)}</span>
                {a.nombre ? (
                  <span className={`${TICKETERA.nombreTile} font-medium uppercase tracking-wide`}>
                    {String(a.nombre)}
                  </span>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pendiente ? (
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">
                      Alta pendiente
                    </span>
                  ) : (
                    <span className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-900 ring-1 ring-sky-200">
                      Alta disponible
                    </span>
                  )}
                  {noElegible ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                      Titular no elegible
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-200">
                      Titular elegible
                    </span>
                  )}
                </div>
                {noElegible && Array.isArray(a.elegibilidad_mensajes) && a.elegibilidad_mensajes[0] ? (
                  <p className="mt-1 text-xs text-slate-500">{String(a.elegibilidad_mensajes[0])}</p>
                ) : null}
              </Tag>
            );
          })
        : null}
    </div>
  );
}
