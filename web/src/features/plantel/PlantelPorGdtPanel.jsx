import { useEffect, useMemo, useState } from "react";

import {
  listarGruposTrabajoCatalogo,
  peekGruposTrabajoCatalogo,
} from "../catalogo/listarGruposTrabajoCatalogo.js";
import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { callResolverContextoLaboralSolicitud } from "../../services/callables.js";
import { ymdHoyBa } from "../solicitudes/ticketeraUtils.js";
import ArbolGdtSelector from "./ArbolGdtSelector.jsx";
import TablaPlantelGdt from "./TablaPlantelGdt.jsx";
import {
  construirArbolGdt,
  expandirSubarbolIds,
  idsGdtDesdeGruposVigentes,
  listarGdtActivos,
} from "./buildArbolGdt.js";

/**
 * Split view compartido: árbol GDT + tabla plantel.
 *
 * @param {{
 *   modo: "rrhh" | "jefe";
 *   titulo: string;
 *   subtitulo: string;
 * }} props
 */
export default function PlantelPorGdtPanel({ modo, titulo, subtitulo }) {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const personaId = typeof claims?.persona_id === "string" ? claims.persona_id.trim() : "";

  const [nodos, setNodos] = useState(() => listarGdtActivos(peekGruposTrabajoCatalogo(400) || []));
  const [catalogoCargando, setCatalogoCargando] = useState(nodos.length === 0);
  const [catalogoError, setCatalogoError] = useState("");

  const [raizJefeIds, setRaizJefeIds] = useState(/** @type {string[]} */ ([]));
  const [raicesCargando, setRaicesCargando] = useState(modo === "jefe");
  const [raicesError, setRaicesError] = useState("");

  const [gdtId, setGdtId] = useState("");
  const [nombresPorId, setNombresPorId] = useState(() => new Map());

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCatalogoCargando(true);
      setCatalogoError("");
      try {
        const rows = await listarGruposTrabajoCatalogo({ limit: 400 });
        if (cancel) return;
        const activos = listarGdtActivos(rows);
        setNodos(activos);
        setNombresPorId(new Map(activos.map((n) => [n.id, n.nombre])));
      } catch (e) {
        if (cancel) return;
        setNodos([]);
        setCatalogoError(e?.message || "No se pudo cargar el catálogo de GDT.");
      } finally {
        if (!cancel) setCatalogoCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (modo !== "jefe") {
      setRaizJefeIds([]);
      setRaicesCargando(false);
      setRaicesError("");
      return undefined;
    }
    if (!/^per_/i.test(personaId)) {
      setRaizJefeIds([]);
      setRaicesCargando(false);
      setRaicesError("Sin persona_id en sesión; no se puede acotar la rama.");
      return undefined;
    }

    let cancel = false;
    (async () => {
      setRaicesCargando(true);
      setRaicesError("");
      try {
        const res = await callResolverContextoLaboralSolicitud({
          persona_id: personaId,
          fecha_desde: ymdHoyBa(),
        });
        if (cancel) return;
        const ids = idsGdtDesdeGruposVigentes(res?.data?.grupos_trabajo_vigentes || []);
        setRaizJefeIds(ids);
        if (ids.length === 0) {
          setRaicesError("Sin HLg vigente: no hay rama de jefatura para mostrar.");
        }
      } catch (e) {
        if (cancel) return;
        setRaizJefeIds([]);
        setRaicesError(e?.message || "No se pudieron resolver los GDT vigentes.");
      } finally {
        if (!cancel) setRaicesCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [modo, personaId]);

  const arbol = useMemo(() => {
    if (modo === "rrhh") return construirArbolGdt(nodos);
    const visible = expandirSubarbolIds(nodos, raizJefeIds);
    return construirArbolGdt(nodos, visible);
  }, [modo, nodos, raizJefeIds]);

  useEffect(() => {
    if (!gdtId) return;
    const ids = new Set();
    const walk = (nodes) => {
      for (const n of nodes || []) {
        ids.add(n.id);
        walk(n.children);
      }
    };
    walk(arbol);
    if (!ids.has(gdtId)) setGdtId("");
  }, [arbol, gdtId]);

  const cargandoArbol = catalogoCargando || (modo === "jefe" && raicesCargando);
  const vacioMensaje =
    catalogoError ||
    raicesError ||
    (modo === "jefe"
      ? "No hay grupos en tu rama de jefatura."
      : "No hay grupos de trabajo activos.");

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitulo}</p>
      </header>

      <div className="grid min-h-[28rem] gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <aside className="flex min-h-[16rem] flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <h2 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Grupos de trabajo
          </h2>
          <ArbolGdtSelector
            arbol={arbol}
            gdtIdSeleccionado={gdtId}
            onSeleccionar={setGdtId}
            cargando={cargandoArbol}
            vacioMensaje={vacioMensaje}
          />
        </aside>

        <div className="min-h-[16rem] rounded-xl border border-slate-200 p-3 md:p-4">
          <TablaPlantelGdt
            gdtId={gdtId}
            gdtNombre={nombresPorId.get(gdtId) || ""}
          />
        </div>
      </div>
    </section>
  );
}
