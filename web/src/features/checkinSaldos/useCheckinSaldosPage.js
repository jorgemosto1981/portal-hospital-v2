import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { LAO_ANIO_CORTE_PORTAL_A, LAO_ARTICULO_ID } from "../../constants/laoArticulo.js";
import {
  callCerrarCheckinGlobal,
  callObtenerSaldosCheckinPersona,
  callPersistirCheckinLaoBolsas,
  callPersistirCheckinSaldoEstandarLote,
} from "../../services/callables.js";
import { collectPendientesPatronB, collectPendientesPatronC } from "./collectPendientesPatronBC.js";
import { fetchPersonaCheckinRrhh } from "./fetchPersonaCheckinRrhh.js";
import { usePersonasCheckinBusqueda } from "./usePersonasCheckinBusqueda.js";
import { parseSaldosCheckinPrecarga } from "./parseSaldosCheckinPrecarga.js";
import { PATRON_SALDO_B, PATRON_SALDO_C } from "./resolvePatronSaldo.js";
import { validateCheckinPatronC } from "./validateCheckinPatronC.js";
import { CHECKIN_COPY_ANIO_A } from "../../../../shared/utils/laoVersionResolver.js";
import { buildCheckinResumen } from "./buildCheckinResumen.js";
import { buildCheckinCierreAdvertencias } from "./buildCheckinCierreAdvertencias.js";
import { detectHayCheckinPrevio } from "./detectHayCheckinPrevio.js";

import { useArticulosActivosCheckin } from "./useArticulosActivosCheckin.js";
import { useArticulosPorPatron } from "./useArticulosPorPatron.js";
import { emptyCheckinFila, parseAnioCorteA, validateCheckinFilas } from "./checkinFilasUtils.js";
import { validateCheckinEstandar } from "./validateCheckinEstandar.js";

function callableMessage(err) {
  const code = err?.code ? String(err.code) : "";
  let msg = err?.message ? String(err.message) : "Error al guardar check-in.";
  const details = err?.details;
  if (details != null && String(details).trim()) {
    msg = `${msg} — ${String(details).trim()}`;
  }
  if (code === "functions/already-exists" || code === "already-exists") {
    if (/bolsa.*consumo/i.test(msg)) {
      msg =
        "Esa bolsa LAO ya tiene días consumidos en el portal. Elegí «Rectificación» (arriba) y volvé a guardar solo los años que quieras corregir.";
    }
  }
  if (code === "functions/internal" || code === "internal") {
    if (/invoker|permission|IAM/i.test(msg)) {
      msg =
        "No se pudo invocar el cierre global en el servidor. Reintentá en unos minutos; si persiste, avisá a sistemas (callable cerrarCheckinGlobal).";
    }
  }
  return code ? `${msg} (${code})` : msg;
}

