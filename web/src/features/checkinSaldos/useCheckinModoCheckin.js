import { useCallback, useEffect, useMemo, useState } from "react";

import { LAO_ANIO_CORTE_PORTAL_A } from "../../constants/laoArticulo.js";
import { detectHayCheckinPrevio } from "./detectHayCheckinPrevio.js";

/**
 * Modo nuevo/rectificación, recargas autorizadas y bloqueos derivados.
 * @param {{
 *   personaId: string,
 *   personaData: object | null,
 *   anioA: number | null,
 *   loadingPrecarga: boolean,
 *   loadingPersonaData: boolean,
 *   tieneBolsasFirestore: boolean,
 *   setAnioCorteA: (v: string) => void,
 * }} deps
 */
export function useCheckinModoCheckin(deps) {
  const [modoCheckin, setModoCheckin] = useState(/** @type {null | 'nuevo' | 'rectificacion'} */ (null));
  const [confirmarRecargaLao, setConfirmarRecargaLao] = useState(false);
  const [confirmarRecargaGlobal, setConfirmarRecargaGlobal] = useState(false);

  const hayCheckinPrevio = useMemo(
    () => detectHayCheckinPrevio(deps.personaData, { tieneBolsas: deps.tieneBolsasFirestore }),
    [deps.personaData, deps.tieneBolsasFirestore],
  );

  const esRectificacion = modoCheckin === "rectificacion";
  const esNuevoCheckin = modoCheckin === "nuevo";
  const yaCheckinGlobalEarly = Boolean(deps.personaData?.checkin_saldos_portal_en);
  const modoNuevoInvalidoConGlobalCerrado =
    yaCheckinGlobalEarly && esNuevoCheckin && !confirmarRecargaGlobal;
  const necesitaElegirModo =
    Boolean(deps.personaId) &&
    deps.anioA != null &&
    !deps.loadingPrecarga &&
    !deps.loadingPersonaData &&
    hayCheckinPrevio &&
    (modoCheckin === null || modoNuevoInvalidoConGlobalCerrado);

  const yaCheckinGlobal = Boolean(deps.personaData?.checkin_saldos_portal_en);
  const yaCheckinLao = Boolean(deps.personaData?.checkin_lao_registrado_en);
  const bloqueoGlobalSinRecarga = yaCheckinGlobal && !confirmarRecargaGlobal && !esRectificacion;
  const forzarRecarga = esRectificacion || confirmarRecargaGlobal || confirmarRecargaLao;

  const resetModoCheckin = useCallback(() => {
    setModoCheckin(null);
    setConfirmarRecargaLao(false);
    setConfirmarRecargaGlobal(false);
    deps.setAnioCorteA(String(LAO_ANIO_CORTE_PORTAL_A));
  }, [deps.setAnioCorteA]);

  useEffect(() => {
    if (deps.loadingPrecarga || deps.loadingPersonaData || !deps.personaId || deps.anioA == null) return;
    if (!hayCheckinPrevio) {
      setModoCheckin("nuevo");
      return;
    }
    if (deps.personaData?.checkin_saldos_portal_en && modoCheckin === "nuevo" && !confirmarRecargaGlobal) {
      setModoCheckin(null);
    }
  }, [
    hayCheckinPrevio,
    deps.loadingPrecarga,
    deps.loadingPersonaData,
    deps.personaId,
    deps.anioA,
    deps.personaData?.checkin_saldos_portal_en,
    modoCheckin,
    confirmarRecargaGlobal,
  ]);

  const anioALectura =
    esRectificacion && deps.personaData?.anio_corte_portal_a != null
      ? Number(deps.personaData.anio_corte_portal_a)
      : null;

  return {
    modoCheckin,
    setModoCheckin,
    confirmarRecargaLao,
    setConfirmarRecargaLao,
    confirmarRecargaGlobal,
    setConfirmarRecargaGlobal,
    hayCheckinPrevio,
    necesitaElegirModo,
    bloqueoGlobalSinRecarga,
    yaCheckinGlobal,
    yaCheckinLao,
    esRectificacion,
    esNuevoCheckin,
    forzarRecarga,
    anioALectura,
    resetModoCheckin,
  };
}
