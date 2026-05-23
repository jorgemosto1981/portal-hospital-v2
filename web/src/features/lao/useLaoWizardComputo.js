import { useEffect, useMemo, useState } from "react";

import {
  buildIndiceEventosCalendario,
  contarDiasCorridosInclusive,
  contarDiasHabilesDesdeIndice,
  contarDiasHabilesSimpleInclusive,
  listarDiasDescontadosComputo,
  normalizarYmdCalendario,
} from "../../../../shared/utils/calendarInstitucionalCore.js";
import {
  MODO_COMPUTO_CORRIDOS,
  readModoCalculo,
} from "../../../../shared/utils/modoComputoCalendario.js";
import { validarFechasArticulo } from "../../../../shared/utils/validarFechasArticulo.js";
import { subscribeEventosCalendarioInstitucional } from "../../services/calendarioInstitucionalService.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Record<string, unknown> | null | undefined} versionComputo
 * @returns {Record<string, unknown> | null}
 */
function toVersionData(versionComputo) {
  if (!versionComputo || typeof versionComputo !== "object") return null;
  if (versionComputo.bloque_topes_plazos_computo) return versionComputo;
  return { bloque_topes_plazos_computo: versionComputo };
}

/**
 * @param {ReturnType<typeof validarFechasArticulo>} validacion
 * @param {{ dias_corridos: number, dias_habiles: number, dias_consumo: number, dias_descontados: Array<{ fecha: string, fecha_formateada: string, motivo: string }> }} preDias
 * @param {ReturnType<typeof readModoCalculo>} modoCalc
 */
function mapResumenComputo(validacion, preDias, modoCalc) {
  return {
    fecha_desde: validacion.fecha_desde,
    fecha_hasta: validacion.fecha_hasta,
    modo_computo: validacion.modo_computo || modoCalc.modo,
    regla_computo_dias_id: validacion.regla_computo_dias_id || modoCalc.reglaId,
    usa_calendario_institucional: validacion.usa_calendario_institucional === true,
    incluye_feriados_institucionales: validacion.incluye_feriados_institucionales === true,
    dias_corridos: preDias.dias_corridos,
    dias_habiles: preDias.dias_habiles,
    dias_consumo: preDias.dias_consumo,
    dias_descontados: preDias.dias_descontados,
    ok: validacion.ok === true,
    codigos: validacion.codigos || [],
    mensajes: validacion.mensajes || [],
  };
}

/**
 * Cómputo reactivo paso 2 wizard LAO (RFC §4 — solo tiempo; sin stock).
 * @param {{
 *   versionComputo?: Record<string, unknown> | null,
 *   fechaDesde?: string,
 *   fechaHasta?: string,
 *   refYmd?: string,
 *   enabled?: boolean,
 * }} params
 */
export function useLaoWizardComputo({
  versionComputo = null,
  fechaDesde = "",
  fechaHasta = "",
  refYmd = "",
  enabled = true,
}) {
  const versionData = useMemo(() => toVersionData(versionComputo), [versionComputo]);
  const modoCalc = useMemo(() => readModoCalculo(versionData), [versionData]);
  const necesitaEventosFirestore = modoCalc.incluyeFeriadosInstitucionales;

  const [eventosDocs, setEventosDocs] = useState([]);
  const [eventosReady, setEventosReady] = useState(!necesitaEventosFirestore);

  useEffect(() => {
    if (!enabled || !necesitaEventosFirestore) {
      setEventosDocs([]);
      setEventosReady(true);
      return undefined;
    }
    setEventosReady(false);
    const unsub = subscribeEventosCalendarioInstitucional((docs) => {
      setEventosDocs(docs);
      setEventosReady(true);
    });
    return () => unsub();
  }, [enabled, necesitaEventosFirestore]);

  const fechasListas =
    enabled && RX_YMD.test(fechaDesde) && RX_YMD.test(fechaHasta) && versionData != null;

  const resultado = useMemo(() => {
    if (!fechasListas || (necesitaEventosFirestore && !eventosReady)) {
      return null;
    }
    const d = normalizarYmdCalendario(fechaDesde);
    const h = normalizarYmdCalendario(fechaHasta);
    if (!d || !h) return null;

    const indice = necesitaEventosFirestore
      ? buildIndiceEventosCalendario(eventosDocs)
      : buildIndiceEventosCalendario([]);

    const diasCorridos = contarDiasCorridosInclusive(d, h);
    let diasHabiles = diasCorridos;
    let diasConsumo = diasCorridos;
    if (modoCalc.modo !== MODO_COMPUTO_CORRIDOS) {
      diasHabiles = modoCalc.incluyeFeriadosInstitucionales
        ? contarDiasHabilesDesdeIndice(d, h, indice)
        : contarDiasHabilesSimpleInclusive(d, h);
      diasConsumo = diasHabiles;
    }

    const diasDescontados = listarDiasDescontadosComputo(d, h, indice, {
      esModoCorridos: modoCalc.modo === MODO_COMPUTO_CORRIDOS,
      incluyeFeriadosInstitucionales: modoCalc.incluyeFeriadosInstitucionales,
    });

    const preDias = {
      dias_corridos: diasCorridos,
      dias_habiles: diasHabiles,
      dias_consumo: diasConsumo,
      dias_descontados: diasDescontados,
    };

    const validacion = validarFechasArticulo({
      versionData,
      fechaDesde: d,
      fechaHasta: h,
      diasSolicitados: diasConsumo,
      refYmd: refYmd || undefined,
      indice,
    });

    return { validacion, preDias };
  }, [
    fechasListas,
    necesitaEventosFirestore,
    eventosReady,
    fechaDesde,
    fechaHasta,
    versionData,
    modoCalc,
    eventosDocs,
    refYmd,
  ]);

  const isLoading = Boolean(
    enabled && fechasListas && necesitaEventosFirestore && !eventosReady,
  );

  const resumenComputo = useMemo(() => {
    if (!resultado) return null;
    return mapResumenComputo(resultado.validacion, resultado.preDias, modoCalc);
  }, [resultado, modoCalc]);

  return {
    isLoading,
    resumenComputo,
    ok: resumenComputo?.ok === true,
    codigos: resumenComputo?.codigos ?? [],
    mensajes: resumenComputo?.mensajes ?? [],
    modoComputo: modoCalc.modo,
    reglaComputoDiasId: modoCalc.reglaId,
    usaCalendario: modoCalc.usaCalendario,
    incluyeFeriadosInstitucionales: modoCalc.incluyeFeriadosInstitucionales,
  };
}
