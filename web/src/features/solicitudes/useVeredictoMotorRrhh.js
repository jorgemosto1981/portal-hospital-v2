import { useCallback, useEffect, useRef, useState } from "react";

import { callObtenerVeredictoMotorSolicitudRrhh } from "../../services/callables.js";

/**
 * Veredicto congelado del motor para la bandeja RRHH. Se pide al desplegar el
 * bloque, no al expandir el trámite: el snapshot es grande y casi nunca se mira,
 * así que sacarlo del listado alivia las diez filas de cada página.
 * @param {string} solicitudId
 */
export default function useVeredictoMotorRrhh(solicitudId) {
  const [snapshot, setSnapshot] = useState(null);
  const [validadoEn, setValidadoEn] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pedido, setPedido] = useState(false);

  const solId = String(solicitudId || "").trim();
  const vigenteRef = useRef(solId);

  // Cambiar de trámite descarta lo cargado y deja fuera de juego a cualquier
  // respuesta en vuelo.
  useEffect(() => {
    vigenteRef.current = solId;
    setSnapshot(null);
    setValidadoEn(null);
    setError("");
    setCargando(false);
    setPedido(false);
  }, [solId]);

  const cargar = useCallback(() => {
    if (!/^sol_/i.test(solId)) return;
    setPedido(true);
    setCargando(true);
    setError("");

    callObtenerVeredictoMotorSolicitudRrhh({ solicitud_id: solId })
      .then((res) => {
        if (vigenteRef.current !== solId) return;
        const data = res?.data ?? res ?? {};
        setSnapshot(data.motor_snapshot ?? null);
        setValidadoEn(data.motor_validado_en ?? null);
      })
      .catch((e) => {
        if (vigenteRef.current !== solId) return;
        setError(e?.message || "No se pudo consultar el veredicto del motor.");
      })
      .finally(() => {
        if (vigenteRef.current === solId) setCargando(false);
      });
  }, [solId]);

  return { snapshot, validadoEn, cargando, error, pedido, cargar };
}
