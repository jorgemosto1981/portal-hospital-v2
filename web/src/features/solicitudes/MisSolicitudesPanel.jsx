import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { dbV2 } from "../../services/firebase.js";
import {
  CAMBIO_DIA_TITULO_UI,
  articuloEsCambioDia,
  labelEstadoSolicitudAgente,
  ymdToDdMmYyyy,
} from "./cambioDiaUi.js";
import { TICKETERA } from "./ticketeraUi.js";

/**
 * Listado de solicitudes del titular autenticado (lectura Firestore rules: solo las propias).
 */
export default function MisSolicitudesPanel() {
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();
  const [rows, setRows] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!/^per_/i.test(personaId)) {
      setRows([]);
      setCargando(false);
      return undefined;
    }
    setCargando(true);
    setError("");
    // Sin orderBy server: evita índice compuesto; ordenamos en cliente.
    const q = query(
      collection(dbV2, "solicitudes_articulo"),
      where("titular_persona_id", "==", personaId),
      limit(60),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        list.sort((a, b) => {
          const ta = a.creado_en?.toMillis?.() ?? (Date.parse(String(a.creado_en || "")) || 0);
          const tb = b.creado_en?.toMillis?.() ?? (Date.parse(String(b.creado_en || "")) || 0);
          return tb - ta;
        });
        setRows(list.slice(0, 40));
        setCargando(false);
      },
      (err) => {
        setError(err?.message || "No se pudieron cargar tus solicitudes.");
        setCargando(false);
      },
    );
    return () => unsub();
  }, [personaId]);

  const lista = useMemo(() => rows, [rows]);

  if (claimsLoading) {
    return <p className={TICKETERA.muted}>Cargando…</p>;
  }

  return (
    <section className="mt-8 space-y-3" aria-labelledby="mis-solicitudes-titulo">
      <header>
        <h2 id="mis-solicitudes-titulo" className="text-base font-semibold text-slate-900">
          Mis solicitudes
        </h2>
        <p className={TICKETERA.muted}>
          Seguimiento de estado en el Portal Digital (pendiente, autorizada o rechazada).
        </p>
      </header>

      {cargando ? <p className={TICKETERA.muted}>Cargando trámites…</p> : null}
      {error ? <div className={TICKETERA.alertError}>{error}</div> : null}

      {!cargando && !error && lista.length === 0 ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className="text-sm text-slate-600">Todavía no tenés solicitudes registradas.</p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {lista.map((sol) => {
          const esCambio = articuloEsCambioDia(sol) || sol.es_cambio_dia === true;
          const titulo = esCambio
            ? CAMBIO_DIA_TITULO_UI
            : String(sol.codigo_grilla || sol.articulo_id || "Solicitud").trim();
          const fo = ymdToDdMmYyyy(sol.fecha_origen || sol.fecha_desde);
          const fd = ymdToDdMmYyyy(sol.fecha_destino);
          const estado = labelEstadoSolicitudAgente(sol.estado_solicitud_id);
          const gdt = String(sol.grupo_trabajo_id_ancla || "").trim();
          return (
            <li key={String(sol.id)} className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{titulo}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">{String(sol.id)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                  {estado}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                {esCambio && fo && fd
                  ? `Ausencia ${fo} → prestación ${fd}`
                  : fo
                    ? `Desde ${fo}`
                    : "—"}
              </p>
              {gdt ? <p className={`${TICKETERA.muted} mt-1`}>Grupo: {gdt}</p> : null}
              {esCambio && sol.motivo ? (
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">{String(sol.motivo)}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Link to="/portal/solicitudes" className={TICKETERA.linkBack}>
        ← Volver al inicio de solicitudes
      </Link>
    </section>
  );
}
