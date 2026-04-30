import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import { callListarColeccion } from "../services/callables.js";

function toIsoLike(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._seconds) {
    return new Date(value._seconds * 1000).toISOString();
  }
  return String(value);
}

function resolveEstadoFila(persona, cuenta) {
  if (persona?.activo === false || cuenta?.activo === false) return "INACTIVO";
  const estadoAcceso = String(cuenta?.estado_acceso || "");
  const estadoPersona = String(persona?.estado || "");
  const perfilId = String(persona?.estado_perfil_datos_id || "");
  const authVinculado = Boolean(persona?.metadata?.auth_vinculado);
  const pasoA = Boolean(persona?.onboarding_mvp?.paso_a);
  const pasoB = Boolean(persona?.onboarding_mvp?.paso_b);
  if (
    estadoPersona === "ACTIVO_MVP" ||
    (estadoAcceso === "cfg_eca_activo" && perfilId === "cfg_epd_completo")
  ) {
    return "COMPLETO";
  }
  if (!cuenta || (!cuenta.auth_uid && !cuenta.username && estadoAcceso === "cfg_eca_pend_reg" && !authVinculado)) {
    return "NO_INICIADO";
  }
  if (authVinculado || pasoA || pasoB || estadoAcceso === "cfg_eca_onb") {
    return "PARCIAL";
  }
  return "NO_INICIADO";
}

