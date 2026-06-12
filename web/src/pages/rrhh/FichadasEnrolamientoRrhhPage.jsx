import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import { useRelojBiometricoCatalogo } from "../../features/fichadas/useRelojBiometricoCatalogo.js";
import {
  callBuscarPersonasCheckinRrhh,
  callGuardarEnrolamientoRelojPersona,
} from "../../services/callables.js";

export default function FichadasEnrolamientoRrhhPage() {
  const [params] = useSearchParams();
  const { relojes } = useRelojBiometricoCatalogo();

  const relojIdInicial = params.get("reloj_id") || "";
  const tarjetaInicial = params.get("numero_tarjeta") || "";

  const [relojId, setRelojId] = useState(relojIdInicial);
  const [numeroTarjeta, setNumeroTarjeta] = useState(tarjetaInicial);
  const [busqueda, setBusqueda] = useState("");
  const [personas, setPersonas] = useState([]);
  const [personaId, setPersonaId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const relojSel = useMemo(
    () => relojes.find((r) => String(r.id) === relojId) || null,
    [relojes, relojId],
  );
  const grupoId = String(relojSel?.grupo_trabajo_id || relojSel?.grupo_id || "").trim();

  const buscarPersonas = useCallback(async () => {
    const q = busqueda.trim();
    if (q.length < 2) {
      toast.error("Ingresá al menos 2 caracteres (DNI o nombre).");
      return;
    }
    setBuscando(true);
    try {
      const res = await callBuscarPersonasCheckinRrhh({ consulta: q, limite: 20 });
      setPersonas(res.data?.items || []);
    } catch (e) {
      toast.error(e?.message || "Error al buscar personas.");
    } finally {
      setBuscando(false);
    }
  }, [busqueda]);

  const guardar = useCallback(async () => {
    if (!relojId || !numeroTarjeta.trim() || !personaId || !grupoId) {
      toast.error("Completá reloj, tarjeta, persona y grupo del reloj.");
      return;
    }
    setGuardando(true);
    try {
      const res = await callGuardarEnrolamientoRelojPersona({
        reloj_id: relojId,
        numero_tarjeta: numeroTarjeta.trim(),
        persona_id: personaId,
        grupo_trabajo_id: grupoId,
      });
      const rec = res.data?.reconciliacion;
      toast.success(
        rec
          ? `Enrolamiento guardado · ${rec.fmh_resueltas ?? 0} huérfanas reconciliadas · ${rec.vis_actualizados ?? 0} vis`
          : "Enrolamiento guardado.",
        { duration: 6000 },
      );
    } catch (e) {
      toast.error(e?.message || "Error al guardar enrolamiento.");
    } finally {
      setGuardando(false);
    }
  }, [relojId, numeroTarjeta, personaId, grupoId]);

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-24 md:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Enrolar tarjeta ↔ persona</h1>
        <p className="text-sm text-slate-500">
          Tras guardar se ejecuta reconciliación automática.{" "}
          <Link to="/portal/rrhh/fichadas-huerfanas" className="text-blue-600 hover:underline">
            Volver a huérfanas
          </Link>
        </p>
      </header>

      <Card className="space-y-4 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Reloj
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={relojId}
            onChange={(e) => setRelojId(e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {relojes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre || r.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Número de tarjeta
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
            value={numeroTarjeta}
            onChange={(e) => setNumeroTarjeta(e.target.value)}
          />
        </label>
        <p className="text-xs text-slate-500">
          Grupo trabajo (desde cfg reloj): <span className="font-mono">{grupoId || "—"}</span>
        </p>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Buscar persona (DNI / nombre)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={buscarPersonas}
            disabled={buscando}
          >
            {buscando ? "…" : "Buscar"}
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Persona
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {personas.map((p) => (
              <option key={p.persona_id || p.id} value={p.persona_id || p.id}>
                {[p.apellido, p.nombre].filter(Boolean).join(", ") || p.persona_id} · {p.dni || ""}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:w-auto sm:px-6"
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? "Guardando…" : "Guardar enrolamiento"}
        </button>
      </Card>
    </div>
  );
}