export function useCheckinSaldosPage() {
  const [searchParams] = useSearchParams();
  const { articulos, loadingArticulos } = useArticulosActivosCheckin();

  const [categoriaTab, setCategoriaTab] = useState(/** @type {'A'|'B'|'C'} */ ("A"));
  const [anioCorteA, setAnioCorteA] = useState(String(LAO_ANIO_CORTE_PORTAL_A));
  const anioA = useMemo(() => parseAnioCorteA(anioCorteA), [anioCorteA]);

  const [personaId, setPersonaId] = useState("");
  const personaWrapRef = useRef(null);
  const {
    loadPersonas,
    personaQuery,
    setPersonaQuery,
    personaOpen,
    setPersonaOpen,
    personaOptions,
    personaOptionsFiltradas,
    refetchPersonas,
  } = usePersonasCheckinBusqueda();

  const [personaData, setPersonaData] = useState(null);
  const [loadingPersonaData, setLoadingPersonaData] = useState(false);
  const [confirmarRecargaLao, setConfirmarRecargaLao] = useState(false);
  const [confirmarRecargaGlobal, setConfirmarRecargaGlobal] = useState(false);

  const [hlcConfirmadas, setHlcConfirmadas] = useState(false);
  const [filas, setFilas] = useState(() => [emptyCheckinFila()]);
  const [diasPorArticuloB, setDiasPorArticuloB] = useState({});
  const [saldosPorArticuloC, setSaldosPorArticuloC] = useState({});

  const [enviando, setEnviando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  const [modalGlobal, setModalGlobal] = useState({ open: false, step: 1 });
  const [modalCierreAcks, setModalCierreAcks] = useState({});
  const [loadingPrecarga, setLoadingPrecarga] = useState(false);
  const [tieneBolsasFirestore, setTieneBolsasFirestore] = useState(false);
  const precargaKeyRef = useRef("");
  const precargaToastKeyRef = useRef("");
  const lastUrlPersonaRef = useRef("");
  const personaIdAnteriorRef = useRef("");
  const [modoCheckin, setModoCheckin] = useState(/** @type {null | 'nuevo' | 'rectificacion'} */ (null));

  const resetPantallaCheckin = useCallback(() => {
    precargaKeyRef.current = "";
    precargaToastKeyRef.current = "";
    setModoCheckin(null);
    setHlcConfirmadas(false);
    setFilas([emptyCheckinFila()]);
    setDiasPorArticuloB({});
    setSaldosPorArticuloC({});
    setCategoriaTab("A");
    setConfirmarRecargaLao(false);
    setConfirmarRecargaGlobal(false);
    setUltimoResultado(null);
    setModalGlobal({ open: false, step: 1 });
    setModalCierreAcks({});
    setTieneBolsasFirestore(false);
    setPersonaData(null);
    setLoadingPrecarga(false);
    setAnioCorteA(String(LAO_ANIO_CORTE_PORTAL_A));
    setPersonaOpen(false);
    setPersonaQuery("");
  }, []);

  const setPersonaIdCheckin = useCallback(
    (nextId) => {
      const next = String(nextId || "").trim();
      const prev = personaIdAnteriorRef.current;
      if (prev && next !== prev) {
        resetPantallaCheckin();
      }
      if (!next) {
        resetPantallaCheckin();
        personaIdAnteriorRef.current = "";
        setPersonaId("");
        return;
      }
      personaIdAnteriorRef.current = next;
      setPersonaId(next);
    },
    [resetPantallaCheckin],
  );

  const hayCheckinPrevio = useMemo(
    () => detectHayCheckinPrevio(personaData, { tieneBolsas: tieneBolsasFirestore }),
    [personaData, tieneBolsasFirestore],
  );
  const esRectificacion = modoCheckin === "rectificacion";
  const esNuevoCheckin = modoCheckin === "nuevo";
  const yaCheckinGlobalEarly = Boolean(personaData?.checkin_saldos_portal_en);
  /** Cierre global + modo «nuevo» sin recarga → forzar rectificación o checkbox de recarga. */
  const modoNuevoInvalidoConGlobalCerrado =
    yaCheckinGlobalEarly && esNuevoCheckin && !confirmarRecargaGlobal;
  const necesitaElegirModo =
    Boolean(personaId) &&
    anioA != null &&
    !loadingPrecarga &&
    !loadingPersonaData &&
    hayCheckinPrevio &&
    (modoCheckin === null || modoNuevoInvalidoConGlobalCerrado);

  const prerequisitosOk =
    Boolean(personaId) &&
    anioA != null &&
    modoCheckin != null &&
    (esNuevoCheckin ? hlcConfirmadas : true);

  const {
    articulosPatron: articulosB,
    articulosConProblema: articulosProblemaB,
    loadingPatronList: loadingB,
  } = useArticulosPorPatron(articulos, PATRON_SALDO_B, anioA, prerequisitosOk && categoriaTab === "B");

  const {
    articulosPatron: articulosC,
    articulosConProblema: articulosProblemaC,
    loadingPatronList: loadingC,
  } = useArticulosPorPatron(articulos, PATRON_SALDO_C, anioA, prerequisitosOk && categoriaTab === "C");

  const laoArticulo = useMemo(
    () => articulos.find((a) => a.id === LAO_ARTICULO_ID) || null,
    [articulos],
  );

  const refreshPersona = useCallback(async (per) => {
    const { persona } = await fetchPersonaCheckinRrhh(per);
    setPersonaData(persona);
  }, []);

  useEffect(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    if (!/^per_/i.test(fromUrl)) return;
    const current = String(personaId || "").trim();
    const prevUrl = lastUrlPersonaRef.current;
    if (prevUrl && current && current !== prevUrl && fromUrl === prevUrl) {
      return;
    }
    if (current === fromUrl) {
      lastUrlPersonaRef.current = fromUrl;
      return;
    }
    setPersonaIdCheckin(fromUrl);
    lastUrlPersonaRef.current = fromUrl;
    void refetchPersonas(fromUrl);
  }, [searchParams, personaId, setPersonaIdCheckin, refetchPersonas]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (/^per_/i.test(per)) void refetchPersonas(per);
  }, [personaId, refetchPersonas]);

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current?.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (!/^per_/i.test(per)) {
      return;
    }
    let cancelled = false;
    setLoadingPersonaData(true);
    void fetchPersonaCheckinRrhh(per)
      .then(({ persona, anioCortePortalA }) => {
        if (cancelled) return;
        setPersonaData(persona);
        if (anioCortePortalA != null) setAnioCorteA(String(anioCortePortalA));
      })
      .catch((e) => {
        if (!cancelled) {
          setPersonaData(null);
          const code = e?.code ? String(e.code) : "";
          if (code.includes("permission-denied")) {
            toast.error(
              "Sin permiso RRHH para leer la persona. Cerrá sesión, volvé a entrar o ejecutá dev:set-rrhh-claims.",
            );
          } else {
            toast.error(e?.message || "No se pudo cargar el estado del agente.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPersonaData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  useEffect(() => {
    if (anioA == null) return;
    setFilas((prev) =>
      prev.map((f) => {
        const y = Number(f.anio_origen);
        if (f.anio_origen !== "" && Number.isInteger(y) && y >= anioA) {
          return { ...f, anio_origen: "" };
        }
        return f;
      }),
    );
  }, [anioA]);

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (!/^per_/i.test(per) || anioA == null) {
      precargaKeyRef.current = "";
      setFilas([emptyCheckinFila()]);
      setDiasPorArticuloB({});
      setSaldosPorArticuloC({});
      setLoadingPrecarga(false);
      return;
    }

    const key = `${per}:${anioA}`;
    if (precargaKeyRef.current === key) return;

    let cancelled = false;
    setLoadingPrecarga(true);

    void callObtenerSaldosCheckinPersona({ persona_id: per, anio_corte_a: anioA })
      .then((resp) => {
        if (cancelled) return;
        const docs = Array.isArray(resp?.data?.docs) ? resp.data.docs : [];
        const parsed = parseSaldosCheckinPrecarga({
          saldoDocs: docs,
          anioA,
          laoArticuloId: LAO_ARTICULO_ID,
        });
        setFilas(parsed.filasLao);
        setDiasPorArticuloB(parsed.diasPorArticuloB);
        setSaldosPorArticuloC(parsed.saldosPorArticuloC);
        precargaKeyRef.current = key;
        const n =
          parsed.filasLao.filter((f) => String(f.anio_origen || "").trim() !== "").length +
          Object.keys(parsed.diasPorArticuloB).length +
          Object.keys(parsed.saldosPorArticuloC).length;
        setTieneBolsasFirestore(n > 0);
        if (n > 0 && precargaToastKeyRef.current !== key) {
          precargaToastKeyRef.current = key;
          toast.success("Saldos precargados desde bolsas existentes.");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e?.message || "No se pudieron leer saldos del agente.");
          setFilas([emptyCheckinFila()]);
          setDiasPorArticuloB({});
          setSaldosPorArticuloC({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPrecarga(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personaId, anioA]);

  useEffect(() => {
    if (loadingPrecarga || loadingPersonaData || !personaId || anioA == null) return;
    if (!hayCheckinPrevio) {
      setModoCheckin("nuevo");
      return;
    }
    if (personaData?.checkin_saldos_portal_en && modoCheckin === "nuevo" && !confirmarRecargaGlobal) {
      setModoCheckin(null);
    }
  }, [
    hayCheckinPrevio,
    loadingPrecarga,
    loadingPersonaData,
    personaId,
    anioA,
    personaData?.checkin_saldos_portal_en,
    modoCheckin,
    confirmarRecargaGlobal,
  ]);

  const yaCheckinGlobal = Boolean(personaData?.checkin_saldos_portal_en);
  const yaCheckinLao = Boolean(personaData?.checkin_lao_registrado_en);
  const bloqueoGlobalSinRecarga = yaCheckinGlobal && !confirmarRecargaGlobal && !esRectificacion;
  const bloqueoLaoSinRecarga = yaCheckinLao && !confirmarRecargaLao && !esRectificacion;
  const forzarRecarga = esRectificacion || confirmarRecargaGlobal || confirmarRecargaLao;

  const personaSeleccionadaLabel = useMemo(() => {
    const hit = personaOptions.find((o) => o.value === personaId);
    return hit ? hit.label : personaId ? String(personaId) : "";
  }, [personaId, personaOptions]);

  const assertBase = useCallback(() => {
    const per = String(personaId || "").trim();
    if (!/^per_/i.test(per)) {
      toast.error("Seleccioná un agente.");
      return null;
    }
    if (!modoCheckin) {
      toast.error("Elegí si es check-in nuevo o rectificación.");
      return null;
    }
    if (esNuevoCheckin && !hlcConfirmadas) {
      toast.error("Confirmá las HLC antes del check-in nuevo.");
      return null;
    }
    if (anioA == null) {
      toast.error("Indicá el año de corte A.");
      return null;
    }
    if (bloqueoGlobalSinRecarga) {
      toast.error(
        "Check-in global cerrado. Elegí «Rectificación» arriba o marcá «Autorizo recargar bolsas» en el banner.",
      );
      return null;
    }
    return per;
  }, [anioA, bloqueoGlobalSinRecarga, esNuevoCheckin, hlcConfirmadas, modoCheckin, personaId]);

  const onAgregarFila = useCallback(() => setFilas((p) => [...p, emptyCheckinFila()]), []);
  const onQuitarFila = useCallback((key) => {
    setFilas((p) => (p.length <= 1 ? p : p.filter((f) => f.key !== key)));
  }, []);
  const onCambiarFila = useCallback((key, patch) => {
    setFilas((p) => p.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, []);

  const onDiasBChange = useCallback((articuloId, value) => {
    setDiasPorArticuloB((prev) => ({ ...prev, [articuloId]: value }));
  }, []);

  const onSaldoCChange = useCallback((articuloId, value) => {
    setSaldosPorArticuloC((prev) => ({ ...prev, [articuloId]: value }));
  }, []);

  const onGuardarParcialA = useCallback(async () => {
    const per = assertBase();
    if (!per) return;
    const rectificarLao = esRectificacion || confirmarRecargaGlobal || confirmarRecargaLao;
    if (bloqueoGlobalSinRecarga && !rectificarLao) {
      toast.error("Check-in global cerrado. Elegí «Rectificación» o autorizá recarga global.");
      return;
    }
    if ((yaCheckinGlobal || yaCheckinLao) && !rectificarLao) {
      toast.error(
        "Este agente ya tiene check-in. Elegí «Rectificación» o marcá la autorización de recarga antes de guardar LAO.",
      );
      return;
    }
    if (!laoArticulo) {
      toast.error("No se encontró el artículo LAO en configuración.");
      return;
    }
    const { ok, errors, payloadFilas } = validateCheckinFilas(filas, anioA);
    if (!ok) {
      toast.error(errors[0] || "Revisá las filas LAO.");
      return;
    }
    setEnviando(true);
    try {
      const resp = await callPersistirCheckinLaoBolsas({
        persona_id: per,
        articulo_id: laoArticulo.id,
        anio_corte_a: anioA,
        hlc_confirmadas_completas: rectificarLao ? false : true,
        filas: payloadFilas,
        ...(rectificarLao ? { forzar_recarga_global: true } : {}),
        ...(rectificarLao ? { rectificacion_saldo: true } : {}),
      });
      setUltimoResultado(resp?.data);
      toast.success(
        rectificarLao
          ? `LAO rectificado: ${payloadFilas.length} bolsa(s) actualizada(s).`
          : `LAO: ${payloadFilas.length} bolsa(s) guardada(s).`,
      );
      await refreshPersona(per);
      setConfirmarRecargaLao(false);
    } catch (e) {
      toast.error(callableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [
    anioA,
    assertBase,
    confirmarRecargaGlobal,
    confirmarRecargaLao,
    bloqueoGlobalSinRecarga,
    filas,
    esRectificacion,
    laoArticulo,
    refreshPersona,
    yaCheckinGlobal,
    yaCheckinLao,
  ]);

  const onGuardarParcialB = useCallback(async () => {
    const per = assertBase();
    if (!per || anioA == null) return;

    const collected = collectPendientesPatronB({
      articulosB,
      articulos,
      diasPorArticuloB,
      anioA,
    });
    if (!collected.ok) {
      toast.error(collected.message);
      return;
    }

    setEnviando(true);
    try {
      const resp = await callPersistirCheckinSaldoEstandarLote({
        persona_id: per,
        patron: "B",
        anio_corte_a: anioA,
        items: collected.items,
        ...(forzarRecarga ? { forzar_recarga_global: true } : {}),
        ...(esRectificacion ? { rectificacion_saldo: true } : {}),
      });
      const n = Number(resp?.data?.count) || collected.items.length;
      toast.success(
        esRectificacion
          ? `Rectificación B: ${n} artículo(s) en un solo guardado.`
          : `Patrón B: ${n} artículo(s) guardado(s) (atómico).`,
      );
      await refreshPersona(per);
    } catch (e) {
      toast.error(callableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [anioA, articulos, articulosB, assertBase, diasPorArticuloB, esRectificacion, forzarRecarga, refreshPersona]);

  const onGuardarParcialC = useCallback(async () => {
    const per = assertBase();
    if (!per || anioA == null) return;

    const collected = collectPendientesPatronC({
      articulosC,
      articulos,
      saldosPorArticuloC,
    });
    if (!collected.ok) {
      toast.error(collected.message);
      return;
    }

    setEnviando(true);
    try {
      const resp = await callPersistirCheckinSaldoEstandarLote({
        persona_id: per,
        patron: "C",
        anio_corte_a: anioA,
        items: collected.items,
        ...(forzarRecarga ? { forzar_recarga_global: true } : {}),
        ...(esRectificacion ? { rectificacion_saldo: true } : {}),
      });
      const n = Number(resp?.data?.count) || collected.items.length;
      toast.success(
        esRectificacion
          ? `Rectificación C: ${n} artículo(s) en un solo guardado.`
          : `Patrón C: ${n} artículo(s) guardado(s) (atómico).`,
      );
      await refreshPersona(per);
    } catch (e) {
      toast.error(callableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [anioA, articulos, articulosC, assertBase, esRectificacion, forzarRecarga, refreshPersona, saldosPorArticuloC]);

  const lineasResumen = useMemo(() => {
    const filasLao = [];
    if (anioA != null) {
      const { payloadFilas } = validateCheckinFilas(filas, anioA);
      if (payloadFilas?.length) {
        for (const f of payloadFilas) {
          filasLao.push({
            anio_origen: f.anio_origen,
            dias_disponibles: f.dias_disponibles,
          });
        }
      }
    }

    const filasB = [];
    if (anioA != null) {
      for (const [artId, rawVal] of Object.entries(diasPorArticuloB)) {
        const raw = String(rawVal ?? "").trim();
        if (raw === "") continue;
        const a =
          articulosB.find((x) => x.id === artId) || articulos.find((x) => x.id === artId);
        if (!a) continue;
        const v = validateCheckinEstandar({
          anioCiclo: String(anioA),
          diasConsumidosPrevios: raw,
          cupoDiasPorCiclo: a.cupoDiasPorCiclo ?? null,
          anioA,
        });
        if (!v.ok) continue;
        const cupo = a.cupoDiasPorCiclo != null ? Number(a.cupoDiasPorCiclo) : null;
        const saldo =
          cupo != null ? Math.max(0, cupo - v.usados) : v.disponibleInicial ?? null;
        if (saldo == null) continue;
        filasB.push({ codigo: a.codigo, diasUsados: v.usados, saldo, cupo });
      }
    }

    const filasC = [];
    for (const [artId, rawVal] of Object.entries(saldosPorArticuloC)) {
      const raw = String(rawVal ?? "").trim();
      if (raw === "") continue;
      const a =
        articulosC.find((x) => x.id === artId) || articulos.find((x) => x.id === artId);
      if (!a) continue;
      const vc = validateCheckinPatronC(raw);
      if (!vc.ok) continue;
      filasC.push({ codigo: a.codigo, saldo: vc.saldo });
    }

    return buildCheckinResumen({
      filasLao,
      filasB,
      filasC,
      anioA: anioA ?? 0,
      personaLabel: personaSeleccionadaLabel,
    });
  }, [
    anioA,
    articulos,
    articulosB,
    articulosC,
    diasPorArticuloB,
    filas,
    personaSeleccionadaLabel,
    saldosPorArticuloC,
  ]);

  const advertenciasCierre = useMemo(
    () =>
      buildCheckinCierreAdvertencias({
        esNuevoCheckin,
        hlcConfirmadas,
        lineasResumen,
        tieneBolsasFirestore,
      }),
    [esNuevoCheckin, hlcConfirmadas, lineasResumen, tieneBolsasFirestore],
  );

  const todosAckCierreMarcados = useMemo(() => {
    if (!advertenciasCierre.length) return true;
    return advertenciasCierre.every((a) => modalCierreAcks[a.id] === true);
  }, [advertenciasCierre, modalCierreAcks]);

  const onAbrirCierreGlobal = useCallback(() => {
    if (esRectificacion) {
      toast.error("En rectificación no se vuelve a cerrar el check-in global.");
      return;
    }
    const per = assertBase();
    if (!per) return;
    const adv = buildCheckinCierreAdvertencias({
      esNuevoCheckin,
      hlcConfirmadas,
      lineasResumen,
      tieneBolsasFirestore,
    });
    const ackInit = {};
    adv.forEach((a) => {
      ackInit[a.id] = false;
    });
    setModalCierreAcks(ackInit);
    setModalGlobal({ open: true, step: 1 });
  }, [
    assertBase,
    esRectificacion,
    esNuevoCheckin,
    hlcConfirmadas,
    lineasResumen,
    tieneBolsasFirestore,
  ]);

  const onCerrarModal = useCallback(() => {
    setModalGlobal({ open: false, step: 1 });
    setModalCierreAcks({});
  }, []);

  const onModalContinuar = useCallback(() => {
    setModalGlobal((m) => {
      if (m.step === 1) return { ...m, step: 2 };
      if (m.step === 2) return { ...m, step: 3 };
      return m;
    });
  }, []);

  const onToggleAckCierre = useCallback((id) => {
    setModalCierreAcks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onConfirmarCierreGlobal = useCallback(async () => {
    const per = assertBase();
    if (!per || anioA == null) return;
    setEnviando(true);
    try {
      await callCerrarCheckinGlobal({ persona_id: per, anio_corte_a: anioA });
      toast.success("Check-in global cerrado.");
      await refreshPersona(per);
      setConfirmarRecargaGlobal(false);
      setModalGlobal({ open: false, step: 1 });
      setModalCierreAcks({});
    } catch (e) {
      toast.error(callableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [anioA, assertBase, refreshPersona]);

  const formularioBloqueado = bloqueoGlobalSinRecarga || necesitaElegirModo || !prerequisitosOk;
  const anioALectura =
    esRectificacion && personaData?.anio_corte_portal_a != null
      ? Number(personaData.anio_corte_portal_a)
      : null;

  return {
    copyAnioA: CHECKIN_COPY_ANIO_A,
    categoriaTab,
    setCategoriaTab,
    prerequisitosOk,
    formularioBloqueado,
    articulos,
    loadingArticulos,
    laoArticulo,
    articulosB,
    articulosProblemaB,
    loadingB,
    articulosC,
    articulosProblemaC,
    loadingC,
    personaWrapRef,
    loadPersonas,
    personaOpen,
    setPersonaOpen,
    personaQuery,
    setPersonaQuery,
    personaId,
    setPersonaId: setPersonaIdCheckin,
    personaSeleccionadaLabel,
    personaOptionsFiltradas,
    personaData,
    loadingPersonaData,
    confirmarRecargaLao,
    setConfirmarRecargaLao,
    confirmarRecargaGlobal,
    setConfirmarRecargaGlobal,
    bloqueoGlobalSinRecarga,
    yaCheckinGlobal,
    anioCorteA,
    setAnioCorteA,
    anioA,
    anioAValido: anioA != null,
    hlcConfirmadas,
    setHlcConfirmadas,
    filas,
    onAgregarFila,
    onQuitarFila,
    onCambiarFila,
    diasPorArticuloB,
    onDiasBChange,
    saldosPorArticuloC,
    onSaldoCChange,
    onGuardarParcialA,
    onGuardarParcialB,
    onGuardarParcialC,
    enviando,
    ultimoResultado,
    modalGlobal,
    advertenciasCierre,
    modalCierreAcks,
    todosAckCierreMarcados,
    lineasResumen,
    onAbrirCierreGlobal,
    onCerrarModal,
    onModalContinuar,
    onToggleAckCierre,
    onConfirmarCierreGlobal,
    loadingPrecarga,
    hayCheckinPrevio,
    necesitaElegirModo,
    modoCheckin,
    setModoCheckin,
    esRectificacion,
    esNuevoCheckin,
    anioALectura,
  };
}
