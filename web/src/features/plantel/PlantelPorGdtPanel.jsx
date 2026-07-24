import { useEffect, useMemo, useState } from "react";

import { callListarArbolGdtPlantel } from "../../services/callables.js";
import { ymdHoyBa } from "../solicitudes/ticketeraUtils.js";
import ArbolGdtSelector from "./ArbolGdtSelector.jsx";
import TablaPlantelGdt from "./TablaPlantelGdt.jsx";
import { construirArbolGdt } from "./buildArbolGdt.js";

/**
 * Split view compartido: árbol GDT + tabla plantel.
 * El árbol viene de `listarArbolGdtPlantel` (servidor); la tabla de `obtenerPlantelPorGdt`.
 *
 * @param {{
 *   modo: "rrhh" | "jefe";
 *   titulo: string;
 *   subtitulo: string;
 * }} props
 */
export default function PlantelPorGdtPanel({ modo, titulo, subtitulo }) {
  const [arbol, setArbol] = useState(/** @type {Array<{ id: string, nombre: string, children: unknown[] }>} */ ([]));
  const [nombresPorId, setNombresPorId] = useState(() => new Map());
  const [cargandoArbol, setCargandoArbol] = useState(true);
  const [arbolError, setArbolError] = useState("");
  const [gdtId, setGdtId] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargandoArbol(true);
      setArbolError("");
      try {
        const res = await callListarArbolGdtPlantel({
          alcance: modo === "jefe" ? "jefe" : "rrhh",
          a_fecha: ymdHoyBa(),
        });
        if (cancel) return;
        const data = res?.data || {};
        const nodos = Array.isArray(data.nodos) ? data.nodos : [];
        const arbolSrv = Array.isArray(data.arbol) ? data.arbol : null;
        const nextArbol =
          arbolSrv != null
            ? arbolSrv
            : construirArbolGdt(
                nodos.map((n) => ({
                  id: String(n.id || "").trim(),
                  nombre: String(n.nombre || n.id || "").trim(),
                  parent_group_id: n.parent_group_id ? String(n.parent_group_id).trim() : null,
                })),
              );
        setArbol(nextArbol);
        setNombresPorId(
          new Map(
            nodos
              .map((n) => [String(n.id || "").trim(), String(n.nombre || n.id || "").trim()])
              .filter(([id]) => /^gdt_/i.test(id)),
          ),
        );
        if (data.aviso) setArbolError(String(data.aviso));
        else if (nextArbol.length === 0) {
          setArbolError(
            modo === "jefe"
              ? "No hay grupos en tu rama de jefatura."
              : "No hay grupos de trabajo activos.",
          );
        }
      } catch (e) {
        if (cancel) return;
        setArbol([]);
        setNombresPorId(new Map());
        setArbolError(e?.message || "No se pudo cargar el árbol de GDT.");
      } finally {
        if (!cancel) setCargandoArbol(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [modo]);

  const idsVisibles = useMemo(() => {
    const ids = new Set();
    const walk = (nodes) => {
      for (const n of nodes || []) {
        ids.add(n.id);
        walk(n.children);
      }
    };
    walk(arbol);
    return ids;
  }, [arbol]);

  useEffect(() => {
    if (gdtId && !idsVisibles.has(gdtId)) setGdtId("");
  }, [idsVisibles, gdtId]);

  const vacioMensaje =
    arbolError ||
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
