import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import FichadasColaDiaTabla from "../../features/fichadas/cargaManual/FichadasColaDiaTabla.jsx";
import FichadasCargaManualTeclado, {
  marcasPayloadDesdeFichadasReales,
} from "../../features/fichadas/cargaManual/FichadasCargaManualTeclado.jsx";
import {
  diaMesKeyDesdeFechaYmd,
  leerVersionCelda,
} from "../../features/fichadas/cargaManual/fichadasCargaManualUtils.js";
import { useCargaManualCola } from "../../features/fichadas/cargaManual/useCargaManualCola.js";
import { useCargaManualRoster } from "../../features/fichadas/cargaManual/useCargaManualRoster.js";
import { useRelojConfigCache } from "../../features/fichadas/cargaManual/useRelojConfigCache.js";
import { callGuardarCapaFichadaDia, callObtenerVistaGrillaMesAgente } from "../../services/callables.js";

export default function FichadasCargaManualRrhhPage() {
  const [params] = useSearchParams();
  const gdtUrl = String(params.get("gdt_id") || params.get("grupo_trabajo_id") || "").trim();
  const personaUrl = String(params.get("persona_id") || "").trim();
  const fechaUrl = String(params.get("fecha_ymd") || "").trim();

  const [relojId, setRelojId] = useState("");
  const [fechaSticky, setFechaSticky] = useState(fechaUrl || "");
  const [deshaciendo, setDeshaciendo] = useState(false);

  const visCacheRef = useRef(new Map());

  const { relojes, politica, grupoTrabajoId: gdtReloj, esRelojUniversal, loading: loadingCfg } =
    useRelojConfigCache(relojId);
  const grupoTrabajoId = gdtUrl || gdtReloj;

  const { roster, loading: rosterLoading, error: rosterError, modoGlobal } = useCargaManualRoster({
    relojId,
    grupoTrabajoId,
    fechaYmd: fechaSticky,
  });

  const {
    colaItems,
    pushGuardado,
    marcasColaSesion,
    quitarMarcasColaEntrada,
    removeById,
  } = useCargaManualCola();

  useEffect(() => {
    if (rosterError) toast.error(rosterError);
  }, [rosterError]);

  useEffect(() => {
    if (!relojId && relojes.length === 1) setRelojId(String(relojes[0].id));
  }, [relojes, relojId]);

  const personaInicial = useMemo(() => {
    if (!/^per_/i.test(personaUrl)) return null;
    const row = roster.find((r) => r.persona_id === personaUrl);
    return {
      persona_id: personaUrl,
      label: row?.label || personaUrl,
      grupo_trabajo_id: row?.grupo_trabajo_id || grupoTrabajoId || "",
    };
  }, [personaUrl, roster, grupoTrabajoId]);

  const cacheKey = (persona_id, fecha_ymd, gdt) => `${persona_id}|${fecha_ymd}|${gdt}`;

  const getVisCelda = useCallback(
    async (persona_id, fecha_ymd, opts = {}) => {
      const gdt = String(opts.grupo_trabajo_id || grupoTrabajoId || "").trim();
      if (!/^gdt_/i.test(gdt)) {
        throw new Error("Grupo de trabajo del agente no disponible.");
      }
      const key = cacheKey(persona_id, fecha_ymd, gdt);
      if (!opts.force && visCacheRef.current.has(key)) {
        return visCacheRef.current.get(key);
      }
      const [y, m] = fecha_ymd.split("-").map(Number);
      const res = await callObtenerVistaGrillaMesAgente({
        persona_id,
        grupo_trabajo_id: gdt,
        anio: y,
        mes: m,
      });
      const dias = res.data?.dias || {};
      const dk = diaMesKeyDesdeFechaYmd(fecha_ymd);
      const celda = dias[dk] || {};
      const packed = {
        fichadas_reales: celda.fichadas_reales || [],
        version: leerVersionCelda(celda),
      };
      visCacheRef.current.set(key, packed);
      return packed;
    },
    [grupoTrabajoId],
  );

  const setVisCeldaCache = useCallback((persona_id, fecha_ymd, celda, gdt) => {
    const gdtKey = String(gdt || grupoTrabajoId || "").trim();
    visCacheRef.current.set(cacheKey(persona_id, fecha_ymd, gdtKey), celda);
  }, [grupoTrabajoId]);

  const deshacerEntrada = useCallback(
    async (entry) => {
      if (!entry) return;
      setDeshaciendo(true);
      try {
        const marcas = marcasPayloadDesdeFichadasReales(entry.snapshotFichadas);
        await callGuardarCapaFichadaDia({
          persona_id: entry.persona_id,
          grupo_trabajo_id: entry.grupo_trabajo_id,
          fecha_ymd: entry.fecha_ymd,
          accion: "REEMPLAZAR_MARCAS",
          marcas,
          motivo: "Deshacer carga manual",
          origen: "CARGA_MANUAL",
          version_esperada: entry.versionDespues,
        });
        quitarMarcasColaEntrada(entry);
        removeById(entry.id);
        visCacheRef.current.delete(cacheKey(entry.persona_id, entry.fecha_ymd, entry.grupo_trabajo_id));
        toast.success("Deshacer aplicado (snapshot restaurado).");
      } catch (e) {
        toast.error(e?.message || "No se pudo deshacer.");
      } finally {
        setDeshaciendo(false);
      }
    },
    [quitarMarcasColaEntrada, removeById],
  );

  const deshacerUltimo = useCallback(async () => {
    const ultimo = colaItems[0];
    if (!ultimo) {
      toast.error("No hay registros para deshacer.");
      return;
    }
    await deshacerEntrada(ultimo);
  }, [colaItems, deshacerEntrada]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        deshacerUltimo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deshacerUltimo]);

  const onGuardadoOk = useCallback(
    (entry) => {
      pushGuardado(entry);
    },
    [pushGuardado],
  );

  const grupoLabel = modoGlobal || esRelojUniversal
    ? "Universal (destino por agente)"
    : grupoTrabajoId || "—";

  const formDisabled = !relojId || (!modoGlobal && !/^gdt_/i.test(grupoTrabajoId));

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-28 md:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Carga manual de fichadas</h1>
        <p className="text-sm text-slate-500">
          Data-entry por teclado ·{" "}
          <Link to="/portal/rrhh/fichadas-import" className="text-blue-600 hover:underline">
            Import TXT
          </Link>
        </p>
      </header>

      <Card className="space-y-3 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Reloj / sector (config §15.1B)
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={relojId}
            onChange={(e) => setRelojId(e.target.value)}
            disabled={loadingCfg}
          >
            <option value="">— Seleccionar —</option>
            {relojes.map((r) => {
              const g = String(r.grupo_trabajo_id || r.grupo_id || "").trim();
              const suf = g ? "" : " · universal";
              return (
                <option key={r.id} value={r.id}>
                  {r.nombre || r.id}
                  {suf}
                </option>
              );
            })}
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Grupo: <span className="font-mono">{grupoLabel}</span>
          {gdtUrl ? " (desde enlace grilla)" : ""} · Umbral duplicados: {politica.umbral_duplicado_minutos} min
          {rosterLoading ? " · Cargando roster…" : ` · ${roster.length} agentes`}
          {modoGlobal ? " · caché sesión (GLOBAL)" : ""}
        </p>
      </Card>

      <Card className="p-4">
        <FichadasCargaManualTeclado
          grupoTrabajoIdSector={grupoTrabajoId}
          umbralMinutos={politica.umbral_duplicado_minutos}
          roster={roster}
          fechaSticky={fechaSticky}
          onFechaStickyChange={setFechaSticky}
          personaInicial={personaInicial}
          getVisCelda={getVisCelda}
          setVisCeldaCache={setVisCeldaCache}
          marcasColaSesion={marcasColaSesion}
          onGuardadoOk={onGuardadoOk}
          disabled={formDisabled}
        />
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Cola del día (sesión)</h2>
        <FichadasColaDiaTabla items={colaItems} onDeshacer={deshacerEntrada} deshaciendo={deshaciendo} />
      </Card>
    </div>
  );
}
