import { useCallback, useEffect, useState } from "react";

import GrillaMesLicenciasPanel from "../features/grilla/GrillaMesLicenciasPanel.jsx";
import ModalCambioTurno from "../features/grilla/ModalCambioTurno.jsx";
import { listarReadModelLaboralOperativo } from "../services/readModelLaboralService.js";

export default function GrillaOperativa() {
  const [tab, setTab] = useState("laboral");
  const [fechaCorte, setFechaCorte] = useState(() => new Date().toISOString().slice(0, 10));
  const [personaId, setPersonaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [incluirNoVigentes, setIncluirNoVigentes] = useState(false);
  const [warningTipo, setWarningTipo] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [cambioTurnoModal, setCambioTurnoModal] = useState(null);
  const [resumen, setResumen] = useState({
    total: 0,
    vigentes: 0,
    no_vigentes: 0,
    pendientes: 0,
    abiertos: 0,
    cerrados: 0,
    warning_solape_cargo_grupo: 0,
    warning_desvio_carga: 0,
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const out = await listarReadModelLaboralOperativo({
        fecha_corte: fechaCorte,
        persona_id: personaId || null,
        grupo_de_trabajo_id: grupoId || null,
        incluir_no_vigentes: incluirNoVigentes,
      });
      setItems(out.items || []);
      setResumen(out.resumen || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la grilla operativa.");
    } finally {
      setLoading(false);
    }
  }, [fechaCorte, personaId, grupoId, incluirNoVigentes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const itemsFiltrados = items.filter((item) => {
    if (warningTipo === "todos") return true;
    const codes = Array.isArray(item.warning_codes) ? item.warning_codes : [];
    return codes.includes(warningTipo);
  });

  function descargarArchivo(nombre, contenido, mimeType) {
    const blob = new Blob([contenido], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportarJson() {
    const payload = {
      fecha_exportacion: new Date().toISOString(),
      filtros: {
        fecha_corte: fechaCorte,
        persona_id: personaId || null,
        grupo_de_trabajo_id: grupoId || null,
        incluir_no_vigentes: incluirNoVigentes,
        warning_tipo: warningTipo,
      },
      resumen,
      total_items: itemsFiltrados.length,
      items: itemsFiltrados,
    };
    descargarArchivo(
      `read-model-laboral-${fechaCorte}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function toCsvCell(v) {
    const raw = v == null ? "" : String(v);
    const escaped = raw.replaceAll('"', '""');
    return `"${escaped}"`;
  }

  function exportarCsv() {
    const headers = [
      "fecha_corte",
      "persona_id",
      "persona_nombre",
      "grupo_de_trabajo_id",
      "grupo_nombre",
      "hlg_id",
      "hld_id",
      "hlc_id",
      "nivel_jerarquico",
      "vigente_en_fecha",
      "estado_operativo",
      "estado_admin",
      "fecha_inicio",
      "fecha_fin",
      "regimen_horario_id",
      "centro_costo_id",
      "carga_horas_semana_hlg",
      "carga_horas_total_hlc",
      "warning_codes",
    ];
    const lines = [headers.map(toCsvCell).join(",")];
    itemsFiltrados.forEach((item) => {
      const row = [
        item.fecha_corte,
        item.persona_id,
        item.persona_nombre,
        item.grupo_de_trabajo_id,
        item.grupo_nombre,
        item.hlg_id,
        item.hld_id,
        item.hlc_id,
        item.nivel_jerarquico,
        item.vigente_en_fecha ? "si" : "no",
        item.estado_operativo,
        item.estado_admin,
        item.fecha_inicio,
        item.fecha_fin,
        item.regimen_horario_id,
        item.centro_costo_id,
        item.carga_horas_semana_hlg,
        item.carga_horas_total_hlc,
        Array.isArray(item.warning_codes) ? item.warning_codes.join("|") : "",
      ];
      lines.push(row.map(toCsvCell).join(","));
    });
    descargarArchivo(`read-model-laboral-${fechaCorte}.csv`, `${lines.join("\n")}\n`, "text/csv;charset=utf-8");
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Grilla Operativa</h1>
      <p className="mt-1 text-sm text-slate-600">
        Capa real y activa: integración operativa entre capa teórica, fichadas y licencias.
      </p>
      <div className="mt-3 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("laboral")}
          className={[
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "laboral"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700",
          ].join(" ")}
        >
          Vista laboral
        </button>
        <button
          type="button"
          onClick={() => setTab("licencias")}
          className={[
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "licencias"
              ? "border-violet-700 text-violet-900"
              : "border-transparent text-slate-500 hover:text-slate-700",
          ].join(" ")}
        >
          Calendario licencias (MDC)
        </button>
      </div>

      {tab === "licencias" ? <GrillaMesLicenciasPanel /> : null}

      {tab === "laboral" ? (
        <>
      <p className="mt-2 text-sm text-slate-600">
        Read-model laboral unificado para Ticket/RDA/Grilla mensual (persona, cargo, grupo, vigencia y carga).
      </p>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
        <p><strong>Objetivo:</strong> consultar vista operativa consolidada por fecha/persona/grupo.</p>
        <p><strong>Resultado:</strong> lectura unificada de estado operativo, admin y warnings laborales.</p>
        <p><strong>Cuándo usar:</strong> análisis rápido, control diario y exportación para auditoría.</p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <input value={personaId} onChange={(e) => setPersonaId(e.target.value)} placeholder="persona_id (opcional)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <input value={grupoId} onChange={(e) => setGrupoId(e.target.value)} placeholder="grupo_de_trabajo_id (opcional)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <select value={warningTipo} onChange={(e) => setWarningTipo(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="todos">Warnings: todos</option>
          <option value="SOLAPE_CARGO_GRUPO">Warnings: solape cargo+grupo</option>
          <option value="DESVIO_CARGA_NORMATIVA">Warnings: desvío carga</option>
        </select>
        <button type="button" onClick={() => void cargar()} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white active:scale-[0.99]">
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
        <input type="checkbox" checked={incluirNoVigentes} onChange={(e) => setIncluirNoVigentes(e.target.checked)} />
        Incluir no vigentes para fecha de corte
      </label>

      <div className="mt-3 grid gap-2 md:grid-cols-8">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">Total: <span className="font-semibold">{resumen.total || 0}</span></div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Vigentes: <span className="font-semibold">{resumen.vigentes || 0}</span></div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">No vigentes: <span className="font-semibold">{resumen.no_vigentes || 0}</span></div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">Pendientes: <span className="font-semibold">{resumen.pendientes || 0}</span></div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Abiertos: <span className="font-semibold">{resumen.abiertos || 0}</span></div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">Cerrados: <span className="font-semibold">{resumen.cerrados || 0}</span></div>
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Warnings solape: <span className="font-semibold">{resumen.warning_solape_cargo_grupo || 0}</span></div>
        <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">Warnings carga: <span className="font-semibold">{resumen.warning_desvio_carga || 0}</span></div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={exportarJson} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
          Exportar JSON
        </button>
        <button type="button" onClick={exportarCsv} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
          Exportar CSV
        </button>
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Filtrados por warning: {itemsFiltrados.length} / base: {items.length}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">Persona</th>
              <th className="px-3 py-2">Grupo</th>
              <th className="px-3 py-2">HLg</th>
              <th className="px-3 py-2">HLd</th>
              <th className="px-3 py-2">HLc</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2">Vigente</th>
              <th className="px-3 py-2">Estado operativo</th>
              <th className="px-3 py-2">Estado admin</th>
              <th className="px-3 py-2">Inicio</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2">Carga HLg</th>
              <th className="px-3 py-2">Carga HLc</th>
              <th className="px-3 py-2">Turno</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {itemsFiltrados.map((item) => (
              <tr key={item.hlg_id}>
                <td className="px-3 py-2">{item.persona_nombre ? `${item.persona_id} (${item.persona_nombre})` : item.persona_id || "—"}</td>
                <td className="px-3 py-2">{item.grupo_nombre ? `${item.grupo_de_trabajo_id} (${item.grupo_nombre})` : item.grupo_de_trabajo_id || "—"}</td>
                <td className="px-3 py-2 font-mono">{item.hlg_id || "—"}</td>
                <td className="px-3 py-2 font-mono">{item.hld_id || "—"}</td>
                <td className="px-3 py-2 font-mono">{item.hlc_id || "—"}</td>
                <td className="px-3 py-2">{item.nivel_jerarquico ?? "—"}</td>
                <td className="px-3 py-2">{item.vigente_en_fecha ? "si" : "no"}</td>
                <td className="px-3 py-2">{item.estado_operativo || "—"}</td>
                <td className="px-3 py-2">{item.estado_admin || "—"}</td>
                <td className="px-3 py-2">{item.fecha_inicio || "—"}</td>
                <td className="px-3 py-2">{item.fecha_fin || "—"}</td>
                <td className="px-3 py-2">{item.carga_horas_semana_hlg ?? "—"}</td>
                <td className="px-3 py-2">{item.carga_horas_total_hlc ?? "—"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setCambioTurnoModal({ personaId: item.persona_id, personaNombre: item.persona_nombre || item.persona_id })}
                    className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    Cambio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      ) : null}

      {cambioTurnoModal && (
        <ModalCambioTurno
          personaId={cambioTurnoModal.personaId}
          fecha={fechaCorte}
          personaNombre={cambioTurnoModal.personaNombre}
          onCerrar={() => setCambioTurnoModal(null)}
          onRegistrado={() => void cargar()}
        />
      )}
    </section>
  );
}
