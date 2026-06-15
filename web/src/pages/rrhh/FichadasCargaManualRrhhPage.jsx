import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import FichadasColaDiaTabla from "../../features/fichadas/cargaManual/FichadasColaDiaTabla.jsx";
import FichadasCargaManualTeclado from "../../features/fichadas/cargaManual/FichadasCargaManualTeclado.jsx";
import {
  diaMesKeyDesdeFechaYmd,
  leerVersionCelda,
  marcasCandidatasCargaManual,
  marcasInstantesDesdeFichadasReales,
  marcasPayloadDesdeFichadasReales,
} from "../../features/fichadas/cargaManual/fichadasCargaManualUtils.js";
import { useBloqueoSalidaColaPendiente } from "../../features/fichadas/cargaManual/useBloqueoSalidaColaPendiente.js";
import {
  MAX_COLA_PENDIENTE,
  useCargaManualCola,
} from "../../features/fichadas/cargaManual/useCargaManualCola.js";
import { useCargaManualRoster } from "../../features/fichadas/cargaManual/useCargaManualRoster.js";
import { useRelojConfigCache } from "../../features/fichadas/cargaManual/useRelojConfigCache.js";
import { callGuardarCapaFichadaDia, callObtenerVistaGrillaMesAgente } from "../../services/callables.js";
import { grillaVistaCacheStore } from "../../features/grilla/grillaCacheMemoryStore.js";

