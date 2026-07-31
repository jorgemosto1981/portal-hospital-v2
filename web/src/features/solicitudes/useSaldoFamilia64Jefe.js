import { useCallback, useEffect, useRef, useState } from "react";
import { callObtenerResumenSaldoFamilia64Jefe } from "../../services/callables.js";

/**
 * Saldo Art. 64 del titular para la bandeja del jefe. Se pide bajo demanda
 * ("ver saldo disponible"), no al expandir ni en el listado, para no sumar
 * lecturas por fila en cada página.
 * @param {string} solicitudId
 * @param {boolean} habilitado — solo trámites de familia 64 con decisión pendiente
 */
export default function useSaldoFamilia64Jefe(solicitudId, habilitado) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pedido, setPedido] = useState(false);

  const solId = String(solicitudId || "").trim();
  const vigenteRef = useRef(solId);

  // Cambiar de trámite (o perder la habilitación) descarta lo cargado y
  // deja fuera de juego a cualquier respuesta en vuelo.
  useEffect(() => {
    vigenteRef.current = habilitado ? solId : "";
    setResumen(null);
    setError("");
    setCargando(false);
    setPedido(false);
  }, [solId, habilitado]);

  const cargar = useCallback(() => {
    if (!habilitado || !/^sol_/i.test(solId)) return;
    setPedido(true);
    setCargando(true);
    setError("");
    setResumen(null);

    callObtenerResumenSaldoFamilia64Jefe({ solicitud_id: solId })
      .then((res) => {
        if (vigenteRef.current !== solId) return;
        setResumen(res?.data ?? res ?? null);
      })
      .catch((e) => {
        if (vigenteRef.current !== solId) return;
        setError(e?.message || "No se pudo consultar el saldo del agente.");
      })
      .finally(() => {
        if (vigenteRef.current === solId) setCargando(false);
      });
  }, [solId, habilitado]);

  return { resumen, cargando, error, pedido, cargar };
}
