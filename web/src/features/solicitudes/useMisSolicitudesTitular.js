import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";

import { dbV2 } from "../../services/firebase.js";
import { listarGruposTrabajoCatalogo } from "../catalogo/listarGruposTrabajoCatalogo.js";
import { useArticulosIngresoMenu } from "./ArticulosIngresoProvider.jsx";
import {
  bucketEstadoSolicitud,
  esSolicitudInasistenciaInjustificadaDerivada,
  estaDentroHistorico3Meses,
  labelEstadoSolicitudAgente,
  labelRolActorRechazo,
  motivoRechazoTexto,
  relatoRechazoConInasistenciaInjustificada,
  requiereAcuseRechazo,
  textoFechasSolicitud,
  tituloSolicitudAgente,
} from "./misSolicitudesUi.js";

/**
 * @param {string} personaId
 */
export function useMisSolicitudesTitular(personaId) {
  const pid = String(personaId || "").trim();
  const { obtenerDatosArticuloElegible } = useArticulosIngresoMenu();
  const [rows, setRows] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [gdtNombres, setGdtNombres] = useState(/** @type {Map<string, string>} */ (new Map()));
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!/^per_/i.test(pid)) {
      setRows([]);
      setCargando(false);
      return undefined;
    }
    setCargando(true);
    setError("");
    const q = query(
      collection(dbV2, "solicitudes_articulo"),
      where("titular_persona_id", "==", pid),
      limit(120),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        list.sort((a, b) => {
          const ta = a.creado_en?.toMillis?.() ?? (Date.parse(String(a.creado_en || "")) || 0);
          const tb = b.creado_en?.toMillis?.() ?? (Date.parse(String(b.creado_en || "")) || 0);
          return tb - ta;
        });
        setRows(
          list.filter(
            (s) =>
              estaDentroHistorico3Meses(s.creado_en) &&
              !esSolicitudInasistenciaInjustificadaDerivada(s),
          ),
        );
        setCargando(false);
      },
      (err) => {
        setError(err?.message || "No se pudieron cargar tus solicitudes.");
        setCargando(false);
      },
    );
    return () => unsub();
  }, [pid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const grupos = await listarGruposTrabajoCatalogo({ limit: 400 });
        if (cancelled) return;
        const map = new Map();
        for (const g of grupos || []) {
          const id = String(g?.id || g?.grupo_trabajo_id || "").trim();
          if (!id) continue;
          const nom = String(g?.nombre || g?.nombre_corto || g?.label || "").trim();
          if (nom) map.set(id, nom);
        }
        setGdtNombres(map);
      } catch {
        if (!cancelled) setGdtNombres(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(() => {
    return rows.map((sol) => {
      const artId = String(sol.articulo_id || "").trim();
      const art = artId ? obtenerDatosArticuloElegible?.(artId) : null;
      const gdtId = String(sol.grupo_trabajo_id_ancla || "").trim();
      const gdtNombre = gdtId ? gdtNombres.get(gdtId) || "" : "";
      const titulo = tituloSolicitudAgente(sol, art);
      return {
        ...sol,
        _titulo: titulo,
        _fechasTexto: textoFechasSolicitud(sol),
        _estadoLabel: labelEstadoSolicitudAgente(sol.estado_solicitud_id, sol),
        _bucket: bucketEstadoSolicitud(sol.estado_solicitud_id, sol),
        _gdtLabel: gdtNombre || (gdtId ? "Grupo de trabajo" : "—"),
        _gdtId: gdtId,
        _requiereAcuse: requiereAcuseRechazo(sol),
        _motivoRechazo: motivoRechazoTexto(sol),
        _actorRechazoRol: labelRolActorRechazo(sol),
        _relatoInasistenciaInjustificada: relatoRechazoConInasistenciaInjustificada(sol, titulo),
      };
    });
  }, [rows, gdtNombres, obtenerDatosArticuloElegible]);

  return { rows: enriched, cargando, error };
}
