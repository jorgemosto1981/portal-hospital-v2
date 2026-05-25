import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { LAO_ARTICULO_ID } from "../../constants/laoArticulo.js";
import { callObtenerSaldosCheckinPersona } from "../../services/callables.js";
import { emptyCheckinFila } from "./checkinFilasUtils.js";
import { parseSaldosCheckinPrecarga } from "./parseSaldosCheckinPrecarga.js";

/**
 * @param {string} personaId
 * @param {number | null} anioA
 * @param {{
 *   setFilas: (v: import('./checkinFilasUtils.js').CheckinFila[] | ((p: import('./checkinFilasUtils.js').CheckinFila[]) => import('./checkinFilasUtils.js').CheckinFila[])) => void,
 *   setDiasPorArticuloB: Function,
 *   setSaldosPorArticuloC: Function,
 * }} setters
 */
export function useCheckinPrecarga(personaId, anioA, setters) {
  const [loadingPrecarga, setLoadingPrecarga] = useState(false);
  const [tieneBolsasFirestore, setTieneBolsasFirestore] = useState(false);
  const precargaKeyRef = useRef("");
  const precargaToastKeyRef = useRef("");

  const resetPrecargaKeys = () => {
    precargaKeyRef.current = "";
    precargaToastKeyRef.current = "";
    setTieneBolsasFirestore(false);
    setLoadingPrecarga(false);
  };

  useEffect(() => {
    const per = String(personaId || "").trim();
    if (!/^per_/i.test(per) || anioA == null) {
      precargaKeyRef.current = "";
      setters.setFilas([emptyCheckinFila()]);
      setters.setDiasPorArticuloB({});
      setters.setSaldosPorArticuloC({});
      setLoadingPrecarga(false);
      return;
    }

    const key = `${per}:${anioA}`;
    if (precargaKeyRef.current === key) return;

    let cancelled = false;
    setLoadingPrecarga(true);

    void callObtenerSaldosCheckinPersona({ persona_id: per, anio_corte_a: anioA })
      .then((resp) => {
        if (cancelled) return;
        const docs = Array.isArray(resp?.data?.docs) ? resp.data.docs : [];
        const parsed = parseSaldosCheckinPrecarga({
          saldoDocs: docs,
          anioA,
          laoArticuloId: LAO_ARTICULO_ID,
        });
        setters.setFilas(parsed.filasLao);
        setters.setDiasPorArticuloB(parsed.diasPorArticuloB);
        setters.setSaldosPorArticuloC(parsed.saldosPorArticuloC);
        precargaKeyRef.current = key;
        const n =
          parsed.filasLao.filter((f) => String(f.anio_origen || "").trim() !== "").length +
          Object.keys(parsed.diasPorArticuloB).length +
          Object.keys(parsed.saldosPorArticuloC).length;
        setTieneBolsasFirestore(n > 0);
        if (n > 0 && precargaToastKeyRef.current !== key) {
          precargaToastKeyRef.current = key;
          toast.success("Saldos precargados desde bolsas existentes.");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e?.message || "No se pudieron leer saldos del agente.");
          setters.setFilas([emptyCheckinFila()]);
          setters.setDiasPorArticuloB({});
          setters.setSaldosPorArticuloC({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPrecarga(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personaId, anioA, setters]);

  return { loadingPrecarga, tieneBolsasFirestore, resetPrecargaKeys };
}