export default function FichadasCargaManualRrhhPage() {
  const [params] = useSearchParams();
  const gdtUrl = String(params.get("gdt_id") || params.get("grupo_trabajo_id") || "").trim();
  const personaUrl = String(params.get("persona_id") || "").trim();
  const fechaUrl = String(params.get("fecha_ymd") || "").trim();
  const relojUrl = String(params.get("reloj_id") || "").trim();

  const [relojId, setRelojId] = useState(() => (/^rel_/i.test(relojUrl) ? relojUrl : ""));
  const [fechaSticky, setFechaSticky] = useState(fechaUrl || "");
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const visCacheRef = useRef(new Map());

  const {
    relojes,
    politica,
    grupoTrabajoId: gdtReloj,
    esRelojUniversal,
    loading: loadingCfg,
    error: cfgError,
    recargar: recargarRelojes,
  } = useRelojConfigCache(relojId);
  const grupoTrabajoId = gdtUrl || gdtReloj;
  const sectorDesdeEnlace = /^gdt_/i.test(gdtUrl);

  const { roster, loading: rosterLoading, error: rosterError, modoGlobal } = useCargaManualRoster({
    relojId,
    grupoTrabajoId,
    fechaYmd: fechaSticky,
  });

  const {
    colaItems,
    pendientesCount,
    colaLlena,
    tienePendientes,
    pushPendiente,
    marcarEnviado,
    marcasColaSesion,
    quitarMarcasColaEntrada,
    removeById,
    pendientesEnOrdenEnvio,
  } = useCargaManualCola();

  useBloqueoSalidaColaPendiente(tienePendientes);

  useEffect(() => {
    if (rosterError) toast.error(rosterError);
  }, [rosterError]);

  useEffect(() => {
    if (cfgError) toast.error(cfgError, { duration: 8000 });
  }, [cfgError]);

  useEffect(() => {
    if (!relojId && relojes.length === 1) setRelojId(String(relojes[0].id));
  }, [relojes, relojId]);

  useEffect(() => {
    if (/^rel_/i.test(relojUrl) && relojes.some((r) => String(r.id) === relojUrl)) {
      setRelojId(relojUrl);
    }
  }, [relojUrl, relojes]);

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

  const invalidarGrillaTrasEnvio = useCallback((entry) => {
    const gdt = String(entry.grupo_trabajo_id || "").trim();
    const partes = String(entry.fecha_ymd || "").split("-");
    if (/^gdt_/i.test(gdt) && partes.length === 3) {
      grillaVistaCacheStore.invalidateGrupoPeriodo(gdt, `${partes[0]}-${partes[1]}`);
    }
  }, []);

  const verificarMarcasPersistidas = useCallback((entry, fichadasReales) => {
    const esperadas = marcasCandidatasCargaManual(entry.fecha_ymd, entry.ingreso, entry.egreso);
    const guardadas = marcasInstantesDesdeFichadasReales(fichadasReales, entry.fecha_ymd);
    const faltan = esperadas.filter(
      (e) => !guardadas.some((g) => g.hora_hm === e.hora_hm),
    );
    if (faltan.length) {
      throw new Error(
        `El servidor no reflejó las marcas (${faltan.map((m) => m.hora_hm).join(", ")}). Reintentá o avisá a sistemas.`,
      );
    }
  }, []);

  const enviarUnPendiente = useCallback(
    async (entry) => {
      const marcas = [];
      if (entry.ingreso) marcas.push({ hora_hm: entry.ingreso });
      if (entry.egreso) marcas.push({ hora_hm: entry.egreso });

      const celdaAntes = await getVisCelda(entry.persona_id, entry.fecha_ymd, {
        force: true,
        grupo_trabajo_id: entry.grupo_trabajo_id,
      });
      const snapshotAntes = JSON.parse(JSON.stringify(celdaAntes.fichadas_reales || []));
      const versionAntes = celdaAntes.version;

      const res = await callGuardarCapaFichadaDia({
        persona_id: entry.persona_id,
        grupo_trabajo_id: entry.grupo_trabajo_id,
        fecha_ymd: entry.fecha_ymd,
        accion: "AGREGAR_MARCAS",
        marcas,
        motivo: "Carga manual RRHH",
        origen: "CARGA_MANUAL",
        version_esperada: versionAntes,
      });
      const d = res.data || {};
      if (d.write_skipped) {
        throw new Error(
          `Sin cambios en servidor para ${entry.persona_label} ${entry.fecha_ymd} (marcas idénticas).`,
        );
      }

      const celdaNueva = await getVisCelda(entry.persona_id, entry.fecha_ymd, {
        force: true,
        grupo_trabajo_id: entry.grupo_trabajo_id,
      });
      verificarMarcasPersistidas(entry, celdaNueva.fichadas_reales);
      setVisCeldaCache(entry.persona_id, entry.fecha_ymd, celdaNueva, entry.grupo_trabajo_id);
      invalidarGrillaTrasEnvio(entry);

      marcarEnviado(entry.id, {
        snapshotFichadas: snapshotAntes,
        versionAntes,
        versionDespues: celdaNueva.version,
      });
    },
    [getVisCelda, setVisCeldaCache, invalidarGrillaTrasEnvio, marcarEnviado, verificarMarcasPersistidas],
  );

  const enviarCola = useCallback(async () => {
    const lote = pendientesEnOrdenEnvio();
    if (!lote.length) {
      toast.error("No hay registros pendientes.");
      return;
    }
    setEnviando(true);
    let ok = 0;
    try {
      for (const entry of lote) {
        await enviarUnPendiente(entry);
        ok += 1;
      }
      toast.success(`Lote enviado: ${ok} registro(s) persistidos.`);
    } catch (e) {
      toast.error(e?.message || "Error al enviar el lote.");
      if (ok > 0) {
        toast(`${ok} registro(s) ya enviados antes del error.`, { icon: "ℹ️" });
      }
    } finally {
      setEnviando(false);
    }
  }, [pendientesEnOrdenEnvio, enviarUnPendiente]);

  const deshacerEntrada = useCallback(
    async (entry) => {
      if (!entry) return;
      if (entry.estado === "pendiente") {
        quitarMarcasColaEntrada(entry);
        removeById(entry.id);
        toast.success("Registro quitado de la cola.");
        return;
      }

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
        invalidarGrillaTrasEnvio(entry);
        toast.success("Deshacer aplicado (snapshot restaurado).");
      } catch (e) {
        toast.error(e?.message || "No se pudo deshacer.");
      } finally {
        setDeshaciendo(false);
      }
    },
    [quitarMarcasColaEntrada, removeById, invalidarGrillaTrasEnvio],
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

  const grupoLabel = modoGlobal || esRelojUniversal
    ? "Universal (destino por agente)"
    : grupoTrabajoId || "—";

  const relojSectorialListo = Boolean(relojId) && /^gdt_/i.test(gdtReloj);
  const relojUniversalListo = Boolean(relojId) && esRelojUniversal;
  const sectorEnlaceListo = sectorDesdeEnlace && /^gdt_/i.test(grupoTrabajoId);
  const formDisabled = !(relojUniversalListo || relojSectorialListo || sectorEnlaceListo);

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-28 md:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Carga manual de fichadas</h1>
        <p className="text-sm text-slate-500">
          Precarga en cola (máx. {MAX_COLA_PENDIENTE}) · luego{" "}
          <strong className="text-violet-800">Enviar</strong> ·{" "}
          {tienePendientes ? (
            <span className="font-medium text-amber-800">no podés salir con pendientes</span>
          ) : (
            <Link to="/portal/rrhh/fichadas-import" className="text-blue-600 hover:underline">
              Import TXT
            </Link>
          )}
        </p>
      </header>

      {tienePendientes ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Tenés registros sin enviar. Completá el lote con <strong>Enviar</strong> o quitá cada fila antes de
          cambiar de pantalla.
        </div>
      ) : null}

      <Card className="space-y-3 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Reloj / sector (config §15.1B)
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
            value={relojId}
            onChange={(e) => setRelojId(e.target.value)}
            disabled={loadingCfg || tienePendientes}
            title={tienePendientes ? "Enviá o quitá la cola antes de cambiar reloj" : undefined}
          >
            <option value="">
              {loadingCfg ? "Cargando relojes…" : "— Seleccionar reloj —"}
            </option>
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
        {cfgError ? (
          <p className="text-xs text-rose-700">
            {cfgError}{" "}
            <button type="button" className="font-semibold underline" onClick={() => recargarRelojes()}>
              Reintentar
            </button>
          </p>
        ) : null}
        <p className="text-xs text-slate-500">
          Grupo: <span className="font-mono">{grupoLabel}</span>
          {gdtUrl ? " (desde enlace grilla)" : ""} · Umbral duplicados: {politica.umbral_duplicado_minutos} min
          {rosterLoading ? " · Cargando roster…" : ` · ${roster.length} agentes`}
          {modoGlobal ? " · caché sesión (GLOBAL)" : ""}
        </p>
        {formDisabled ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {sectorEnlaceListo
              ? "Cargando roster del sector desde el enlace de la grilla…"
              : "Seleccioná un reloj arriba (sectorial o universal) para habilitar agente, fecha e ingreso/egreso."}
            {relojes.length === 0 && !loadingCfg && !sectorEnlaceListo ? (
              <>
                {" "}
                No hay relojes activos.{" "}
                <Link to="/portal/rrhh/fichadas-relojes" className="font-semibold text-violet-800 underline">
                  Alta de relojes biométricos
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : null}
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
          marcasColaSesion={marcasColaSesion}
          onAgregarPendiente={pushPendiente}
          colaLlena={colaLlena}
          disabled={formDisabled}
        />
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Cola del día (sesión)</h2>
        <FichadasColaDiaTabla
          items={colaItems}
          pendientesCount={pendientesCount}
          maxPendientes={MAX_COLA_PENDIENTE}
          onDeshacer={deshacerEntrada}
          onEnviar={enviarCola}
          enviando={enviando}
          deshaciendo={deshaciendo}
        />
      </Card>
    </div>
  );
}
