import { useCallback, useRef } from "react";

import { useCheckinPrecarga } from "./useCheckinPrecarga.js";
import { useCheckinPersonaSeleccion } from "./useCheckinPersonaSeleccion.js";
import { useCheckinPersonaDatos } from "./useCheckinPersonaDatos.js";
import { useCheckinModoCheckin } from "./useCheckinModoCheckin.js";

/**
 * Agente, precarga de bolsas, modo check-in y flags de bloqueo.
 * @param {{
 *   anioA: number | null,
 *   setAnioCorteA: (v: string) => void,
 *   onPersonaChange: () => void,
 *   precargaSetters: {
 *     setFilas: Function,
 *     setDiasPorArticuloB: Function,
 *     setSaldosPorArticuloC: Function,
 *   },
 * }} deps
 */
export function useCheckinPersonaFlow(deps) {
  const resetRef = useRef(() => {});

  const onPersonaWillChange = useCallback(() => {
    resetRef.current();
  }, []);

  const seleccion = useCheckinPersonaSeleccion({ onPersonaWillChange });
  const datos = useCheckinPersonaDatos(seleccion.personaId, deps.setAnioCorteA);

  const { loadingPrecarga, tieneBolsasFirestore, resetPrecargaKeys } = useCheckinPrecarga(
    seleccion.personaId,
    deps.anioA,
    deps.precargaSetters,
  );

  const modo = useCheckinModoCheckin({
    personaId: seleccion.personaId,
    personaData: datos.personaData,
    anioA: deps.anioA,
    loadingPrecarga,
    loadingPersonaData: datos.loadingPersonaData,
    tieneBolsasFirestore,
    setAnioCorteA: deps.setAnioCorteA,
  });

  resetRef.current = () => {
    resetPrecargaKeys();
    deps.onPersonaChange();
    modo.resetModoCheckin();
    datos.clearPersonaDatos();
    seleccion.clearBusquedaUi();
  };

  return {
    personaWrapRef: seleccion.personaWrapRef,
    loadPersonas: seleccion.loadPersonas,
    personaOpen: seleccion.personaOpen,
    setPersonaOpen: seleccion.setPersonaOpen,
    personaQuery: seleccion.personaQuery,
    setPersonaQuery: seleccion.setPersonaQuery,
    personaId: seleccion.personaId,
    setPersonaIdCheckin: seleccion.setPersonaIdCheckin,
    personaSeleccionadaLabel: seleccion.personaSeleccionadaLabel,
    personaOptionsFiltradas: seleccion.personaOptionsFiltradas,
    personaData: datos.personaData,
    loadingPersonaData: datos.loadingPersonaData,
    refreshPersona: datos.refreshPersona,
    confirmarRecargaLao: modo.confirmarRecargaLao,
    setConfirmarRecargaLao: modo.setConfirmarRecargaLao,
    confirmarRecargaGlobal: modo.confirmarRecargaGlobal,
    setConfirmarRecargaGlobal: modo.setConfirmarRecargaGlobal,
    bloqueoGlobalSinRecarga: modo.bloqueoGlobalSinRecarga,
    yaCheckinGlobal: modo.yaCheckinGlobal,
    yaCheckinLao: modo.yaCheckinLao,
    hayCheckinPrevio: modo.hayCheckinPrevio,
    necesitaElegirModo: modo.necesitaElegirModo,
    modoCheckin: modo.modoCheckin,
    setModoCheckin: modo.setModoCheckin,
    esRectificacion: modo.esRectificacion,
    esNuevoCheckin: modo.esNuevoCheckin,
    forzarRecarga: modo.forzarRecarga,
    anioALectura: modo.anioALectura,
    loadingPrecarga,
    tieneBolsasFirestore,
    resetPrecargaKeys,
  };
}
