import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import {
  buildGrillaFocoSearchParams,
  parsePeriodoFocoUrl,
} from "../grilla/grillaMesFocoUrlUtils.js";
import { normalizeGrupoTrabajoId, RX_GDT } from "../grilla/grillaGrupoUtils.js";

/**
 * Foco GDT + período en URL para Turnos mensuales (T-05 paridad con grilla operativa).
 * La carga de datos ocurre solo tras «Ver» o deep-link con `grupo_id` válido.
 *
 * @param {{
 *   periodoPorDefecto: string;
 *   periodosPermitidos: string[];
 *   listaGruposCargando: boolean;
 *   resolverGrupoLabel: (grupoId: string) => string;
 *   onFocoListoParaCarga: (args: { grupoId: string; periodo: string; grupoLabel: string }) => void;
 * }} opts
 */
export function usePlanTurnoFocoUrl({
  periodoPorDefecto,
  periodosPermitidos,
  listaGruposCargando,
  resolverGrupoLabel,
  onFocoListoParaCarga,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ultimoFocoRef = useRef("");

  const grupoIdUrl = normalizeGrupoTrabajoId(searchParams.get("grupo_id"));
  const periodoParsed = parsePeriodoFocoUrl(searchParams.get("periodo"));
  const periodoUrl =
    periodoParsed && periodosPermitidos.includes(periodoParsed)
      ? periodoParsed
      : periodoPorDefecto;
  const tieneFocoValido = RX_GDT.test(grupoIdUrl);

  const pushFocoToUrl = useCallback(
    ({ grupoId, periodo }) => {
      const next = buildGrillaFocoSearchParams(
        { grupoId, periodo, modo: null },
        searchParams,
      );
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const grupoLabelUrl = useMemo(() => {
    if (!tieneFocoValido) return "";
    const label = resolverGrupoLabel(grupoIdUrl);
    return label && label !== grupoIdUrl ? label : grupoIdUrl;
  }, [tieneFocoValido, grupoIdUrl, resolverGrupoLabel]);

  const grupoIdQuery = searchParams.get("grupo_id");
  const periodoQuery = searchParams.get("periodo");

  useEffect(() => {
    const periodoFromQuery = parsePeriodoFocoUrl(periodoQuery);
    const periodoSync =
      periodoFromQuery && periodosPermitidos.includes(periodoFromQuery)
        ? periodoFromQuery
        : periodoPorDefecto;
    const grupoSync = normalizeGrupoTrabajoId(grupoIdQuery);
    if (!RX_GDT.test(grupoSync)) return;
    if (listaGruposCargando) return;
    const key = `${periodoSync}::${grupoSync}`;
    if (ultimoFocoRef.current === key) return;
    ultimoFocoRef.current = key;
    const label = resolverGrupoLabel(grupoSync);
    onFocoListoParaCarga({
      grupoId: grupoSync,
      periodo: periodoSync,
      grupoLabel: label || grupoSync,
    });
  }, [
    grupoIdQuery,
    periodoQuery,
    periodoPorDefecto,
    periodosPermitidos,
    listaGruposCargando,
    resolverGrupoLabel,
    onFocoListoParaCarga,
  ]);

  const clearFocoEnUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("grupo_id");
    setSearchParams(next, { replace: true });
    ultimoFocoRef.current = "";
  }, [searchParams, setSearchParams]);

  return {
    grupoIdUrl,
    periodoUrl,
    tieneFocoValido,
    pushFocoToUrl,
    clearFocoEnUrl,
    grupoLabelUrl,
  };
}
