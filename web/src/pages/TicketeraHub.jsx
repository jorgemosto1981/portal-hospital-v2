import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { LAO_ARTICULO_ID } from "../constants/laoArticulo.js";
import { TICKETERA } from "../features/solicitudes/ticketeraUi.js";
import { callListarArticulosIngresoAgente } from "../services/callables.js";
import { ymdHoyBa } from "../features/solicitudes/ticketeraUtils.js";

/** @param {Record<string, unknown>} a */
function etiquetaCortaArticulo(a) {
  const cod = String(a?.codigo_grilla || "").trim() || "Artículo";
  const nom = String(a?.nombre || "").trim();
  return { cod, nom };
}

export default function TicketeraHub() {
  const nav = useNavigate();
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();

  const [cargando, setCargando] = useState(false);
  const [articulos, setArticulos] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [motivoVacio, setMotivoVacio] = useState("");
  const [errorListado, setErrorListado] = useState("");

  const recargar = useCallback(async () => {
    if (!/^per_/i.test(personaId)) {
      setArticulos([]);
      setMotivoVacio("");
      setErrorListado("");
      return;
    }
    const fechaRef = ymdHoyBa();
    setCargando(true);
    setMotivoVacio("");
    setErrorListado("");
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: fechaRef });
      const list = res?.data?.articulos || [];
      setArticulos(Array.isArray(list) ? list : []);
      if (list.length === 0) {
        const ev = res?.data?.elegibilidad_vacia;
        const msg = Array.isArray(ev?.mensajes) ? String(ev.mensajes[0] || "").trim() : "";
        setMotivoVacio(msg);
      }
    } catch (e) {
      setArticulos([]);
      setMotivoVacio("");
      setErrorListado(e?.message || "No se pudo consultar artículos (revisá sesión o red).");
    } finally {
      setCargando(false);
    }
  }, [personaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  function irLaoWizard(articuloId = LAO_ARTICULO_ID) {
    const id = String(articuloId || LAO_ARTICULO_ID).trim();
    if (!/^art_/i.test(id)) return;
    const fechaRef = ymdHoyBa();
    const q = new URLSearchParams({
      fecha: fechaRef,
      articulo_id: id,
    });
    nav(`/portal/solicitudes/lao?${q.toString()}`);
  }

  function irArticulo(articuloId) {
    const id = String(articuloId || "").trim();
    if (!/^art_/i.test(id)) return;
    if (id === LAO_ARTICULO_ID) {
      irLaoWizard(id);
      return;
    }
    nav(`/portal/solicitudes/alta?articulo=${encodeURIComponent(id)}`);
  }

  return (
    <div className="space-y-3">
      {!claimsLoading && !/^per_/i.test(personaId) ? (
        <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
      ) : null}

      {cargando ? <p className={TICKETERA.muted}>Cargando licencias disponibles…</p> : null}
      {errorListado ? <p className="text-sm text-red-700">{errorListado}</p> : null}

      {!cargando && articulos.length === 0 && !errorListado ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className="text-sm text-slate-600">
            {motivoVacio ||
              "No hay artículos disponibles por ahora. La fecha del permiso la indicás al iniciar cada trámite."}
          </p>
        </div>
      ) : null}

      {!cargando
        ? articulos.map((a) => {
            const id = String(a.articulo_id || "");
            const { cod, nom } = etiquetaCortaArticulo(a);
            return (
              <button
                key={id}
                type="button"
                onClick={() => irArticulo(id)}
                className={`${TICKETERA.btnTileBase} ${TICKETERA.btnTilePatron}`}
              >
                <span className={TICKETERA.codigoPatron}>{cod}</span>
                {nom ? (
                  <span className={`${TICKETERA.nombreTile} font-medium uppercase tracking-wide`}>{nom}</span>
                ) : null}
              </button>
            );
          })
        : null}

      <button
        type="button"
        onClick={() => irLaoWizard(LAO_ARTICULO_ID)}
        className={`${TICKETERA.btnTileBase} ${TICKETERA.btnTileLao}`}
      >
        <span className={TICKETERA.codigoLao}>LAO</span>
        <span className={`${TICKETERA.nombreTile} text-emerald-900/80`}>
          Licencia anual ordinaria · bolsa y trámite guiado
        </span>
      </button>
    </div>
  );
}
