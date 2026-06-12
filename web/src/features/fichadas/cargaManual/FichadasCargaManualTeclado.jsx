import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import InputHoraHm from "./InputHoraHm.jsx";
import PersonaTypeahead from "./PersonaTypeahead.jsx";
import { playAlertaCercania } from "./playAlertaCercania.js";
import {
  evaluarCercaniaCargaManual,
  marcasCandidatasCargaManual,
  marcasInstantesDesdeFichadasReales,
  marcasPayloadDesdeFichadasReales,
  normalizarHoraHmInput,
} from "./fichadasCargaManualUtils.js";
import { callGuardarCapaFichadaDia } from "../../../services/callables.js";

/**
 * @param {{
 *   grupoTrabajoIdSector: string;
 *   umbralMinutos: number;
 *   roster: Array<{ persona_id: string; label: string; dni?: string; grupo_trabajo_id?: string }>;
 *   fechaSticky: string;
 *   onFechaStickyChange: (f: string) => void;
 *   personaInicial: { persona_id: string; label: string } | null;
 *   getVisCelda: (persona_id: string, fecha_ymd: string) => Promise<{ fichadas_reales: unknown[]; version: number }>;
 *   setVisCeldaCache: (persona_id: string, fecha_ymd: string, celda: object) => void;
 *   marcasColaSesion: (persona_id: string, fecha_ymd: string) => object[];
 *   onGuardadoOk: (entry: object) => void;
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
  setVisCeldaCache,
  marcasColaSesion,
  onGuardadoOk,
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
  const [guardando, setGuardando] = useState(false);
  const [visMarcas, setVisMarcas] = useState([]);

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

  const ejecutarGuardado = useCallback(async () => {
    const gdt = gdtParaPersona(persona, grupoTrabajoIdSector);
    if (!persona?.persona_id || !/^gdt_/i.test(gdt) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      toast.error("Completá agente (con sector), grupo del reloj si aplica, y fecha.");
      return;
    }
    const ing = normalizarHoraHmInput(ingreso);
    const egr = normalizarHoraHmInput(egreso);
    if (!ing && !egr) {
      toast.error("Ingresá al menos una hora.");
      return;
    }

    const celdaAntes = await getVisCelda(persona.persona_id, fecha);
    const snapshotAntes = JSON.parse(JSON.stringify(celdaAntes.fichadas_reales || []));
    const versionAntes = celdaAntes.version;

    const marcas = [];
    if (ing) marcas.push({ hora_hm: ing });
    if (egr) marcas.push({ hora_hm: egr });

    setGuardando(true);
    try {
      const res = await callGuardarCapaFichadaDia({
        persona_id: persona.persona_id,
        grupo_trabajo_id: gdt,
        fecha_ymd: fecha,
        accion: "AGREGAR_MARCAS",
        marcas,
        motivo: "Carga manual RRHH",
        origen: "CARGA_MANUAL",
        version_esperada: versionAntes,
      });
      const d = res.data || {};
      if (d.write_skipped) {
        toast("Sin cambios en servidor (marcas idénticas).", { icon: "ℹ️" });
      } else {
        const ver = d.fichadas_reales_version != null ? `v${d.fichadas_reales_version}` : "ok";
        toast.success(`Fichada guardada · ${marcas.map((m) => m.hora_hm).join(" / ")} · ${ver}`, {
          duration: 4000,
        });
      }

      const celdaNueva = await getVisCelda(persona.persona_id, fecha, { force: true, grupo_trabajo_id: gdt });
      setVisCeldaCache(persona.persona_id, fecha, celdaNueva, gdt);

      onGuardadoOk({
        id: `${Date.now()}_${persona.persona_id}`,
        persona_id: persona.persona_id,
        persona_label: persona.label,
        fecha_ymd: fecha,
        ingreso: ing,
        egreso: egr,
        grupo_trabajo_id: gdt,
        snapshotFichadas: snapshotAntes,
        versionAntes,
        versionDespues: celdaNueva.version,
        marcasAgregadas: marcasCandidatasCargaManual(fecha, ing, egr),
        guardado_en_label: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      });

      onFechaStickyChange(fecha);
      setIngreso("");
      setEgreso("");
      setBypassPendiente(false);
      setCercania(false);
      setPersona(null);
      setTimeout(focoPersona, 0);
    } catch (e) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }, [
    persona,
    grupoTrabajoIdSector,
    fecha,
    ingreso,
    egreso,
    getVisCelda,
    setVisCeldaCache,
    onGuardadoOk,
    onFechaStickyChange,
    focoPersona,
  ]);

  const onEnterEgreso = useCallback(() => {
    if (cercania && !bypassPendiente) {
      setBypassPendiente(true);
      toast("Marca muy cercana: Enter otra vez para confirmar contingencia.", { icon: "⚠️" });
      return;
    }
    ejecutarGuardado();
  }, [cercania, bypassPendiente, ejecutarGuardado]);

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
      {cercania ? (
        <div className="animate-pulse rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Marca muy cercana (menos de {umbralMinutos} min) para este agente.
          {bypassPendiente ? " Enter en Egreso confirma el guardado." : " Enter en Egreso para avisar de nuevo."}
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
              disabled={disabled || guardando}
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
            disabled={disabled || guardando}
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
              disabled={disabled || guardando}
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
              disabled={disabled || guardando}
              onEnter={onEnterEgreso}
            />
          </div>
        </label>
      </div>

      <p className="text-xs text-slate-500">
        Enter: Persona → Fecha → Ingreso → Egreso (guardar). Esc limpia agente. F2 → Fecha.
      </p>
    </div>
  );
}

/** Export para undo desde página */
export { marcasPayloadDesdeFichadasReales };
