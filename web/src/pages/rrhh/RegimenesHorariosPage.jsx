import { useCallback, useEffect, useMemo, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import { callListarRegimenesHorarios, callGuardarRegimenHorario } from "../../services/callables.js";
import RegimenHorarioForm from "./regimenes/RegimenHorarioForm.jsx";
import RegimenHorarioDetalle from "./regimenes/RegimenHorarioDetalle.jsx";

const ETIQUETAS_PATRON = { fijo: "Fijo", rotativo: "Rotativo", planificado: "Planificado" };
const ETIQUETAS_COLOR = {
  fijo: "bg-blue-100 text-blue-800",
  rotativo: "bg-purple-100 text-purple-800",
  planificado: "bg-amber-100 text-amber-800",
};

function BadgeTipoPatron({ tipo }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ETIQUETAS_COLOR[tipo] || "bg-slate-100 text-slate-700"}`}>
      {ETIQUETAS_PATRON[tipo] || tipo}
    </span>
  );
}

function BadgeActivo({ activo }) {
  return activo ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      Inactivo
    </span>
  );
}

function formatHoras(h) {
  if (h == null) return "—";
  return `${h}hs`;
}

export default function RegimenesHorariosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroPatron, setFiltroPatron] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null);
  const [detalleItem, setDetalleItem] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargarItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callListarRegimenesHorarios();
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e?.message || "Error al cargar regímenes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarItems();
  }, [cargarItems]);

  const itemsFiltrados = useMemo(() => {
    let f = items;
    if (filtroPatron !== "todos") f = f.filter((r) => r.tipo_patron === filtroPatron);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      f = f.filter(
        (r) =>
          (r.nombre || "").toLowerCase().includes(q) ||
          (r.codigo || "").toLowerCase().includes(q) ||
          (r.id || "").toLowerCase().includes(q),
      );
    }
    return f.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }, [items, filtroPatron, busqueda]);

  const totalesPorTipo = useMemo(() => {
    const t = { fijo: 0, rotativo: 0, planificado: 0 };
    for (const it of items) {
      if (it.tipo_patron in t) t[it.tipo_patron]++;
    }
    return t;
  }, [items]);

  const handleGuardar = useCallback(
    async (datos, id) => {
      setGuardando(true);
      try {
        await callGuardarRegimenHorario({ datos, id: id || undefined });
        setModal(null);
        await cargarItems();
      } catch (e) {
        throw e;
      } finally {
        setGuardando(false);
      }
    },
    [cargarItems],
  );

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      {/* Header */}
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              Regímenes horarios
            </h1>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-500">
              Catálogo de moldes horarios: fijos, rotativos y planificados. Cada agente recibe un régimen que
              define su capa teórica de asistencia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ modo: "crear" })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo régimen
          </button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-900">{items.length}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-blue-600">Fijos</p>
          <p className="text-2xl font-bold text-blue-700">{totalesPorTipo.fijo}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-purple-600">Rotativos</p>
          <p className="text-2xl font-bold text-purple-700">{totalesPorTipo.rotativo}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-amber-600">Planificados</p>
          <p className="text-2xl font-bold text-amber-700">{totalesPorTipo.planificado}</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1.5">
            {[
              { key: "todos", label: "Todos" },
              { key: "fijo", label: "Fijo" },
              { key: "rotativo", label: "Rotativo" },
              { key: "planificado", label: "Planificado" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFiltroPatron(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filtroPatron === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por nombre, código o ID…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </Card>

      {/* Estado de carga/error */}
      {loading && (
        <Card className="px-4 py-8 text-center">
          <p className="text-sm text-slate-500">Cargando regímenes…</p>
        </Card>
      )}
      {error && (
        <Card className="border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={cargarItems}
            className="mt-2 text-xs font-medium text-red-600 underline hover:text-red-800"
          >
            Reintentar
          </button>
        </Card>
      )}

      {/* Tabla */}
      {!loading && !error && (
        <Card className="overflow-hidden">
          {itemsFiltrados.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">
                {items.length === 0 ? "No hay regímenes cargados aún." : "Sin resultados para el filtro actual."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Código
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Hs/sem
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemsFiltrados.map((reg) => (
                    <tr key={reg.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{reg.nombre}</p>
                        <p className="text-xs text-slate-400">{reg.id}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        <span className="font-mono text-xs">{reg.codigo}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <BadgeTipoPatron tipo={reg.tipo_patron} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-600">
                        {formatHoras(reg.carga_horaria_semanal_teorica)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <BadgeActivo activo={reg.activo !== false} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => setDetalleItem(reg)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => setModal({ modo: "editar", item: reg })}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <RegimenHorarioForm
          modo={modal.modo}
          item={modal.item || null}
          guardando={guardando}
          onGuardar={handleGuardar}
          onCerrar={() => setModal(null)}
        />
      )}

      {/* Modal detalle */}
      {detalleItem && (
        <RegimenHorarioDetalle
          item={detalleItem}
          onCerrar={() => setDetalleItem(null)}
          onEditar={() => {
            setDetalleItem(null);
            setModal({ modo: "editar", item: detalleItem });
          }}
        />
      )}
    </div>
  );
}
