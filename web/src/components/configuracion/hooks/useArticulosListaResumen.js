import { useCallback, useEffect, useState } from "react";

import { listarArticulosCfgResumen } from "../../../services/articulosCfgService.js";

/**
 * Lista de artículos cfg (resumen) para multiselect / pickers.
 */
export function useArticulosListaResumen() {
  const [rows, setRows] = useState(
    /** @type {Array<{ id: string, titulo: string, activo: boolean }>} */ ([]),
  );
  const [status, setStatus] = useState(/** @type {'idle'|'loading'|'ok'|'error'} */ ("idle"));
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const recargar = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const list = await listarArticulosCfgResumen();
      setRows(Array.isArray(list) ? list : []);
      setStatus("ok");
    } catch (e) {
      setError(e?.message || "No se pudo cargar artículos.");
      setRows([]);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { rows, status, error, recargar };
}
