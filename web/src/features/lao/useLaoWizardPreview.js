import { useEffect, useMemo, useState } from "react";

import { callSimularLaoPreview } from "../../services/callables.js";

const ART_RE = /^art_[0-9A-HJKMNP-TV-Z]{26}$/i;
const VER_RE = /^ver_[0-9A-HJKMNP-TV-Z]{26}$/i;
const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

function formatCallableError(err) {
  const msg = err && typeof err.message === "string" ? err.message : "No se pudo simular el derecho LAO.";
  const code = err && typeof err.code === "string" ? err.code : "";
  return code ? `${code}: ${msg}` : msg;
}

/**
 * @param {Record<string, unknown> | null} simulacion
 * @param {string | null} error
 * @returns {string[]}
 */
export function collectLaoPreviewMensajes(simulacion, error) {
  if (error) return [error];
  if (!simulacion || typeof simulacion !== "object") return [];
  const raw = simulacion.mensajes;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((m) => String(m)).filter(Boolean);
  }
  if (simulacion.ok === false) return [];
  if (simulacion.eligible === false) {
    const motivos = Array.isArray(simulacion.motivos_ineligibilidad)
      ? simulacion.motivos_ineligibilidad.map((m) => String(m)).filter(Boolean)
      : [];
    const errMsg =
      simulacion.error && typeof simulacion.error === "object" && simulacion.error.mensaje
        ? String(simulacion.error.mensaje)
        : "";
    if (errMsg && !motivos.includes(errMsg)) motivos.push(errMsg);
    return motivos;
  }
  return [];
}

/**
 * Preview motor LAO (paso 3 wizard) — dispara al montar con snapshot de pasos 1–2.
 */
export function useLaoWizardPreview({
  articuloId,
  personaId = "",
  versionAplicadaId,
  anioOrigenBolsa,
  fechaDesde,
  fechaHasta,
  diasSolicitados,
  enabled = true,
}) {
  const [simulacion, setSimulacion] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const puedeLlamar = useMemo(() => {
    if (!enabled) return false;
    const art = String(articuloId || "").trim();
    const ver = String(versionAplicadaId || "").trim();
    const per = String(personaId || "").trim();
    const y = Number(anioOrigenBolsa);
    const dias = Number(diasSolicitados);
    if (!ART_RE.test(art) || !VER_RE.test(ver) || !/^per_/i.test(per)) return false;
    if (!RX_YMD.test(fechaDesde) || !RX_YMD.test(fechaHasta)) return false;
    if (!Number.isInteger(y) || y < 1900) return false;
    if (!Number.isInteger(dias) || dias < 1) return false;
    return true;
  }, [
    enabled,
    articuloId,
    versionAplicadaId,
    personaId,
    anioOrigenBolsa,
    fechaDesde,
    fechaHasta,
    diasSolicitados,
  ]);

  useEffect(() => {
    if (!puedeLlamar) {
      setSimulacion(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSimulacion(null);

    void callSimularLaoPreview({
      articulo_id: articuloId.trim(),
      persona_id: personaId.trim(),
      version_aplicada_id: versionAplicadaId.trim(),
      fecha_desde: fechaDesde.trim(),
      fecha_hasta: fechaHasta.trim(),
      dias_solicitados: Number(diasSolicitados),
      anio_origen_bolsa: Number(anioOrigenBolsa),
    })
      .then((res) => {
        if (!cancelled) setSimulacion(res?.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setSimulacion(null);
          setError(formatCallableError(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    puedeLlamar,
    articuloId,
    personaId,
    versionAplicadaId,
    fechaDesde,
    fechaHasta,
    diasSolicitados,
    anioOrigenBolsa,
  ]);

  const mensajes = useMemo(() => collectLaoPreviewMensajes(simulacion, error), [simulacion, error]);

  const ok =
    !loading &&
    !error &&
    simulacion?.ok === true &&
    simulacion?.eligible !== false;

  return {
    simulacion,
    error,
    loading,
    puedeLlamar,
    ok,
    eligible: ok,
    mensajes,
    resumenComputo: simulacion?.resumen_computo ?? null,
  };
}
