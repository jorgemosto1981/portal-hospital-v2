import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callListarContextoPlanGrupo } from "../../services/callables.js";
import {
  consultarAvisosCoberturaYy,
  listarTiposCompensacionCobertura,
  obtenerCapaTeoricaDiaValidada,
} from "../../services/coberturaParcialService.js";
import {
  enrichCapaTeoricaLabels,
  filtrarSegmentosActivosTitular,
  turnosDisponiblesDesdeRegimen,
} from "./enrichCapaTeoricaLabels.js";

/**
 * Modal cobertura parcial — pasos: tramos, agente YY, compensación + motivo.
 */
export default function ModalCoberturaParcial({
  personaOrigenId,
  personaOrigenLabel,
  fechaYmd,
  grupoId,
  periodo,
  onCerrar,
  onRegistrado,
  onDesactualizado,
  onAgregarOutbox,
}) {
  const [cargando, setCargando] = useState(true);
  const [operando, setOperando] = useState(false);
  const [error, setError] = useState("");
  const [segmentos, setSegmentos] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [expectedVersionToken, setExpectedVersionToken] = useState("");
  const [tiposTcc, setTiposTcc] = useState([]);
  const [tipoTccId, setTipoTccId] = useState("");
  const [personasGrupo, setPersonasGrupo] = useState([]);
  const [personaCoberturaId, setPersonaCoberturaId] = useState("");
  const [busquedaYy, setBusquedaYy] = useState("");
  const [avisosYy, setAvisosYy] = useState([]);
  const [motivo, setMotivo] = useState("");
  const [periodoCerrado, setPeriodoCerrado] = useState(false);
  const abrirAyuda = (termino) => {
    window.dispatchEvent(new CustomEvent("portal-help-open", { detail: { termino } }));
  };

  const [anio, mes] = useMemo(() => {
    const [y, m] = String(periodo || fechaYmd.slice(0, 7)).split("-").map(Number);
    return [y, m];
  }, [periodo, fechaYmd]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [capaRes, tcc, ctx] = await Promise.all([
        obtenerCapaTeoricaDiaValidada(personaOrigenId, fechaYmd),
        listarTiposCompensacionCobertura(),
        grupoId ? callListarContextoPlanGrupo({ grupo_id: grupoId, periodo: `${anio}-${String(mes).padStart(2, "0")}` }) : Promise.resolve(null),
      ]);
      setExpectedVersionToken(capaRes.concurrencia?.expected_version_token || capaRes.concurrencia?.vis_ultima_sync || "");
      setPeriodoCerrado(capaRes.periodo_liquidacion?.cerrado === true);
      const regimenes = ctx?.data?.regimenes || {};
      const hlg = (ctx?.data?.personas_grupo || []).find((p) => p.persona_id === personaOrigenId);
      const turnosMap = turnosDisponiblesDesdeRegimen(regimenes, hlg?.regimen_horario_id);
      const activos = filtrarSegmentosActivosTitular(capaRes.capa_teorica?.segmentos || [], personaOrigenId);
      const segs = enrichCapaTeoricaLabels(activos, turnosMap);
      setSegmentos(segs);
      setSeleccionados(new Set());
      setTiposTcc(tcc);
      if (tcc[0]) setTipoTccId(tcc[0].id);
      const personas = (ctx?.data?.personas_grupo || []).filter((p) => p.persona_id !== personaOrigenId);
      setPersonasGrupo(personas);
    } catch (e) {
      setError(e?.message || "No se pudo cargar la capa teórica del día.");
    } finally {
      setCargando(false);
    }
  }, [personaOrigenId, fechaYmd, grupoId, anio, mes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!personaCoberturaId) {
      setAvisosYy([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const avisos = await consultarAvisosCoberturaYy(personaCoberturaId, fechaYmd, anio, mes);
        if (!cancelled) setAvisosYy(avisos);
      } catch {
        if (!cancelled) setAvisosYy([]);
      }
    })();
    return () => { cancelled = true; };
  }, [personaCoberturaId, fechaYmd, anio, mes]);

  const personasFiltradas = useMemo(() => {
    const q = busquedaYy.trim().toLowerCase();
    if (!q) return personasGrupo.slice(0, 12);
    return personasGrupo
      .filter((p) => {
        const label = `${p.persona_label || ""} ${p.persona_id || ""} ${p.persona_dni || ""}`.toLowerCase();
        return label.includes(q);
      })
      .slice(0, 12);
  }, [personasGrupo, busquedaYy]);

  const toggleSegmento = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (seleccionados.size < 1) {
      setError("Seleccioná al menos un tramo a cubrir.");
      return;
    }
    if (!personaCoberturaId) {
      setError("Elegí el agente de cobertura (YY).");
      return;
    }
    if (!tipoTccId) {
      setError("Elegí el tipo de compensación.");
      return;
    }
    if (motivo.trim().length < 3) {
      setError("Motivo obligatorio (mín. 3 caracteres).");
      return;
    }
    setOperando(true);
    setError("");
    try {
      if (!onAgregarOutbox) {
        setError("Outbox no inicializado en esta vista.");
        return;
      }
      onAgregarOutbox({
        tipo: "cobertura_parcial",
        personaOrigenId,
        fechaYmd,
        personaCoberturaId,
        segmentosCubiertos: [...seleccionados],
        tipoCompensacionId: tipoTccId,
        motivo: motivo.trim(),
        expectedVersionToken,
      });
      toast.success("Cobertura agregada a cambios pendientes.");
      if (onRegistrado) onRegistrado();
      onCerrar();
    } catch (e) {
      const msg = e?.message || "Error al registrar cobertura.";
      if (msg.includes("ASI-CONC")) {
        setError(msg);
        toast.error("La grilla cambió. Se refrescó la vista.");
        if (onDesactualizado) onDesactualizado();
        return;
      }
      setError(msg);
    } finally {
      setOperando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCerrar}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Cobertura parcial</h2>
        <p className="mt-1 text-sm text-slate-500">
          {personaOrigenLabel || personaOrigenId} — <span className="font-mono">{fechaYmd}</span>
        </p>

        {periodoCerrado ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            El período de liquidación está cerrado; no se pueden registrar coberturas en esta fecha.
          </p>
        ) : null}

        {cargando ? (
          <p className="mt-6 text-sm text-slate-400">Cargando segmentos del día…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <section>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">1. Tramos a cubrir</h3>
                <button
                  type="button"
                  onClick={() => abrirAyuda("Cobertura Parcial (Tramos)")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700 active:bg-slate-100"
                  title="Ayuda sobre cobertura parcial"
                  aria-label="Ayuda sobre cobertura parcial"
                >
                  ?
                </button>
              </div>
              {segmentos.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Sin segmentos materializados. Materializá el día antes o revisá el plan habilitado.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {segmentos.map((seg) => (
                    <li key={seg.segmento_id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm active:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(seg.segmento_id)}
                          onChange={() => toggleSegmento(seg.segmento_id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-800">{seg.checkbox_label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-700">2. Agente de cobertura (YY)</h3>
              <input
                type="search"
                value={busquedaYy}
                onChange={(e) => setBusquedaYy(e.target.value)}
                placeholder="Buscar por nombre o DNI…"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-100">
                {personasFiltradas.map((p) => (
                  <li key={p.persona_id}>
                    <button
                      type="button"
                      onClick={() => setPersonaCoberturaId(p.persona_id)}
                      className={`flex min-h-11 w-full items-center px-3 py-2 text-left text-sm ${
                        personaCoberturaId === p.persona_id ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {p.persona_label || p.persona_id}
                      {p.persona_dni ? ` · DNI ${p.persona_dni}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
              {avisosYy.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {avisosYy.map((a) => (
                    <li key={a} className="rounded-lg bg-amber-50 px-2 py-1">⚠ {a}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-700">3. Compensación y motivo</h3>
              <select
                value={tipoTccId}
                onChange={(e) => setTipoTccId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
              >
                {tiposTcc.map((t) => (
                  <option key={t.id} value={t.id}>{t.titulo_ui}</option>
                ))}
              </select>
              <textarea
                rows={2}
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo operativo (obligatorio)…"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
              />
            </section>
          </div>
        )}

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="min-h-11 rounded-xl px-4 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={operando || cargando || segmentos.length === 0 || periodoCerrado}
            onClick={() => void handleSubmit()}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {operando ? "Agregando…" : "Agregar a cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
