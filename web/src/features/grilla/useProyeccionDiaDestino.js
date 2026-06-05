import { useCallback, useEffect, useMemo, useState } from "react";

import { mensajeErrorCapaTeorico } from "./grillaCeldaTeorico.js";
import {
  estadoDestinoConPreview,
  resolverOpcionesDestinoTraslado,
  validarTrasladoPropioDestino,
} from "./grillaCambioTurnoPropioPreview.js";
import { leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";

/**
 * Proyección bajo demanda: capa API del día destino + ops pendientes (B-N1).
 * @param {{
 *   personaId: string;
 *   fechaOrigenYmd?: string;
 *   fechaDestinoYmd: string;
 *   capaOrigen?: unknown;
 *   grupoId: string;
 *   opsPendientes: Array<Record<string, unknown>>;
 *   segmentosTrasladar?: string[];
 *   turnoIdDestino?: string;
 *   turnosIdDestino?: string[];
 *   turnosRegimenPorId?: Record<string, object> (turnos_disponibles del regimen del agente)
 *   enabled?: boolean;
 * }} params
 */
export function useProyeccionDiaDestino({
  personaId,
  fechaOrigenYmd = "",
  fechaDestinoYmd,
  capaOrigen = null,
  grupoId,
  opsPendientes,
  segmentosTrasladar = [],
  turnoIdDestino = "",
  turnosIdDestino,
  turnosRegimenPorId = {},
  enabled = true,
}) {
  const turnosPorId = turnosRegimenPorId;
  const [capaDestino, setCapaDestino] = useState(null);
  const [expectedVersionToken, setExpectedVersionToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    if (!enabled || !personaId || !fechaDestinoYmd || !grupoId) return;
    setLoading(true);
    setError("");
    try {
      const data = await leerCapaTeoricaCelda(personaId, fechaDestinoYmd, grupoId);
      setCapaDestino(data?.capa_teorica ?? data?.capa_teorica_grupo ?? null);
      setExpectedVersionToken(
        data?.concurrencia?.expected_version_token || data?.concurrencia?.vis_ultima_sync || "",
      );
    } catch (e) {
      setCapaDestino(null);
      setExpectedVersionToken("");
      setError(mensajeErrorCapaTeorico(e));
    } finally {
      setLoading(false);
    }
  }, [enabled, personaId, fechaDestinoYmd, grupoId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const estadoActual = useMemo(() => {
    if (!fechaDestinoYmd || !personaId) {
      return { segmentoIds: [], horas: 0, etiqueta: "—" };
    }
    return estadoDestinoConPreview(capaDestino, opsPendientes, personaId, fechaDestinoYmd, turnosPorId);
  }, [capaDestino, opsPendientes, personaId, fechaDestinoYmd, turnosPorId]);

  const destinoTraslado = useMemo(() => {
    if (!fechaDestinoYmd || !personaId) {
      return {
        opciones: [],
        avisoIntermedio: "",
        modoMulti: false,
        cantidadRequerida: 0,
        errorSinOpciones: "",
      };
    }
    return resolverOpcionesDestinoTraslado({
      capaDestino,
      opsPendientes,
      personaId,
      fechaDestinoYmd,
      turnosPorId,
      segmentosTrasladar,
    });
  }, [capaDestino, opsPendientes, personaId, fechaDestinoYmd, turnosPorId, segmentosTrasladar]);

  const turnosIncorporables = destinoTraslado.opciones;

  const idsDestino = useMemo(() => {
    if (Array.isArray(turnosIdDestino) && turnosIdDestino.length) {
      return turnosIdDestino.map(String).filter(Boolean);
    }
    const uno = String(turnoIdDestino || "").trim();
    return uno ? [uno] : [];
  }, [turnosIdDestino, turnoIdDestino]);

  const validacion = useMemo(() => {
    if (!segmentosTrasladar.length || !fechaDestinoYmd) return null;
    const modoMulti = destinoTraslado.modoMulti === true;
    if (!idsDestino.length) {
      return {
        ok: false,
        error: modoMulti
          ? `Marcá ${destinoTraslado.cantidadRequerida || segmentosTrasladar.length} turno(s) en destino.`
          : "Elegí el turno a incorporar en el día destino.",
        preview: null,
      };
    }
    return validarTrasladoPropioDestino({
      capaOrigen,
      capaDestino,
      fechaOrigenYmd: fechaOrigenYmd || fechaDestinoYmd,
      segmentosTrasladar,
      turnosIdDestino: idsDestino,
      turnoIdDestino: idsDestino[0],
      opsPendientes,
      personaId,
      fechaDestinoYmd,
      turnosPorId,
    });
  }, [
    capaOrigen,
    capaDestino,
    fechaOrigenYmd,
    segmentosTrasladar,
    idsDestino,
    destinoTraslado.modoMulti,
    destinoTraslado.cantidadRequerida,
    opsPendientes,
    personaId,
    fechaDestinoYmd,
    turnosPorId,
  ]);

  return {
    capaDestino,
    expectedVersionToken,
    loading,
    error,
    estadoActual,
    turnosIncorporables,
    destinoTraslado,
    validacion,
    recargar,
  };
}