export default function SeguimientoEnrolamientoUsuariosRRHH() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");

  async function cargar() {
    setLoading(true);
    try {
      const [rp, ru, re] = await Promise.all([
        callListarColeccion({ collectionName: "personas" }),
        callListarColeccion({ collectionName: "usuarios_cuenta" }),
        callListarColeccion({ collectionName: "eventos_ticket" }),
      ]);
      const personas = rp?.data?.items || [];
      const cuentas = ru?.data?.items || [];
      const eventos = re?.data?.items || [];
      const cuentaByPersona = new Map(cuentas.map((c) => [String(c.persona_id || ""), c]));

      const eventosByPersona = new Map();
      for (const e of eventos) {
        const pid = String(e.persona_id || "");
        if (!pid) continue;
        if (!eventosByPersona.has(pid)) eventosByPersona.set(pid, []);
        eventosByPersona.get(pid).push(e);
      }

      const out = personas.map((p) => {
        const personaId = String(p.id || "");
        const cuenta = cuentaByPersona.get(personaId) || null;
        const estado = resolveEstadoFila(p, cuenta);
        const evs = (eventosByPersona.get(personaId) || []).sort((a, b) =>
          toIsoLike(b.ocurrido_en || b.creado_en).localeCompare(toIsoLike(a.ocurrido_en || a.creado_en)),
        );
        const evPrimerAcceso =
          evs.find((e) => String(e.payload?.motivo || "") === "registro_primer_acceso") ||
          evs.find((e) => String(e.payload?.motivo || "") === "vincularCuentaConDni") ||
          null;
        const evCompleto =
          evs.find((e) => String(e.payload?.fase || "") === "C") ||
          evs.find((e) => String(e.accion || "") === "onboarding_mvp_completar") ||
          null;
        return {
          persona_id: personaId,
          dni: String(p.dni || ""),
          apellido: String(p.apellido || ""),
          nombre: String(p.nombre || ""),
          estado,
          persona_estado: String(p.estado || ""),
          estado_perfil_datos_id: String(p.estado_perfil_datos_id || ""),
          onboarding_paso_a: Boolean(p.onboarding_mvp?.paso_a),
          onboarding_paso_b: Boolean(p.onboarding_mvp?.paso_b),
          onboarding_vinculado: Boolean(p.metadata?.auth_vinculado),
          creado_en: toIsoLike(p.creado_en),
          creado_por: String(p.creado_por || ""),
          cuenta_id: cuenta ? String(cuenta.id || "") : "",
          auth_uid: cuenta ? String(cuenta.auth_uid || "") : "",
          username: cuenta ? String(cuenta.username || "") : "",
          estado_acceso: cuenta ? String(cuenta.estado_acceso || "") : "",
          role_ids: Array.isArray(cuenta?.role_ids) ? cuenta.role_ids.map((r) => String(r)) : [],
          actor_primer_acceso: evPrimerAcceso ? String(evPrimerAcceso.actor_uid || evPrimerAcceso.actor_persona_id || "") : "",
          fecha_primer_acceso: evPrimerAcceso ? toIsoLike(evPrimerAcceso.ocurrido_en || evPrimerAcceso.creado_en) : "",
          actor_completado: evCompleto ? String(evCompleto.actor_uid || evCompleto.actor_persona_id || "") : "",
          fecha_completado: evCompleto ? toIsoLike(evCompleto.ocurrido_en || evCompleto.creado_en) : "",
        };
      });

      out.sort((a, b) => b.creado_en.localeCompare(a.creado_en));
      setRows(out);
    } catch (err) {
      toast.error((err && err.message) || "No se pudo cargar el seguimiento de enrolamiento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = !t
      ? rows
      : rows.filter((r) =>
      [r.persona_id, r.dni, r.apellido, r.nombre, r.username, r.estado].join(" ").toLowerCase().includes(t),
    );
    if (estadoFiltro === "TODOS") return base;
    return base.filter((r) => r.estado === estadoFiltro);
  }, [q, rows, estadoFiltro]);

  const resumen = useMemo(() => {
    return filtradas.reduce(
      (acc, r) => {
        acc.total += 1;
        acc[r.estado] = (acc[r.estado] || 0) + 1;
        return acc;
      },
      { total: 0, NO_INICIADO: 0, PARCIAL: 0, COMPLETO: 0, INACTIVO: 0 },
    );
  }, [filtradas]);

  const conteoEstadosGlobal = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += 1;
        acc[r.estado] = (acc[r.estado] || 0) + 1;
        return acc;
      },
      { total: 0, NO_INICIADO: 0, PARCIAL: 0, COMPLETO: 0, INACTIVO: 0 },
    );
  }, [rows]);

  function exportarCsv() {
    const headers = [
      "persona_id",
      "dni",
      "apellido",
      "nombre",
      "estado",
      "estado_acceso",
      "estado_persona",
      "estado_perfil_datos_id",
      "cuenta_id",
      "auth_uid",
      "username",
      "role_ids",
      "vinculado",
      "paso_a",
      "paso_b",
      "creado_en",
      "creado_por",
      "fecha_primer_acceso",
      "actor_primer_acceso",
      "fecha_completado",
      "actor_completado",
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...filtradas.map((r) =>
        [
          r.persona_id,
          r.dni,
          r.apellido,
          r.nombre,
          r.estado,
          r.estado_acceso,
          r.persona_estado,
          r.estado_perfil_datos_id,
          r.cuenta_id,
          r.auth_uid,
          r.username,
          r.role_ids.join("|"),
          r.onboarding_vinculado ? "si" : "no",
          r.onboarding_paso_a ? "si" : "no",
          r.onboarding_paso_b ? "si" : "no",
          r.creado_en,
          r.creado_por,
          r.fecha_primer_acceso,
          r.actor_primer_acceso,
          r.fecha_completado,
          r.actor_completado,
        ]
          .map(esc)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seguimiento-enrolamiento-rrhh-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
            Seguimiento de enrolamiento de usuarios para RRHH
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Estado operativo de altas y enrolamiento por persona, con detalle de vínculo Auth, onboarding y cuenta.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Total: <strong>{resumen.total}</strong> · No iniciado: <strong>{resumen.NO_INICIADO}</strong> · Parcial:{" "}
            <strong>{resumen.PARCIAL}</strong> · Completo: <strong>{resumen.COMPLETO}</strong> · Inactivo:{" "}
            <strong>{resumen.INACTIVO}</strong>
          </p>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por persona_id, DNI, apellido, nombre o username..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xl"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportarCsv}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => void cargar()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Actualizar
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {["TODOS", "NO_INICIADO", "PARCIAL", "COMPLETO", "INACTIVO"].map((id) => {
              const count =
                id === "TODOS"
                  ? conteoEstadosGlobal.total
                  : conteoEstadosGlobal[id] || 0;
              const label = id === "TODOS" ? "Todos" : id.replace("_", " ");
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEstadoFiltro(id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    estadoFiltro === id
                      ? "border-slate-700 bg-slate-700 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Cargando seguimiento...</p>
          ) : filtradas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin resultados para el filtro actual.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {filtradas.map((r) => (
                <div key={r.persona_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs">
                  <p className="font-semibold text-slate-800">
                    {r.apellido} {r.nombre} · {r.persona_id}
                  </p>
                  <p className="text-slate-700">
                    Estado enrolamiento: <strong>{r.estado}</strong> · DNI: {r.dni || "—"} · cuenta_id:{" "}
                    {r.cuenta_id || "—"}
                  </p>
                  <p className="text-slate-600">
                    estado_acceso: {r.estado_acceso || "—"} · estado_persona: {r.persona_estado || "—"} ·
                    estado_perfil_datos_id: {r.estado_perfil_datos_id || "—"}
                  </p>
                  <p className="text-slate-600">
                    Auth UID: {r.auth_uid || "—"} · username: {r.username || "—"} · role_ids:{" "}
                    {r.role_ids.length ? r.role_ids.join(", ") : "—"}
                  </p>
                  <p className="text-slate-600">
                    Vinculado: {r.onboarding_vinculado ? "sí" : "no"} · paso A: {r.onboarding_paso_a ? "sí" : "no"} ·
                    paso B: {r.onboarding_paso_b ? "sí" : "no"}
                  </p>
                  <p className="text-slate-600">
                    Creado en: {r.creado_en || "—"} · creado_por: {r.creado_por || "—"}
                  </p>
                  <p className="text-slate-600">
                    Primer acceso: {r.fecha_primer_acceso || "—"} · actor: {r.actor_primer_acceso || "—"}
                  </p>
                  <p className="text-slate-600">
                    Completado: {r.fecha_completado || "—"} · actor: {r.actor_completado || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
