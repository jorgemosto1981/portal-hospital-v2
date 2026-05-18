import { useCallback, useMemo, useState } from "react";

import { LAO_ANIO_CORTE_PORTAL_A } from "../../constants/laoArticulo.js";
import { emptyCheckinFila, parseAnioCorteA } from "./checkinFilasUtils.js";

export function useCheckinFormState() {
  const [categoriaTab, setCategoriaTab] = useState(/** @type {'A'|'B'|'C'} */ ("A"));
  const [anioCorteA, setAnioCorteA] = useState(String(LAO_ANIO_CORTE_PORTAL_A));
  const anioA = useMemo(() => parseAnioCorteA(anioCorteA), [anioCorteA]);

  const [hlcConfirmadas, setHlcConfirmadas] = useState(false);
  const [filas, setFilas] = useState(() => [emptyCheckinFila()]);
  const [diasPorArticuloB, setDiasPorArticuloB] = useState({});
  const [saldosPorArticuloC, setSaldosPorArticuloC] = useState({});

  const resetFormulario = useCallback(() => {
    setHlcConfirmadas(false);
    setFilas([emptyCheckinFila()]);
    setDiasPorArticuloB({});
    setSaldosPorArticuloC({});
    setCategoriaTab("A");
    setAnioCorteA(String(LAO_ANIO_CORTE_PORTAL_A));
  }, []);

  const onAgregarFila = useCallback(() => setFilas((p) => [...p, emptyCheckinFila()]), []);
  const onQuitarFila = useCallback((key) => {
    setFilas((p) => (p.length <= 1 ? p : p.filter((f) => f.key !== key)));
  }, []);
  const onCambiarFila = useCallback((key, patch) => {
    setFilas((p) => p.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, []);
  const onDiasBChange = useCallback((articuloId, value) => {
    setDiasPorArticuloB((prev) => ({ ...prev, [articuloId]: value }));
  }, []);
  const onSaldoCChange = useCallback((articuloId, value) => {
    setSaldosPorArticuloC((prev) => ({ ...prev, [articuloId]: value }));
  }, []);

  return {
    categoriaTab,
    setCategoriaTab,
    anioCorteA,
    setAnioCorteA,
    anioA,
    hlcConfirmadas,
    setHlcConfirmadas,
    filas,
    setFilas,
    diasPorArticuloB,
    saldosPorArticuloC,
    resetFormulario,
    onAgregarFila,
    onQuitarFila,
    onCambiarFila,
    onDiasBChange,
    onSaldoCChange,
  };
}
