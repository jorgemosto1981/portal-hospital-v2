import { useCallback, useEffect, useMemo, useState } from "react";

import { callListarContextoPlanGrupo } from "../../services/callables.js";
import { leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";
import {
  enrichCapaTeoricaLabels,
  turnosDisponiblesDesdeRegimen,
} from "./enrichCapaTeoricaLabels.js";
import { mensajeErrorCapaTeorico, resumenTeoricoCorta } from "./grillaCeldaTeorico.js";
import { capaElegibleIntercambioGuardia, previewIntercambioGuardia, validarMismoRegimenHorario } from "./grillaCoberturaParcialPreview.js";
import { regimenHorarioIdParaFecha } from "./grillaRegimenHorarioPorFecha.js";

/**
 * Capa teórica agente 2 + régimen + gate A1/A1b on-demand.
 * @param {{
 *   personaDestinoId: string;
 *   fechaDestinoYmd: string;
 *   grupoId: string;
 *   periodo: string;
 *   regimenHorarioIdOrigen?: string;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   enabled?: boolean;
 * }} params
 */
export function useIntercambioGuardiaDestino({
  personaDestinoId,
  fechaDestinoYmd,
  grupoId,
  periodo,
  regimenHorarioIdOrigen = "",
  opsPendientes = [],
  enabled = true,
}) {
  const [capaDestino, setCapaDestino] = useState(null);
  const [turnosRegimenDestino, setTurnosRegimenDestino] = useState(/** @type {Record<string, object>} */ ({}));
  const [regimenHorarioDestinoId, setRegimenHorarioDestinoId] = useState("");
  const [regimenesIdx, setRegimenesIdx] = useState(/** @type {Record<string, object>} */ ({}));
  const [segmentosDestino, setSegmentosDestino] = useState([]);
  const [expectedVersionToken, setExpectedVersionToken] = useState("");
  const [personaLabel, setPersonaLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    if (!enabled || !personaDestinoId || !fechaDestinoYmd || !grupoId) {
      setCapaDestino(null);
      setSegmentosDestino([]);
      setTurnosRegimenDestino({});
      setRegimenHorarioDestinoId("");
      setRegimenesIdx({});
      setExpectedVersionToken("");
      setPersonaLabel("");
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [capaRes, ctx] = await Promise.all([
        leerCapaTeoricaCelda(personaDestinoId, fechaDestinoYmd, grupoId),
        callListarContextoPlanGrupo({ grupo_id: grupoId, periodo }),
      ]);
      const capa = capaRes?.capa_teorica ?? capaRes?.capa_teorica_grupo ?? null;
      const regimenes = ctx?.data?.regimenes || {};
      setRegimenesIdx(regimenes);
      const personas = ctx?.data?.personas_grupo || [];
      const hlg = personas.find((p) => p.persona_id === personaDestinoId);
      setPersonaLabel(hlg?.persona_label || personaDestinoId);
      const regimenDest = regimenHorarioIdParaFecha(personas, personaDestinoId, fechaDestinoYmd);
      setRegimenHorarioDestinoId(regimenDest);
      const regCheck = validarMismoRegimenHorario(regimenHorarioIdOrigen, regimenDest, regimenes);
      if (!regCheck.ok) {
        setCapaDestino(null);
        setSegmentosDestino([]);
        setTurnosRegimenDestino({});
        setExpectedVersionToken("");
        setError(regCheck.error || "Régimen horario incompatible.");
        return;
      }
      const turnosMap = turnosDisponiblesDesdeRegimen(regimenes, regimenDest);
      setTurnosRegimenDestino(turnosMap);
      setCapaDestino(capa);
      setExpectedVersionToken(
        capaRes?.concurrencia?.expected_version_token || capaRes?.concurrencia?.vis_ultima_sync || "",
      );
      const preview = previewIntercambioGuardia(
        capa,
        opsPendientes,
        personaDestinoId,
        fechaDestinoYmd,
        turnosMap,
      );
      const activos = preview.segmentosCapa.filter((s) =>
        preview.segmentoIds.includes(String(s.segmento_id || "")),
      );
      setSegmentosDestino(enrichCapaTeoricaLabels(activos, turnosMap));
      const eleg = capaElegibleIntercambioGuardia(capa, preview, personaDestinoId);
      if (!eleg.ok) {
        setError(eleg.error || "El día destino no es elegible para intercambio.");
      }
    } catch (e) {
      setCapaDestino(null);
      setSegmentosDestino([]);
      setExpectedVersionToken("");
      setError(mensajeErrorCapaTeorico(e));
    } finally {
      setLoading(false);
    }
  }, [enabled, personaDestinoId, fechaDestinoYmd, grupoId, periodo, regimenHorarioIdOrigen, opsPendientes]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const previewDestino = useMemo(
    () => previewIntercambioGuardia(
      capaDestino,
      opsPendientes,
      personaDestinoId,
      fechaDestinoYmd,
      turnosRegimenDestino,
    ),
    [capaDestino, opsPendientes, personaDestinoId, fechaDestinoYmd, turnosRegimenDestino],
  );

  const elegibilidad = useMemo(
    () => capaElegibleIntercambioGuardia(capaDestino, previewDestino, personaDestinoId),
    [capaDestino, previewDestino],
  );

  const resumenDestino = useMemo(
    () => resumenTeoricoCorta(capaDestino, turnosRegimenDestino) || "—",
    [capaDestino, turnosRegimenDestino],
  );

  return {
    capaDestino,
    segmentosDestino,
    turnosRegimenDestino,
    regimenHorarioDestinoId,
    regimenesIdx,
    expectedVersionToken,
    personaLabel,
    loading,
    error,
    elegibilidad,
    resumenDestino,
    previewDestino,
    recargar,
  };
}
