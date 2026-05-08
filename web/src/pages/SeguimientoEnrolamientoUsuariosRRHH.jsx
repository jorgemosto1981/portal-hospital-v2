import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import { callListarColeccion } from "../services/callables.js";

const ESTADO_ACCESO_LABELS = {
  cfg_eca_pend_reg: "Pendiente de registro",
  cfg_eca_onb: "Onboarding de datos en curso",
  cfg_eca_pend_mail: "Pendiente de verificación de correo",
  cfg_eca_activo: "Acceso activo al portal",
  cfg_eca_bloq: "Cuenta bloqueada",
};

const ESTADO_PERFIL_LABELS = {
  cfg_epd_borr: "Borrador",
  cfg_epd_inc: "Incompleto",
  cfg_epd_comp: "Completo",
  cfg_epd_completo: "Completo",
  cfg_epd_rec: "Requiere actualización",
};

const ESTADO_ENROLAMIENTO_LABELS = {
  NO_INICIADO: "No iniciado",
  PARCIAL: "Parcial",
  COMPLETO: "Completo",
  INACTIVO: "Inactivo",
};

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
    (estadoAcceso === "cfg_eca_activo" && (perfilId === "cfg_epd_comp" || perfilId === "cfg_epd_completo"))
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

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMissing(value, type = "pending") {
  if (String(value || "").trim()) return value;
  if (type === "na") return "No aplica";
  if (type === "missing") return "No informado";
  return "Aún no ocurrió";
}

function labelEstadoAcceso(id) {
  return ESTADO_ACCESO_LABELS[String(id || "").trim()] || "Estado de acceso no categorizado";
}

function labelEstadoPerfil(id) {
  return ESTADO_PERFIL_LABELS[String(id || "").trim()] || "Estado de perfil no categorizado";
}

function labelRol(id) {
  const rid = String(id || "").trim().toUpperCase();
  if (rid === "CFG_RRHH") return "RRHH";
  if (rid === "CFG_USUARIO") return "Usuario";
  if (rid === "CFG_JEFE") return "Jefe";
  if (!rid) return "";
  return rid;
}

function buildPendientes(row) {
  const pendientes = [];
  if (!row.onboarding_vinculado) pendientes.push("Vincular cuenta Auth");
  if (!row.onboarding_paso_a) pendientes.push("Completar paso A (credenciales y primer login)");
  if (!row.onboarding_paso_b) pendientes.push("Completar paso B (onboarding inicial)");
  if (String(row.estado_acceso || "") !== "cfg_eca_activo") pendientes.push("Activar acceso al portal");
  if (!["cfg_epd_comp", "cfg_epd_completo"].includes(String(row.estado_perfil_datos_id || ""))) {
    pendientes.push("Completar perfil de datos personales");
  }
  return pendientes;
}

