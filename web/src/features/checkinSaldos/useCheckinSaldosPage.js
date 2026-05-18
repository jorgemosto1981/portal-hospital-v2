import { useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";

import { LAO_ARTICULO_ID } from "../../constants/laoArticulo.js";
import { CHECKIN_COPY_ANIO_A } from "../../../../shared/utils/laoVersionResolver.js";
import { PATRON_SALDO_B, PATRON_SALDO_C } from "./resolvePatronSaldo.js";
import { useArticulosActivosCheckin } from "./useArticulosActivosCheckin.js";
import { useArticulosPorPatron } from "./useArticulosPorPatron.js";
import { useCheckinFormState } from "./useCheckinFormState.js";
import { useCheckinPersonaFlow } from "./useCheckinPersonaFlow.js";
import { useCheckinGuardados } from "./useCheckinGuardados.js";
import { useCheckinResumenCierre } from "./useCheckinResumenCierre.js";

export function useCheckinSaldosPage() {
  const { articulos, loadingArticulos } = useArticulosActivosCheckin();
  const form = useCheckinFormState();

  const precargaSetters = useMemo(
    () => ({
      setFilas: form.setFilas,
      setDiasPorArticuloB: form.setDiasPorArticuloB,
      setSaldosPorArticuloC: form.setSaldosPorArticuloC,
    }),
    [form.setFilas, form.setDiasPorArticuloB, form.setSaldosPorArticuloC],
  );

  const resetSideRef = useRef(() => {});
  const onPersonaChange = useCallback(() => {
    resetSideRef.current();
  }, []);

  const p = useCheckinPersonaFlow({
    anioA: form.anioA,
    setAnioCorteA: form.setAnioCorteA,
    onPersonaChange,
    precargaSetters,
  });

  const prerequisitosOk =
    Boolean(p.personaId) &&
    form.anioA != null &&
    p.modoCheckin != null &&
    (p.esNuevoCheckin ? form.hlcConfirmadas : true);

  const {
    articulosPatron: articulosB,
    articulosConProblema: articulosProblemaB,
    loadingPatronList: loadingB,
  } = useArticulosPorPatron(articulos, PATRON_SALDO_B, form.anioA, prerequisitosOk && form.categoriaTab === "B");

  const {
    articulosPatron: articulosC,
    articulosConProblema: articulosProblemaC,
    loadingPatronList: loadingC,
  } = useArticulosPorPatron(articulos, PATRON_SALDO_C, form.anioA, prerequisitosOk && form.categoriaTab === "C");

  const laoArticulo = useMemo(
    () => articulos.find((a) => a.id === LAO_ARTICULO_ID) || null,
    [articulos],
  );

  const assertBase = useCallback(() => {
    const per = String(p.personaId || "").trim();
    if (!/^per_/i.test(per)) {
      toast.error("Seleccioná un agente.");
      return null;
    }
    if (!p.modoCheckin) {
      toast.error("Elegí si es check-in nuevo o rectificación.");
      return null;
    }
    if (p.esNuevoCheckin && !form.hlcConfirmadas) {
      toast.error("Confirmá las HLC antes del check-in nuevo.");
      return null;
    }
    if (form.anioA == null) {
      toast.error("Indicá el año de corte A.");
      return null;
    }
    if (p.bloqueoGlobalSinRecarga) {
      toast.error(
        "Check-in global cerrado. Elegí «Rectificación» arriba o marcá «Autorizo recargar bolsas» en el banner.",
      );
      return null;
    }
    return per;
  }, [form.anioA, form.hlcConfirmadas, p.bloqueoGlobalSinRecarga, p.esNuevoCheckin, p.modoCheckin, p.personaId]);

  const guardadosCtx = useMemo(
    () => ({
      assertBase,
      anioA: form.anioA,
      filas: form.filas,
      diasPorArticuloB: form.diasPorArticuloB,
      saldosPorArticuloC: form.saldosPorArticuloC,
      articulos,
      articulosB,
      articulosC,
      laoArticulo,
      esRectificacion: p.esRectificacion,
      confirmarRecargaGlobal: p.confirmarRecargaGlobal,
      confirmarRecargaLao: p.confirmarRecargaLao,
      bloqueoGlobalSinRecarga: p.bloqueoGlobalSinRecarga,
      yaCheckinGlobal: p.yaCheckinGlobal,
      yaCheckinLao: p.yaCheckinLao,
      forzarRecarga: p.forzarRecarga,
      refreshPersona: p.refreshPersona,
      setConfirmarRecargaLao: p.setConfirmarRecargaLao,
    }),
    [assertBase, form, articulos, articulosB, articulosC, laoArticulo, p],
  );

  const guardados = useCheckinGuardados(guardadosCtx);

  const cierreCtx = useMemo(
    () => ({
      anioA: form.anioA,
      filas: form.filas,
      diasPorArticuloB: form.diasPorArticuloB,
      saldosPorArticuloC: form.saldosPorArticuloC,
      articulos,
      articulosB,
      articulosC,
      personaSeleccionadaLabel: p.personaSeleccionadaLabel,
      esNuevoCheckin: p.esNuevoCheckin,
      esRectificacion: p.esRectificacion,
      hlcConfirmadas: form.hlcConfirmadas,
      tieneBolsasFirestore: p.tieneBolsasFirestore,
      assertBase,
      refreshPersona: p.refreshPersona,
      setConfirmarRecargaGlobal: p.setConfirmarRecargaGlobal,
      setEnviando: guardados.setEnviando,
    }),
    [form, articulos, articulosB, articulosC, p, assertBase, guardados.setEnviando],
  );

  const cierre = useCheckinResumenCierre(cierreCtx);

  resetSideRef.current = () => {
    form.resetFormulario();
    guardados.resetGuardados();
    cierre.resetCierre();
  };

  useEffect(() => {
    if (form.anioA == null) return;
    form.setFilas((prev) =>
      prev.map((f) => {
        const y = Number(f.anio_origen);
        if (f.anio_origen !== "" && Number.isInteger(y) && y >= form.anioA) {
          return { ...f, anio_origen: "" };
        }
        return f;
      }),
    );
  }, [form.anioA, form.setFilas]);

  const formularioBloqueado = p.bloqueoGlobalSinRecarga || p.necesitaElegirModo || !prerequisitosOk;

  return {
    copyAnioA: CHECKIN_COPY_ANIO_A,
    categoriaTab: form.categoriaTab,
    setCategoriaTab: form.setCategoriaTab,
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
    personaWrapRef: p.personaWrapRef,
    loadPersonas: p.loadPersonas,
    personaOpen: p.personaOpen,
    setPersonaOpen: p.setPersonaOpen,
    personaQuery: p.personaQuery,
    setPersonaQuery: p.setPersonaQuery,
    personaId: p.personaId,
    setPersonaId: p.setPersonaIdCheckin,
    personaSeleccionadaLabel: p.personaSeleccionadaLabel,
    personaOptionsFiltradas: p.personaOptionsFiltradas,
    personaData: p.personaData,
    loadingPersonaData: p.loadingPersonaData,
    confirmarRecargaLao: p.confirmarRecargaLao,
    setConfirmarRecargaLao: p.setConfirmarRecargaLao,
    confirmarRecargaGlobal: p.confirmarRecargaGlobal,
    setConfirmarRecargaGlobal: p.setConfirmarRecargaGlobal,
    bloqueoGlobalSinRecarga: p.bloqueoGlobalSinRecarga,
    yaCheckinGlobal: p.yaCheckinGlobal,
    anioCorteA: form.anioCorteA,
    setAnioCorteA: form.setAnioCorteA,
    anioA: form.anioA,
    anioAValido: form.anioA != null,
    hlcConfirmadas: form.hlcConfirmadas,
    setHlcConfirmadas: form.setHlcConfirmadas,
    filas: form.filas,
    onAgregarFila: form.onAgregarFila,
    onQuitarFila: form.onQuitarFila,
    onCambiarFila: form.onCambiarFila,
    diasPorArticuloB: form.diasPorArticuloB,
    onDiasBChange: form.onDiasBChange,
    saldosPorArticuloC: form.saldosPorArticuloC,
    onSaldoCChange: form.onSaldoCChange,
    onGuardarParcialA: guardados.onGuardarParcialA,
    onGuardarParcialB: guardados.onGuardarParcialB,
    onGuardarParcialC: guardados.onGuardarParcialC,
    enviando: guardados.enviando,
    ultimoResultado: guardados.ultimoResultado,
    modalGlobal: cierre.modalGlobal,
    advertenciasCierre: cierre.advertenciasCierre,
    modalCierreAcks: cierre.modalCierreAcks,
    todosAckCierreMarcados: cierre.todosAckCierreMarcados,
    lineasResumen: cierre.lineasResumen,
    onAbrirCierreGlobal: cierre.onAbrirCierreGlobal,
    onModalContinuar: cierre.onModalContinuar,
    onToggleAckCierre: cierre.onToggleAckCierre,
    onConfirmarCierreGlobal: cierre.onConfirmarCierreGlobal,
    onCerrarModal: cierre.onCerrarModal,
    loadingPrecarga: p.loadingPrecarga,
    hayCheckinPrevio: p.hayCheckinPrevio,
    necesitaElegirModo: p.necesitaElegirModo,
    modoCheckin: p.modoCheckin,
    setModoCheckin: p.setModoCheckin,
    esRectificacion: p.esRectificacion,
    esNuevoCheckin: p.esNuevoCheckin,
    anioALectura: p.anioALectura,
  };
}
