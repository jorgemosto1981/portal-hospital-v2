import { useEffect, useMemo, useState } from "react";

import { callObtenerVistaPlanTurnoServicio } from "../../services/callables.js";

/**
 * Carga grilla del plan vía obtenerVistaPlanTurnoServicio (SoT: grilla_aprobada o vista calculada).
 */
export function useVistaPlanTurno(planId, enabled = true) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [grillaAprobada, setGrillaAprobada] = useState(null);
  const [agentesMeta, setAgentesMeta] = useState([]);
  const [turnoEtiquetas, setTurnoEtiquetas] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId || !enabled) {
      setPlan(null);
      setGrillaAprobada(null);
      setAgentesMeta([]);
      setTurnoEtiquetas({});
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await callObtenerVistaPlanTurnoServicio({ plan_id: planId });
        if (cancelled) return;
        const data = res.data || {};
        setPlan(data.plan || null);
        setGrillaAprobada(data.grilla_aprobada || null);
        setAgentesMeta(Array.isArray(data.agentes_meta) ? data.agentes_meta : []);
        setTurnoEtiquetas(
          data.turno_etiquetas && typeof data.turno_etiquetas === "object"
            ? data.turno_etiquetas
            : {},
        );
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "No se pudo cargar la vista del plan.");
          setPlan(null);
          setGrillaAprobada(null);
          setAgentesMeta([]);
          setTurnoEtiquetas({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId, enabled]);

  const labelsPorPersona = useMemo(() => {
    const out = {};
    for (const ag of agentesMeta) {
      if (!ag?.persona_id) continue;
      out[ag.persona_id] = { nombre: ag.nombre, dni: ag.dni };
    }
    return out;
  }, [agentesMeta]);

  const comentariosJefe = plan?.comentarios_jefe ?? null;
  const historialAprobaciones = plan?.historial_aprobaciones ?? [];

  return {
    loading,
    plan,
    grillaAprobada,
    labelsPorPersona,
    turnoEtiquetas,
    comentariosJefe,
    historialAprobaciones,
    error,
  };
}
