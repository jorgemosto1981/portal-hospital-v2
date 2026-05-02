import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { obtenerLegajoCompleto } from "../services/legajoService.js";
import { clearLastPersonaIdForDemo } from "../utils/legajoStorage.js";

const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** @param {unknown} ts */
function formatearVigenteDesde(ts) {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    try {
      return fmtFecha.format(ts.toDate());
    } catch {
      return "—";
    }
  }
  return "—";
}

/** @param {Record<string, unknown> | undefined} contacto */
function contactoEstaVacio(contacto) {
  if (!contacto || typeof contacto !== "object") return true;
  return !Object.values(contacto).some((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "boolean") return true;
    if (typeof v === "number") return !Number.isNaN(v);
    return true;
  });
}

function PerfilSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando legajo">
      <div className="h-10 w-2/3 max-w-md rounded-xl bg-slate-200" />
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="h-40 rounded-2xl bg-slate-200" />
    </div>
  );
}

export default function Perfil() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState(
    /** @type {"idle" | "loading" | "ok" | "notfound" | "error"} */ ("idle"),
  );
  const [legajo, setLegajo] = useState(/** @type {Record<string, unknown> & { id?: string }} | null */ (null));
  const [cargos, setCargos] = useState(/** @type {Array<Record<string, unknown> & { id: string }>} */ ([]));
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    let cancelado = false;
    const id = String(personaId ?? "").trim();

    if (!id.startsWith("per_")) {
      setEstado("notfound");
      return;
    }

    setEstado("loading");
    setMensajeError("");

    obtenerLegajoCompleto(id).then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        if (res.code === "NOT_FOUND") {
          setEstado("notfound");
        } else {
          setEstado("error");
          setMensajeError(res.message ?? "No se pudo cargar el legajo.");
        }
        return;
      }
      setLegajo(res.legajo);
      setCargos(res.cargos);
      setEstado("ok");
    });

    return () => {
      cancelado = true;
    };
  }, [personaId]);

  if (estado === "loading" || estado === "idle") {
    return <PerfilSkeleton />;
  }

  if (estado === "notfound") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Legajo no encontrado</h1>
        <p className="mt-2 text-sm text-slate-500">
          No existe un documento en <code className="text-xs">personas</code> con este ID, o el enlace es
          inválido.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/portal/home"
            className="inline-flex justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Volver al inicio
          </Link>
          <button
            type="button"
            className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => {
              clearLastPersonaIdForDemo();
              navigate("/portal/perfil", { replace: true });
            }}
          >
            Ingresar otro ID
          </button>
        </div>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Error al cargar</h1>
        <p className="mt-2 text-sm text-slate-600">{mensajeError}</p>
        <p className="mt-2 text-xs text-slate-400">
          Si la consola indica índice faltante, creá el índice compuesto sugerido para{" "}
          <code>historial_laboral_cargos</code> (<code>persona_id</code> + <code>activo</code>).
        </p>
        <Link
          to="/portal/home"
          className="mt-6 inline-flex justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const identidad = legajo?.identidad ?? {};
  const nombre = String(identidad.nombre ?? "").trim();
  const apellido = String(identidad.apellido ?? "").trim();
  const dni = String(identidad.dni ?? "").trim();
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ") || "Sin nombre registrado";
  const meta = legajo?.metadata ?? {};
  const activoLegajo = meta.activo !== false;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Legajo digital</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{nombreCompleto}</h1>
            <p className="mt-1 text-sm text-slate-500">
              DNI {dni || "—"} · <span className="font-mono text-xs text-slate-400">{legajo?.id}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                activoLegajo ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {activoLegajo ? "Activo" : "Inactivo"}
            </span>
            <button
              type="button"
              onClick={() => {
                clearLastPersonaIdForDemo();
                navigate("/portal/perfil", { replace: true });
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Otro legajo
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Identidad</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Nombre</dt>
            <dd className="font-medium text-slate-900">{nombre || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Apellido</dt>
            <dd className="font-medium text-slate-900">{apellido || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">DNI</dt>
            <dd className="font-medium text-slate-900">{dni || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Contacto</h2>
        {contactoEstaVacio(legajo?.contacto) ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-400">
            Información de contacto no registrada
          </p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(legajo?.contacto ?? {}).map(([clave, valor]) => (
              <div key={clave}>
                <dt className="capitalize text-slate-500">{clave.replace(/_/g, " ")}</dt>
                <dd className="font-medium text-slate-900">{String(valor ?? "—")}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Situación laboral</h2>
        <p className="mt-1 text-xs text-slate-500">Cargos activos (1:N) en historial_laboral_cargos</p>

        {cargos.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
            No posee cargos activos
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {cargos.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 md:flex md:items-center md:justify-between md:gap-4"
              >
                <div>
                  <p className="font-mono text-xs text-slate-600">{c.grupo_de_trabajo_id ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Desde <span className="font-medium text-slate-700">{formatearVigenteDesde(c.vigente_desde)}</span>
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{c.id}</p>
                </div>
                <span className="mt-2 inline-flex shrink-0 self-start rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 md:mt-0">
                  Cargo activo
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
