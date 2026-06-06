import { useEffect, useMemo, useState } from "react";

import {
  callListarContextoPlanGrupo,
  callObtenerVistaPlanTurnoServicio,
} from "../../services/callables.js";
import {
  agentesGrillaNecesitanTramos,
  enriquecerGrillaAprobadaConPersonasGrupo,
} from "./planGrillaTramosUtils.js";

/**
 * Carga grilla del plan vía obtenerVistaPlanTurnoServicio (SoT: grilla_aprobada o vista calculada).
 */
export function useVistaPlanTurno(planId, enabled = true) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [grillaAprobada, setGrillaAprobada] = useState(null);
  const [agentesMeta, setAgentesMeta] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId || !enabled) {
      setPlan(null);
      setGrillaAprobada(null);
      setAgentesMeta([]);
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
        const planMeta = data.plan || null;
        let grilla = data.grilla_aprobada || null;

        if (
          grilla?.agentes?.length &&
          planMeta?.grupo_id &&
          planMeta?.periodo &&
          agentesGrillaNecesitanTramos(grilla.agentes)
        ) {
          try {
            const ctxRes = await callListarContextoPlanGrupo({
              grupo_id: planMeta.grupo_id,
              periodo: planMeta.periodo,
            });
            grilla = enriquecerGrillaAprobadaConPersonasGrupo(
              grilla,
              ctxRes.data?.personas_grupo,
              ctxRes.data?.regimenes,
            );
          } catch {
            /* snapshot sin tramos: se muestra grilla cruda */
          }
        }

        if (cancelled) return;
        setPlan(planMeta);
        setGrillaAprobada(grilla);
        setAgentesMeta(Array.isArray(data.agentes_meta) ? data.agentes_meta : []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "No se pudo cargar la vista del plan.");
          setPlan(null);
          setGrillaAprobada(null);
          setAgentesMeta([]);
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
      out[ag.persona_id] = {
        nombre: ag.nombre || ag.nombre_completo || ag.persona_label,
        dni: ag.dni || ag.persona_dni,
        persona_label: ag.persona_label,
      };
    }
    return out;
  }, [agentesMeta]);

  return { loading, plan, grillaAprobada, labelsPorPersona, error };
}
