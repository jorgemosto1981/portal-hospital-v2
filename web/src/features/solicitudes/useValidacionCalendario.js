import { useEffect, useMemo, useState } from "react";

import { readModoCalculo } from "../../../../shared/utils/modoComputoCalendario.js";
import { validarFechasArticulo } from "../../../../shared/utils/validarFechasArticulo.js";
import {
  buildIndiceEventosCalendario,
  subscribeEventosCalendarioInstitucional,
} from "../../services/calendarioInstitucionalService.js";

/**
 * Validación C1/C2/C4 en cliente (misma core que Functions).
 * @param {{
 *   versionData?: Record<string, unknown> | null,
 *   fechaDesde?: string,
 *   fechaHasta?: string,
 *   diasSolicitados?: number,
 *   omitirHorizonte?: boolean,
 * }} params
 */
export function useValidacionCalendario({
  versionData = null,
  fechaDesde = "",
  fechaHasta = "",
  diasSolicitados = 1,
  omitirHorizonte = false,
}) {
  const [eventosDocs, setEventosDocs] = useState([]);
  const modoCalc = useMemo(() => readModoCalculo(versionData), [versionData]);
  const usaCalendario = modoCalc.usaCalendario;
  const necesitaEventosFirestore = modoCalc.incluyeFeriadosInstitucionales;

  useEffect(() => {
    if (!necesitaEventosFirestore) {
      setEventosDocs([]);
      return undefined;
    }
    const unsub = subscribeEventosCalendarioInstitucional(setEventosDocs);
    return () => unsub();
  }, [necesitaEventosFirestore]);

  const resultado = useMemo(() => {
    if (!fechaDesde) {
      return { ok: true, mensajes: [], codigos: [], resumen: null, fecha_hasta: fechaHasta || fechaDesde };
    }
    const indice = necesitaEventosFirestore
      ? buildIndiceEventosCalendario(eventosDocs)
      : buildIndiceEventosCalendario([]);
    return validarFechasArticulo({
      versionData: versionData || {},
      fechaDesde,
      fechaHasta,
      diasSolicitados,
      omitirHorizonte,
      indice,
    });
  }, [
    usaCalendario,
    necesitaEventosFirestore,
    versionData,
    fechaDesde,
    fechaHasta,
    diasSolicitados,
    omitirHorizonte,
    eventosDocs,
  ]);

  return {
    modoComputo: modoCalc.modo,
    reglaComputoDiasId: modoCalc.reglaId,
    usaCalendario,
    incluyeFeriadosInstitucionales: modoCalc.incluyeFeriadosInstitucionales,
    ok: resultado.ok === true,
    mensajes: resultado.mensajes || [],
    codigos: resultado.codigos || [],
    resumen: resultado.resumen || null,
    fechaHastaSugerida: resultado.fecha_hasta || fechaHasta || fechaDesde,
  };
}
