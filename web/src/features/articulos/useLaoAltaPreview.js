import { useEffect, useMemo, useState } from "react";

import { callSimularLaoPreview } from "../../services/callables.js";

const ART_RE = /^art_[0-9A-HJKMNP-TV-Z]{26}$/i;
const VER_RE = /^ver_[0-9A-HJKMNP-TV-Z]{26}$/i;

function formatCallableError(err) {
  const msg = err && typeof err.message === "string" ? err.message : "No se pudo simular.";
  const code = err && typeof err.code === "string" ? err.code : "";
  return code ? `${code}: ${msg}` : msg;
}

/**
 * Preview LAO con debounce al cambiar artículo / versión / fecha / año bolsa.
 * @param {{ articuloId: string, versionId: string, fechaDesde: string, anioOrigenBolsa: string }} params
 */
export function useLaoAltaPreview({ articuloId, versionId, fechaDesde, anioOrigenBolsa }) {
  const [simulacion, setSimulacion] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const puedeLlamar = useMemo(() => {
    const a = articuloId.trim();
    const v = versionId.trim();
    const f = fechaDesde.trim();
    const y = Number(anioOrigenBolsa);
    if (!ART_RE.test(a) || !VER_RE.test(v)) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
    if (!Number.isInteger(y) || y < 1900) return false;
    return true;
  }, [articuloId, versionId, fechaDesde, anioOrigenBolsa]);

  useEffect(() => {
    if (!puedeLlamar) {
      setSimulacion(null);
      setError(null);
      setCargando(false);
      return;
    }

    const handle = setTimeout(() => {
      setCargando(true);
      setError(null);
      void callSimularLaoPreview({
        articulo_id: articuloId.trim(),
        version_aplicada_id: versionId.trim(),
        fecha_desde: fechaDesde.trim(),
        anio_origen_bolsa: Number(anioOrigenBolsa),
      })
        .then((res) => {
          setSimulacion(res.data);
        })
        .catch((err) => {
          setSimulacion(null);
          setError(formatCallableError(err));
        })
        .finally(() => {
          setCargando(false);
        });
    }, 450);

    return () => clearTimeout(handle);
  }, [puedeLlamar, articuloId, versionId, fechaDesde, anioOrigenBolsa]);

  return { simulacion, error, cargando, puedeLlamar };
}
