import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import {
  clearLastPersonaIdForDemo,
  getLastPersonaIdForDemo,
} from "../utils/legajoStorage.js";

/**
 * Punto de entrada `/perfil`: redirige al último `per_*` guardado tras onboarding,
 * o permite ingresar un ID manualmente.
 */
export default function PerfilEntrada() {
  const navigate = useNavigate();
  const lastId = useMemo(() => getLastPersonaIdForDemo(), []);
  const [manualId, setManualId] = useState("");

  if (lastId.startsWith("per_")) {
    return <Navigate to={`/perfil/${lastId}`} replace />;
  }

  function handleVerLegajo(e) {
    e.preventDefault();
    const id = manualId.trim();
    if (!id.startsWith("per_")) {
      return;
    }
    navigate(`/perfil/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Perfil del agente</h1>
      <p className="mt-2 text-sm text-slate-500">
        No hay un legajo reciente en este navegador. Ingresá un <code className="text-xs">persona_id</code>{" "}
        (formato <code className="text-xs">per_…</code>) o completá el{" "}
        <Link to="/onboarding" className="font-medium text-blue-600 hover:underline">
          alta de legajo
        </Link>
        .
      </p>

      <form
        onSubmit={handleVerLegajo}
        className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      >
        <label htmlFor="perfil-id-manual" className="mb-1.5 block text-sm font-medium text-slate-700">
          ID de persona
        </label>
        <input
          id="perfil-id-manual"
          value={manualId}
          onChange={(ev) => setManualId(ev.target.value.trim())}
          placeholder="per_01JQ…"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Ver legajo
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-400">
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={() => {
            clearLastPersonaIdForDemo();
          }}
        >
          Limpiar ID guardado
        </button>{" "}
        (si quedó uno obsoleto en este dispositivo)
      </p>
    </div>
  );
}
