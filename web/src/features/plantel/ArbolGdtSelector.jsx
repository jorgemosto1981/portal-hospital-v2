import { useMemo, useState } from "react";

/**
 * @typedef {{ id: string, nombre: string, children: ArbolNodo[] }} ArbolNodo
 */

/**
 * @param {{
 *   arbol: ArbolNodo[];
 *   gdtIdSeleccionado: string;
 *   onSeleccionar: (gdtId: string) => void;
 *   cargando?: boolean;
 *   vacioMensaje?: string;
 * }} props
 */
export default function ArbolGdtSelector({
  arbol,
  gdtIdSeleccionado,
  onSeleccionar,
  cargando = false,
  vacioMensaje = "No hay grupos de trabajo activos para mostrar.",
}) {
  const [expandidos, setExpandidos] = useState(() => new Set());

  const totalNodos = useMemo(() => {
    let n = 0;
    const walk = (nodes) => {
      for (const node of nodes || []) {
        n += 1;
        walk(node.children);
      }
    };
    walk(arbol);
    return n;
  }, [arbol]);

  const toggle = (id) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (cargando) {
    return <p className="px-2 py-3 text-sm text-slate-500">Cargando grupos de trabajo…</p>;
  }

  if (!arbol.length) {
    return <p className="px-2 py-3 text-sm text-amber-800">{vacioMensaje}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 shrink-0 px-1 text-xs text-slate-500">
        {totalNodos} grupo{totalNodos === 1 ? "" : "s"}
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1" role="tree">
        {arbol.map((nodo) => (
          <NodoArbol
            key={nodo.id}
            nodo={nodo}
            depth={0}
            seleccionado={gdtIdSeleccionado}
            expandidos={expandidos}
            onToggle={toggle}
            onSeleccionar={onSeleccionar}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   nodo: ArbolNodo;
 *   depth: number;
 *   seleccionado: string;
 *   expandidos: Set<string>;
 *   onToggle: (id: string) => void;
 *   onSeleccionar: (id: string) => void;
 * }} props
 */
function NodoArbol({ nodo, depth, seleccionado, expandidos, onToggle, onSeleccionar }) {
  const tieneHijos = Array.isArray(nodo.children) && nodo.children.length > 0;
  const abierto = expandidos.has(nodo.id) || depth === 0;
  const esSel = seleccionado === nodo.id;

  return (
    <li role="treeitem" aria-expanded={tieneHijos ? abierto : undefined}>
      <div
        className={[
          "flex items-center gap-1 rounded-lg py-1.5 pr-2 text-sm",
          esSel ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-100",
        ].join(" ")}
        style={{ paddingLeft: `${0.35 + depth * 0.85}rem` }}
      >
        {tieneHijos ? (
          <button
            type="button"
            aria-label={abierto ? "Colapsar" : "Expandir"}
            className={[
              "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold",
              esSel ? "text-white/90 hover:bg-white/10" : "text-slate-500 hover:bg-slate-200",
            ].join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(nodo.id);
            }}
          >
            {abierto ? "−" : "+"}
          </button>
        ) : (
          <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left font-medium"
          title={nodo.nombre}
          onClick={() => onSeleccionar(nodo.id)}
        >
          {nodo.nombre}
        </button>
      </div>
      {tieneHijos && abierto ? (
        <ul role="group" className="mt-0.5">
          {nodo.children.map((hijo) => (
            <NodoArbol
              key={hijo.id}
              nodo={hijo}
              depth={depth + 1}
              seleccionado={seleccionado}
              expandidos={expandidos}
              onToggle={onToggle}
              onSeleccionar={onSeleccionar}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
