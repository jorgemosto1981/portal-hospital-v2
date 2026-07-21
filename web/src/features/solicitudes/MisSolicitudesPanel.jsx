import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import MisSolicitudCard from "./MisSolicitudCard.jsx";
import { MIS_SOL_PAGE_SIZE } from "./misSolicitudesUi.js";
import { TICKETERA } from "./ticketeraUi.js";
import { useMisSolicitudesTitular } from "./useMisSolicitudesTitular.js";

/** @typedef {"pendiente" | "autorizada" | "rechazada" | "observada" | "todas"} FiltroBucket */

/**
 * Listado de solicitudes del titular (últimos 3 meses) con filtro y paginación.
 */
export default function MisSolicitudesPanel() {
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();
  const { rows, cargando, error } = useMisSolicitudesTitular(personaId);
  const [filtro, setFiltro] = useState(/** @type {FiltroBucket} */ ("pendiente"));
  const [page, setPage] = useState(0);

  const filtradas = useMemo(() => {
    if (filtro === "todas") return rows;
    return rows.filter((s) => s._bucket === filtro);
  }, [rows, filtro]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / MIS_SOL_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = filtradas.slice(
    pageSafe * MIS_SOL_PAGE_SIZE,
    pageSafe * MIS_SOL_PAGE_SIZE + MIS_SOL_PAGE_SIZE,
  );

  function onChangeFiltro(next) {
    setFiltro(/** @type {FiltroBucket} */ (next));
    setPage(0);
  }

  if (claimsLoading) {
    return <p className={TICKETERA.muted}>Cargando…</p>;
  }

  const emptyMsg =
    filtro === "pendiente"
      ? "No tenés pendientes en los últimos 3 meses."
      : filtro === "autorizada"
        ? "No tenés solicitudes autorizadas en los últimos 3 meses."
        : filtro === "observada"
          ? "No tenés solicitudes observadas en los últimos 3 meses."
          : filtro === "rechazada"
            ? "No tenés rechazos ni cancelaciones en los últimos 3 meses."
            : "Todavía no tenés solicitudes en los últimos 3 meses.";

  return (
    <section className="mt-8 space-y-3" aria-labelledby="mis-solicitudes-titulo">
      <header>
        <h2 id="mis-solicitudes-titulo" className="text-xl font-semibold text-slate-900">
          Mis solicitudes
        </h2>
        <p className={TICKETERA.muted}>
          Seguimiento de los últimos 3 meses (pendiente, autorizada, observada o rechazada).
        </p>
      </header>

      <label className="block space-y-1">
        <span className={TICKETERA.label}>Estado</span>
        <select
          className={TICKETERA.select}
          value={filtro}
          onChange={(e) => onChangeFiltro(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="pendiente">Pendientes</option>
          <option value="autorizada">Autorizadas</option>
          <option value="observada">Observadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="todas">Todas</option>
        </select>
      </label>

      {cargando ? <p className={TICKETERA.muted}>Cargando trámites…</p> : null}
      {error ? <div className={TICKETERA.alertError}>{error}</div> : null}

      {!cargando && !error && filtradas.length === 0 ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className="text-base text-slate-600">{emptyMsg}</p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {pageRows.map((sol) => (
          <MisSolicitudCard key={String(sol.id)} sol={sol} />
        ))}
      </ul>

      {filtradas.length > MIS_SOL_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            className="min-h-11 min-w-[44px] touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <p className="shrink-0 text-sm text-slate-600">
            Página {pageSafe + 1} de {totalPages}
          </p>
          <button
            type="button"
            className="min-h-11 min-w-[44px] touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50"
            disabled={pageSafe >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Siguiente
          </button>
        </div>
      ) : null}

      <Link to="/portal/solicitudes" className={TICKETERA.linkBack}>
        ← Volver al inicio de solicitudes
      </Link>
    </section>
  );
}
