import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import InputHoraHm from "./InputHoraHm.jsx";
import PersonaTypeahead from "./PersonaTypeahead.jsx";
import { playAlertaCercania } from "./playAlertaCercania.js";
import {
  evaluarCercaniaCargaManual,
  marcasCandidatasCargaManual,
  marcasInstantesDesdeFichadasReales,
  normalizarHoraHmInput,
} from "./fichadasCargaManualUtils.js";

/**
 * @param {{
 *   grupoTrabajoIdSector: string;
 *   umbralMinutos: number;
 *   roster: Array<{ persona_id: string; label: string; dni?: string; grupo_trabajo_id?: string }>;
 *   fechaSticky: string;
 *   onFechaStickyChange: (f: string) => void;
 *   personaInicial: { persona_id: string; label: string } | null;
 *   getVisCelda: (persona_id: string, fecha_ymd: string, opts?: object) => Promise<{ fichadas_reales: unknown[]; version: number }>;
 *   marcasColaSesion: (persona_id: string, fecha_ymd: string) => object[];
 *   onAgregarPendiente: (entry: object) => void;
 *   colaLlena?: boolean;
 *   disabled?: boolean;
 * }} props
 */
function gdtParaPersona(persona, grupoTrabajoIdSector) {
  const delAgente = String(persona?.grupo_trabajo_id || "").trim();
  if (/^gdt_/i.test(delAgente)) return delAgente;
  const fijo = String(grupoTrabajoIdSector || "").trim();
  return /^gdt_/i.test(fijo) ? fijo : "";
}