function estadoBadgeClass(estado) {
  if (estado === "COMPLETO") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (estado === "PARCIAL") return "border-amber-300 bg-amber-100 text-amber-900";
  if (estado === "INACTIVO") return "border-rose-300 bg-rose-100 text-rose-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export default function SeguimientoEnrolamientoUsuariosRRHH() {
  const PAGE_SIZE = 10;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [glosarioAbierto, setGlosarioAbierto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [vistos, setVistos] = useState({});
  const [soloNoVistos, setSoloNoVistos] = useState(true);

  async function cargar() {
    setLoading(true);
    try {
      const [rp, ru, re, rh] = await Promise.all([
        callListarColeccion({ collectionName: "personas" }),
        callListarColeccion({ collectionName: "usuarios_cuenta" }),
        callListarColeccion({ collectionName: "eventos_ticket" }),
        callListarColeccion({ collectionName: "historial_laboral_cargos" }),
      ]);
      const personas = rp?.data?.items || [];
      const cuentas = ru?.data?.items || [];
      const eventos = re?.data?.items || [];
      const hlcs = rh?.data?.items || [];
      const cuentaByPersona = new Map(cuentas.map((c) => [String(c.persona_id || ""), c]));

      /** Distinct `cfg_rol` refs desde HLc por persona (modelo V2 canónico). */
      const rolIdsPorPersona = new Map();
      for (const row of hlcs) {
        const pid = String(row.persona_id || "").trim();
        if (!pid) continue;
        const rid = String(row.rol_id || "").trim();
        if (!rid) continue;
        if (!rolIdsPorPersona.has(pid)) rolIdsPorPersona.set(pid, new Set());
        rolIdsPorPersona.get(pid).add(rid);
      }

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
        const hlcRolIds = Array.from(rolIdsPorPersona.get(personaId) || []).sort();
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
          hlc_rol_ids: hlcRolIds,
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("seguimiento_enrolamiento_rrhh_vistos");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setVistos(parsed);
      }
    } catch {
      setVistos({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("seguimiento_enrolamiento_rrhh_vistos", JSON.stringify(vistos));
    } catch {
      // Ignorar errores de almacenamiento local.
    }
  }, [vistos]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = !t
      ? rows
      : rows.filter((r) =>
      [r.persona_id, r.dni, r.apellido, r.nombre, r.username, r.estado, ...(r.hlc_rol_ids || [])]
          .join(" ")
          .toLowerCase()
          .includes(t),
    );
    const porEstado = estadoFiltro === "TODOS" ? base : base.filter((r) => r.estado === estadoFiltro);
    if (!soloNoVistos) return porEstado;
    return porEstado.filter((r) => !vistos[r.persona_id]);
  }, [q, rows, estadoFiltro, soloNoVistos, vistos]);

  useEffect(() => {
    setPagina(1);
  }, [q, estadoFiltro, soloNoVistos]);

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

  const noVistosCount = useMemo(
    () => rows.filter((r) => !vistos[r.persona_id]).length,
    [rows, vistos],
  );

  const totalPaginas = useMemo(() => {
    const total = Math.ceil(filtradas.length / PAGE_SIZE);
    return total > 0 ? total : 1;
  }, [filtradas.length, PAGE_SIZE]);

  const paginaActual = Math.min(pagina, totalPaginas);

  const filasPagina = useMemo(() => {
    const start = (paginaActual - 1) * PAGE_SIZE;
    return filtradas.slice(start, start + PAGE_SIZE);
  }, [filtradas, paginaActual, PAGE_SIZE]);

  function toggleVisto(personaId) {
    setVistos((prev) => ({
      ...prev,
      [personaId]: !prev[personaId],
    }));
  }

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
      "hlc_rol_ids",
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
          r.hlc_rol_ids.join("|"),
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
            Estado operativo de altas y enrolamiento por persona, con vínculo Auth, onboarding y cuenta. El perfil de
            aplicación se infiere desde <span className="font-mono text-xs">historial_laboral_cargos.rol_id</span>{" "}
            (cfg_rol); ya no se muestra <span className="font-mono text-xs">usuarios_cuenta.role_ids</span>.
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
              placeholder="Buscar por persona_id, DNI, apellido, nombre, username, id cfg_rol en HLc…"
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
                onClick={() => setGlosarioAbierto(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Ver glosario
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
            <button
              type="button"
              onClick={() => setSoloNoVistos((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                soloNoVistos
                  ? "border-amber-600 bg-amber-100 text-amber-900"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Solo no vistos
            </button>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              No vistos ({noVistosCount})
            </span>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Cargando seguimiento...</p>
          ) : filtradas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin resultados para el filtro actual.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {filasPagina.map((r) => (
                <div key={r.persona_id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">
                      {r.apellido} {r.nombre} · DNI {r.dni || "—"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estadoBadgeClass(r.estado)}`}
                      >
                        {ESTADO_ENROLAMIENTO_LABELS[r.estado] || r.estado}
                      </span>
                      <label className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(vistos[r.persona_id])}
                          onChange={() => toggleVisto(r.persona_id)}
                        />
                        Visto {vistos[r.persona_id] ? "✓" : ""}
                      </label>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-slate-700">
                      <span className="font-semibold">Cuenta acceso:</span> {r.username || "No informada"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-semibold">Roles:</span>{" "}
                      {r.hlc_rol_ids.length ? r.hlc_rol_ids.map((id) => labelRol(id)).join(", ") : "Sin rol asignado"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-semibold">Estado acceso:</span> {labelEstadoAcceso(r.estado_acceso)}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-semibold">Estado perfil:</span> {labelEstadoPerfil(r.estado_perfil_datos_id)}
                    </p>
                  </div>

                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="font-semibold text-slate-800">
                      Pendientes para completar:{" "}
                      {buildPendientes(r).length === 0 ? "ninguno" : `${buildPendientes(r).length}`}
                    </p>
                    {buildPendientes(r).length === 0 ? (
                      <p className="mt-1 text-slate-600">Esta persona no tiene tareas pendientes de enrolamiento.</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                        {buildPendientes(r).map((item) => (
                          <li key={`${r.persona_id}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-2 grid gap-1 text-slate-600">
                    <p>
                      <span className="font-semibold">Cuenta Auth vinculada:</span> {r.onboarding_vinculado ? "Sí" : "No"}
                    </p>
                    <p>
                      <span className="font-semibold">Paso A (credenciales y primer login):</span>{" "}
                      {r.onboarding_paso_a ? "Completado" : "Pendiente"}
                    </p>
                    <p>
                      <span className="font-semibold">Paso B (onboarding inicial):</span>{" "}
                      {r.onboarding_paso_b ? "Completado" : "Pendiente"}
                    </p>
                    <p>
                      <span className="font-semibold">Creado en:</span>{" "}
                      {formatMissing(formatDateTime(r.creado_en), "missing")} · <span className="font-semibold">Actor:</span>{" "}
                      {formatMissing(r.creado_por, "missing")}
                    </p>
                    <p>
                      <span className="font-semibold">Primer acceso:</span>{" "}
                      {formatMissing(formatDateTime(r.fecha_primer_acceso), "pending")} ·{" "}
                      <span className="font-semibold">Actor:</span> {formatMissing(r.actor_primer_acceso, "pending")}
                    </p>
                    <p>
                      <span className="font-semibold">Completado:</span>{" "}
                      {formatMissing(formatDateTime(r.fecha_completado), "pending")} ·{" "}
                      <span className="font-semibold">Actor:</span> {formatMissing(r.actor_completado, "pending")}
                    </p>
                  </div>

                  <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <summary className="cursor-pointer font-semibold text-slate-700">
                      Ver detalle técnico (solo referencia)
                    </summary>
                    <div className="mt-2 grid gap-1 text-slate-600">
                      <p>
                        <span className="font-semibold">persona_id:</span> {r.persona_id || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">cuenta_id:</span> {r.cuenta_id || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">auth_uid:</span> {r.auth_uid || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">estado_acceso (id):</span> {r.estado_acceso || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">estado_persona:</span> {r.persona_estado || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">estado_perfil_datos_id:</span> {r.estado_perfil_datos_id || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">roles HLc (cfg_rol ids):</span>{" "}
                        {r.hlc_rol_ids.length ? r.hlc_rol_ids.join(", ") : "—"}
                      </p>
                    </div>
                  </details>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-600">
                  Mostrando {(paginaActual - 1) * PAGE_SIZE + 1} -{" "}
                  {Math.min(paginaActual * PAGE_SIZE, filtradas.length)} de {filtradas.length} registros
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-slate-600">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {glosarioAbierto ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 px-4 py-4 md:py-8">
          <div className="w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:max-h-[90vh] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">Glosario de terminología (solo lectura)</p>
                <p className="mt-1 text-sm text-slate-600">
                  Referencia para interpretar estados y campos del seguimiento de enrolamiento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGlosarioAbierto(false)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Estado de enrolamiento (global)</p>
                <p>NO_INICIADO: alta creada, sin inicio de primer acceso.</p>
                <p>PARCIAL: proceso iniciado, pero faltan hitos para completar.</p>
                <p>COMPLETO: acceso activo + perfil completo.</p>
                <p>INACTIVO: persona o cuenta desactivada.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Estados de acceso (`usuarios_cuenta.estado_acceso`)</p>
                <p>`cfg_eca_pend_reg`: Pendiente de registro.</p>
                <p>`cfg_eca_onb`: Onboarding de datos en curso.</p>
                <p>`cfg_eca_pend_mail`: Pendiente de verificación de correo.</p>
                <p>`cfg_eca_activo`: Acceso activo al portal.</p>
                <p>`cfg_eca_bloq`: Cuenta bloqueada.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  Estados de perfil (`personas.estado_perfil_datos_id`)
                </p>
                <p>`cfg_epd_borr`: Borrador.</p>
                <p>`cfg_epd_inc`: Incompleto.</p>
                <p>`cfg_epd_comp`: Completo.</p>
                <p>`cfg_epd_rec`: Requiere actualización.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Hitos operativos</p>
                <p>Cuenta Auth vinculada: existe vínculo entre persona/cuenta y Auth.</p>
                <p>Paso A: credenciales creadas y primer login inicial.</p>
                <p>Paso B: onboarding inicial confirmado.</p>
                <p>Completado: fecha en la que el flujo detecta cierre de onboarding.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Interpretación de valores vacíos</p>
                <p>Aún no ocurrió: evento esperado pero pendiente.</p>
                <p>No informado: dato esperado, pero no registrado.</p>
                <p>No aplica: campo no corresponde al caso.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
