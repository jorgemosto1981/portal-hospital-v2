import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";
import {
  buildGrillaFocoSearchParams,
  GRILLA_FOCO_MODO_URL,
  parseModoFocoUrl,
  parsePeriodoFocoUrl,
} from "./grillaMesFocoUrlUtils.js";
import { etiquetaGrupoDesdeLista, normalizeGrupoTrabajoId, RX_GDT } from "./grillaGrupoUtils.js";

/**
 * Sincroniza foco GDT / titular con query URL (T-05).
 *
 * @param {{
 *   enabled: boolean;
 *   origenGrupos: "catalogo" | "hlg_vigente";
 *   modoFocoEquipo: string;
 *   vista: {
 *     aplicarFocoOperativo: Function;
 *     gruposSector: Array<{ id?: string; nombre?: string; codigo?: string; titulo?: string }>;
 *     gruposEquipo: Array<{ grupo_de_trabajo_id?: string; etiqueta_ui?: string }>;
 *     grupoActivoLabel: string;
 *     sectorCargando: boolean;
 *     resolverCargando: boolean;
 *   };
 *   onFocoListoParaCarga: (args: { grupoId: string; periodo: string; grupoLabel: string }) => void;
 *   periodoPorDefecto: string;
 * }} opts
 */
export function useGrillaMesFocoUrl({
  enabled,
  origenGrupos,
  modoFocoEquipo,
  vista,
  onFocoListoParaCarga,
  periodoPorDefecto,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ultimoFocoEquipoRef = useRef("");

  const grupoIdUrl = normalizeGrupoTrabajoId(searchParams.get("grupo_id"));
  const periodoUrl =
    parsePeriodoFocoUrl(searchParams.get("periodo")) || periodoPorDefecto;
  const tieneFocoValido = RX_GDT.test(grupoIdUrl);

  const listaGruposCargando =
    origenGrupos === "catalogo" ? vista.sectorCargando : vista.resolverCargando;

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

  const pushFocoTitularToUrl = useCallback(
    ({ periodo }) => {
      const next = buildGrillaFocoSearchParams(
        {
          grupoId: "",
          periodo: periodo || periodoPorDefecto,
          modo: GRILLA_FOCO_MODO_URL.TITULAR,
        },
        searchParams,
      );
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, periodoPorDefecto],
  );

  const grupoLabelUrl = useMemo(() => {
    if (!tieneFocoValido) return "";
    if (origenGrupos === "catalogo") {
      const row = vista.gruposSector.find(
        (g) => String(g.id || "").trim() === grupoIdUrl,
      );
      if (row) {
        return String(row.nombre || row.codigo || row.titulo || grupoIdUrl).trim();
      }
    } else {
      const label = etiquetaGrupoDesdeLista(vista.gruposEquipo, grupoIdUrl);
      if (label && label !== grupoIdUrl) return label;
    }
    return vista.grupoActivoLabel || grupoIdUrl;
  }, [
    tieneFocoValido,
    origenGrupos,
    grupoIdUrl,
    vista.gruposSector,
    vista.gruposEquipo,
    vista.grupoActivoLabel,
  ]);

  const grupoIdQuery = searchParams.get("grupo_id");
  const periodoQuery = searchParams.get("periodo");
  const modoQuery = searchParams.get("modo");

  useEffect(() => {
    if (!enabled) return;
    const periodoParsed = parsePeriodoFocoUrl(periodoQuery) || periodoPorDefecto;
    const grupoParsed = normalizeGrupoTrabajoId(grupoIdQuery);
    const esTitularUrl =
      parseModoFocoUrl(modoQuery) === GRILLA_FOCO_MODO_URL.TITULAR &&
      !RX_GDT.test(grupoParsed);

    vista.aplicarFocoOperativo({
      periodo: periodoParsed,
      grupoId: esTitularUrl ? "" : grupoParsed,
      modo: esTitularUrl ? GRILLA_MES_MODO.TITULAR : modoFocoEquipo,
    });
  }, [
    enabled,
    grupoIdQuery,
    periodoQuery,
    modoQuery,
    periodoPorDefecto,
    modoFocoEquipo,
    vista.aplicarFocoOperativo,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (!tieneFocoValido) {
      ultimoFocoEquipoRef.current = "";
      return;
    }
    if (listaGruposCargando) return;
    const key = `${periodoUrl}::${grupoIdUrl}`;
    if (ultimoFocoEquipoRef.current === key) return;
    ultimoFocoEquipoRef.current = key;
    onFocoListoParaCarga({
      grupoId: grupoIdUrl,
      periodo: periodoUrl,
      grupoLabel: grupoLabelUrl || grupoIdUrl,
    });
  }, [
    enabled,
    tieneFocoValido,
    grupoIdUrl,
    periodoUrl,
    grupoLabelUrl,
    listaGruposCargando,
    onFocoListoParaCarga,
  ]);

  return {
    grupoIdUrl,
    periodoUrl,
    tieneFocoValido,
    pushFocoToUrl,
    pushFocoTitularToUrl,
    grupoLabelUrl,
  };
}
