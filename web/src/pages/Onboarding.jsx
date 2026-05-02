import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuthSession } from "../features/auth/useAuthSession.js";
import { callListarCatalogoOnboarding, callListarColeccionPublicaTemporal } from "../services/callables.js";
import { crearLegajoInicial } from "../services/onboardingService.js";
import { setLastPersonaIdForDemo } from "../utils/legajoStorage.js";

function normalizarDniInput(value) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [grupoDeTrabajoId, setGrupoDeTrabajoId] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [gruposEstado, setGruposEstado] = useState({ status: "loading", message: "Cargando grupos de trabajo…" });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setGruposEstado({ status: "loading", message: "Cargando grupos de trabajo…" });
      try {
        const run = user
          ? () => callListarCatalogoOnboarding({ collectionName: "grupos_de_trabajo" })
          : () => callListarColeccionPublicaTemporal({ collectionName: "grupos_de_trabajo", pageSize: 200 });
        const { data } = await run();
        if (cancel) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setGrupos(items);
        if (items.length === 0) {
          setGruposEstado({
            status: "idle",
            message:
              "No hay grupos de trabajo en el catálogo. Cargá catálogos (RRHH) o comprobá permisos y despliegue de Cloud Functions.",
          });
        } else {
          setGruposEstado({ status: "success", message: "" });
        }
      } catch (e) {
        if (cancel) return;
        setGrupos([]);
        setGruposEstado({
          status: "error",
          message: e?.message || "No se pudieron cargar los grupos de trabajo desde el servidor.",
        });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  useEffect(() => {
    if (!grupos.length) return;
    const ids = new Set(grupos.map((g) => g.id));
    if (!grupoDeTrabajoId || !ids.has(grupoDeTrabajoId)) {
      const first = grupos[0];
      if (first?.id) setGrupoDeTrabajoId(first.id);
    }
  }, [grupos, grupoDeTrabajoId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    const resultado = await crearLegajoInicial({
      nombre,
      apellido,
      dni,
      grupo_de_trabajo_id: grupoDeTrabajoId,
    });
    setEnviando(false);

    if (!resultado.ok) {
      toast.error(resultado.message);
      return;
    }

    setLastPersonaIdForDemo(resultado.personaId);
    toast.success(`Legajo creado: ${resultado.personaId}`);
    navigate("/", { replace: true });
  }

  const gruposCargando = gruposEstado.status === "loading";
  const sinGrupos = !gruposCargando && grupos.length === 0;

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alta de legajo</h1>
            <p className="mt-1 text-sm text-slate-500">Fase B — datos iniciales y primer cargo</p>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Volver
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="onb-nombre" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                id="onb-nombre"
                name="nombre"
                type="text"
                autoComplete="given-name"
                value={nombre}
                onChange={(ev) => setNombre(ev.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base text-slate-900 outline-none transition-shadow focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                placeholder="Ej.: Ana"
                required
              />
            </div>

            <div>
              <label htmlFor="onb-apellido" className="mb-1.5 block text-sm font-medium text-slate-700">
                Apellido
              </label>
              <input
                id="onb-apellido"
                name="apellido"
                type="text"
                autoComplete="family-name"
                value={apellido}
                onChange={(ev) => setApellido(ev.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base text-slate-900 outline-none transition-shadow focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                placeholder="Ej.: Pérez"
                required
              />
            </div>

            <div>
              <label htmlFor="onb-dni" className="mb-1.5 block text-sm font-medium text-slate-700">
                DNI
              </label>
              <input
                id="onb-dni"
                name="dni"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={dni}
                onChange={(ev) => setDni(normalizarDniInput(ev.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base text-slate-900 outline-none transition-shadow focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                placeholder="Sin puntos"
                minLength={7}
                maxLength={8}
                required
              />
            </div>

            <div>
              <label htmlFor="onb-grupo" className="mb-1.5 block text-sm font-medium text-slate-700">
                Grupo de trabajo
              </label>
              {gruposEstado.status === "error" ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {gruposEstado.message}
                </p>
              ) : null}
              {gruposEstado.status === "idle" && gruposEstado.message && grupos.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {gruposEstado.message}
                </p>
              ) : null}
              <select
                id="onb-grupo"
                name="grupo_de_trabajo_id"
                value={grupoDeTrabajoId}
                onChange={(ev) => setGrupoDeTrabajoId(ev.target.value)}
                disabled={gruposCargando || sinGrupos}
                className="mt-2 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition-shadow focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"
                required={!sinGrupos}
              >
                {gruposCargando ? (
                  <option value="">Cargando…</option>
                ) : (
                  grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {typeof g.nombre === "string" && g.nombre.trim() ? g.nombre : g.id}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Al confirmar se crean dos documentos en Firestore (`personas` y `historial_laboral_cargos`) en un mismo
            batch. Deben existir reglas y permisos acordes para tu usuario.
          </p>

          <button
            type="submit"
            disabled={enviando || gruposCargando || sinGrupos}
            className="mt-6 w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Guardando…" : gruposCargando ? "Cargando grupos…" : "Crear legajo"}
          </button>
        </form>
      </div>
    </div>
  );
}