export default function FichadasCargaManualTeclado({
  grupoTrabajoIdSector,
  umbralMinutos,
  roster,
  fechaSticky,
  onFechaStickyChange,
  personaInicial,
  getVisCelda,
  marcasColaSesion,
  onAgregarPendiente,
  colaLlena = false,
  disabled,
}) {
  const refPersona = useRef(null);
  const refFecha = useRef(null);
  const refIngreso = useRef(null);
  const refEgreso = useRef(null);

  const [persona, setPersona] = useState(personaInicial);
  const [fecha, setFecha] = useState(fechaSticky || "");
  const [ingreso, setIngreso] = useState("");
  const [egreso, setEgreso] = useState("");
  const [cercania, setCercania] = useState(false);
  const [bypassPendiente, setBypassPendiente] = useState(false);
  const [visMarcas, setVisMarcas] = useState([]);

  const formBloqueado = disabled || colaLlena;

  useEffect(() => {
    if (personaInicial?.persona_id) setPersona(personaInicial);
  }, [personaInicial?.persona_id]);

  useEffect(() => {
    if (fechaSticky) setFecha(fechaSticky);
  }, [fechaSticky]);

  const focoPersona = useCallback(() => {
    refPersona.current?.focus();
  }, []);

  useEffect(() => {
    focoPersona();
  }, [focoPersona]);

  const gdtActivo = gdtParaPersona(persona, grupoTrabajoIdSector);

  const recargarVis = useCallback(async () => {
    if (!persona?.persona_id || !fecha || !/^gdt_/i.test(gdtActivo)) {
      setVisMarcas([]);
      return;
    }
    try {
      const celda = await getVisCelda(persona.persona_id, fecha, { grupo_trabajo_id: gdtActivo });
      setVisMarcas(marcasInstantesDesdeFichadasReales(celda.fichadas_reales, fecha));
    } catch {
      setVisMarcas([]);
    }
  }, [persona?.persona_id, fecha, gdtActivo, getVisCelda]);

  useEffect(() => {
    recargarVis();
  }, [recargarVis]);

  const actualizarCercania = useCallback(
    (ing, egr) => {
      if (!persona?.persona_id || !fecha) {
        setCercania(false);
        return;
      }
      const r = evaluarCercaniaCargaManual({
        fecha_ymd: fecha,
        ingreso: ing,
        egreso: egr,
        existentesVis: visMarcas,
        colaSesion: marcasColaSesion(persona.persona_id, fecha),
        umbralMinutos,
      });
      const next = r.tieneCercania;
      if (next && !cercania) playAlertaCercania();
      setCercania(next);
      if (!next) setBypassPendiente(false);
    },
    [persona?.persona_id, fecha, visMarcas, marcasColaSesion, umbralMinutos, cercania],
  );

  useEffect(() => {
    actualizarCercania(ingreso, egreso);
  }, [ingreso, egreso, actualizarCercania]);

  const agregarACola = useCallback(
    (horasOverride) => {
      if (colaLlena) {
        toast.error("Cola completa (10/10). Enviá el lote para seguir cargando.");
        return;
      }
      const gdt = gdtParaPersona(persona, grupoTrabajoIdSector);
      if (!persona?.persona_id || !/^gdt_/i.test(gdt) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        toast.error("Completá agente (con sector), grupo del reloj si aplica, y fecha.");
        return;
      }
      const ing = normalizarHoraHmInput(horasOverride?.ingreso ?? ingreso);
      const egr = normalizarHoraHmInput(horasOverride?.egreso ?? egreso);
      if (!ing && !egr) {
        toast.error("Ingresá al menos una hora.");
        return;
      }

      onAgregarPendiente({
        id: `${Date.now()}_${persona.persona_id}`,
        persona_id: persona.persona_id,
        persona_label: persona.label,
        fecha_ymd: fecha,
        ingreso: ing,
        egreso: egr,
        grupo_trabajo_id: gdt,
        marcasAgregadas: marcasCandidatasCargaManual(fecha, ing, egr),
      });

      toast.success(`En cola: ${[ing, egr].filter(Boolean).join(" · ")}`, { duration: 2500 });
      onFechaStickyChange(fecha);
      setIngreso("");
      setEgreso("");
      setBypassPendiente(false);
      setCercania(false);
      setPersona(null);
      setTimeout(focoPersona, 0);
    },
    [
      colaLlena,
      persona,
      grupoTrabajoIdSector,
      fecha,
      ingreso,
      egreso,
      onAgregarPendiente,
      onFechaStickyChange,
      focoPersona,
    ],
  );

  const onEnterEgreso = useCallback(() => {
    if (colaLlena) {
      toast.error("Cola completa. Enviá el lote antes de cargar más.");
      return;
    }
    if (cercania && !bypassPendiente) {
      setBypassPendiente(true);
      toast("Marca muy cercana: Enter otra vez para confirmar contingencia.", { icon: "⚠️" });
      return;
    }
    const ingNorm = normalizarHoraHmInput(ingreso);
    const egrNorm = normalizarHoraHmInput(egreso);
    if (ingNorm !== ingreso) setIngreso(ingNorm);
    if (egrNorm !== egreso) setEgreso(egrNorm);
    agregarACola({ ingreso: ingNorm, egreso: egrNorm });
  }, [colaLlena, cercania, bypassPendiente, agregarACola, ingreso, egreso]);

  useEffect(() => {
    const onGlobalKey = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        refFecha.current?.focus();
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  return (
    <div className="space-y-4">
      {colaLlena ? (
        <div className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-950">
          Cola completa (10/10). Enviá el lote para seguir cargando.
        </div>
      ) : null}

      {cercania ? (
        <div className="animate-pulse rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Marca muy cercana (menos de {umbralMinutos} min) para este agente.
          {bypassPendiente ? " Enter en Egreso confirma el alta en cola." : " Enter en Egreso para confirmar contingencia."}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Agente
          <div className="mt-1">
            <PersonaTypeahead
              ref={refPersona}
              opciones={roster}
              value={persona}
              onSelect={setPersona}
              onClear={() => setPersona(null)}
              onEnterAdvance={() => refFecha.current?.focus()}
              disabled={formBloqueado}
            />
          </div>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Fecha (sticky)
          <input
            ref={refFecha}
            type="date"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={fecha}
            disabled={formBloqueado}
            onChange={(e) => {
              setFecha(e.target.value);
              onFechaStickyChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                refIngreso.current?.focus();
              }
            }}
          />
        </label>

        <div className="hidden sm:block" />

        <label className="text-sm font-medium text-slate-700">
          Ingreso
          <div className="mt-1">
            <InputHoraHm
              ref={refIngreso}
              value={ingreso}
              onChange={(v) => {
                setIngreso(v);
                setBypassPendiente(false);
              }}
              disabled={formBloqueado}
              onEnter={() => refEgreso.current?.focus()}
            />
          </div>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Egreso
          <div className="mt-1">
            <InputHoraHm
              ref={refEgreso}
              value={egreso}
              onChange={(v) => {
                setEgreso(v);
                setBypassPendiente(false);
              }}
              disabled={formBloqueado}
              onEnter={onEnterEgreso}
            />
          </div>
        </label>
      </div>

      <p className="text-xs text-slate-500">
        Enter: Persona → Fecha → Ingreso → Egreso (precarga en cola, máx. 10). Luego Enviar. Esc limpia agente. F2 →
        Fecha.
      </p>
    </div>
  );
}

export { marcasPayloadDesdeFichadasReales } from "./fichadasCargaManualUtils.js";
