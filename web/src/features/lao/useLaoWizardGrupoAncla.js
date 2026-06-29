import { useCallback, useEffect, useMemo, useState } from "react";

import { callResolverContextoLaboralSolicitud } from "../../services/callables.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;
const RX_GDT = /^gdt_/i;

/**
 * Grupos HLg vigentes para ancla de solicitud LAO (paridad 64-A).
 * @param {{ personaId?: string, fechaRefYmd?: string, enabled?: boolean, anclaAutomaticaSiMultiples?: boolean }} params
 */
export function useLaoWizardGrupoAncla({
  personaId = "",
  fechaRefYmd = "",
  enabled = true,
  anclaAutomaticaSiMultiples = false,
}) {
  const [gruposVigentes, setGruposVigentes] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [grupoAnclaId, setGrupoAnclaId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const puedeConsultar = useMemo(
    () => enabled && /^per_/i.test(String(personaId || "").trim()) && RX_YMD.test(fechaRefYmd),
    [enabled, personaId, fechaRefYmd],
  );

  const recargar = useCallback(async () => {
    if (!puedeConsultar) {
      setGruposVigentes([]);
      setGrupoAnclaId("");
      setError("");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await callResolverContextoLaboralSolicitud({
        persona_id: String(personaId).trim(),
        fecha_desde: fechaRefYmd,
      });
      const list = res?.data?.grupos_trabajo_vigentes;
      const vigentes = Array.isArray(list) ? list : [];
      setGruposVigentes(vigentes);

      const sugerido = String(res?.data?.grupo_trabajo_id_ancla_sugerido || "").trim();
      if (sugerido && vigentes.some((g) => g.grupo_de_trabajo_id === sugerido)) {
        setGrupoAnclaId(sugerido);
      } else if (vigentes.length === 1) {
        setGrupoAnclaId(String(vigentes[0]?.grupo_de_trabajo_id || ""));
      } else if (anclaAutomaticaSiMultiples && vigentes.length > 1) {
        const pick =
          sugerido && vigentes.some((g) => g.grupo_de_trabajo_id === sugerido)
            ? sugerido
            : String(vigentes[0]?.grupo_de_trabajo_id || "");
        setGrupoAnclaId(pick);
      } else {
        setGrupoAnclaId("");
      }
    } catch (e) {
      setGruposVigentes([]);
      setGrupoAnclaId("");
      setError(e && typeof e.message === "string" ? e.message : "No se pudieron cargar los grupos de trabajo.");
    } finally {
      setIsLoading(false);
    }
  }, [anclaAutomaticaSiMultiples, fechaRefYmd, puedeConsultar, personaId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const requiereSeleccionGrupo = !anclaAutomaticaSiMultiples && gruposVigentes.length > 1;
  const grupoAnclaOk = gruposVigentes.length > 0 && RX_GDT.test(grupoAnclaId);

  return {
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    requiereSeleccionGrupo,
    grupoAnclaOk,
    isLoading,
    error,
    recargar,
  };
}
