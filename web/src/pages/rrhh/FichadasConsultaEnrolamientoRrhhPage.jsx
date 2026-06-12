import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import { callListarEnrolamientoRelojPorPersona } from "../../services/callables.js";
import { laboralCallableErrorMessage } from "../datos-laborales/callableErrorMessage.js";

export default function FichadasConsultaEnrolamientoRrhhPage() {
  const [personaIdInput, setPersonaIdInput] = useState("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [items, setItems] = useState([]);
  const [personaConsultada, setPersonaConsultada] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscoAlMenosUnaVez, setBuscoAlMenosUnaVez] = useState(false);

  const buscar = useCallback(async () => {
    const q = personaIdInput.trim();
    if (!q) {
      toast.error("Ingresá DNI o persona_id (per_*).");
      return;
    }
    setBuscando(true);
    setBuscoAlMenosUnaVez(true);
    try {
      const res = await callListarEnrolamientoRelojPorPersona({
        persona_id: q,
        incluir_inactivos: incluirInactivos,
      });
      const data = res.data || {};
      setPersonaConsultada(data.persona_id || q);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setPersonaConsultada("");
      toast.error(laboralCallableErrorMessage(e, "Error al consultar enrolamientos."), { duration: 8000 });
    } finally {
      setBuscando(false);
    }
  }, [personaIdInput, incluirInactivos]);

  const onSubmit = (e) => {
    e.preventDefault();
    buscar();
  };

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-24 md:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Enrolamientos cargados</h1>
        <p className="text-sm text-slate-500">
          Consulta por <span className="font-mono text-xs">persona_id</span> · sin precarga del catálogo.{" "}
          <Link to="/portal/rrhh/fichadas-enrolamiento" className="text-blue-600 hover:underline">
            Alta / edición
          </Link>
        </p>
      </header>

      <Card className="space-y-3 p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
          <label className="block flex-1 text-sm font-medium text-slate-700">
            persona_id
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              placeholder="DNI o per_…"
              value={personaIdInput}
              onChange={(e) => setPersonaIdInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={buscando}
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </form>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
          />
          Incluir enrolamientos inactivos
        </label>
      </Card>

      {buscoAlMenosUnaVez && !buscando && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            {items.length === 0 ? (
              <span>
                Sin enrolamientos activos para{" "}
                <span className="font-mono text-slate-800">{personaConsultada || personaIdInput.trim()}</span>.
              </span>
            ) : (
              <span>
                <strong>{items.length}</strong> registro{items.length === 1 ? "" : "s"} para{" "}
                <span className="font-mono text-slate-800">{personaConsultada}</span>
              </span>
            )}
          </div>
          {items.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {items.map((row) => (
                <li key={row.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="font-medium text-slate-900">{row.reloj_nombre}</div>
                  <div className="grid gap-1 text-slate-600 sm:grid-cols-2">
                    <span>
                      Reloj: <span className="font-mono text-xs text-slate-800">{row.reloj_id}</span>
                    </span>
                    <span>
                      Tarjeta: <span className="font-mono text-xs text-slate-800">{row.numero_tarjeta}</span>
                    </span>
                    <span>
                      Grupo:{" "}
                      <span className="font-mono text-xs text-slate-800">
                        {row.grupo_trabajo_id || (row.multi_cargo_universal ? "Universal (multi-cargo)" : "—")}
                      </span>
                    </span>
                    <span>
                      Estado:{" "}
                      <span className={row.activo ? "text-emerald-700" : "text-amber-700"}>
                        {row.activo ? "Activo" : "Inactivo"}
                      </span>
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">{row.id}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
