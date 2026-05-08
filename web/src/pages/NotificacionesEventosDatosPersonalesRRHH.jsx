import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import {
  callListarColeccion,
  callRrhhListarBandejaEventos,
  callRrhhMarcarEventoDatosPersonalesVisto,
} from "../services/callables.js";

const ESTADO_BANDEJA_ARCHIVADO_ID = "cfg_ebr_arch";
const ESTADO_BANDEJA_PENDIENTE_ID = "cfg_ebr_pend_rev";
const ESTADO_BANDEJA_VISTO_ID = "cfg_ebr_visto";
const PAGE_SIZE_DEFAULT = 10;

function mesEnCursoRangoLocal() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const desde = `${yyyy}-${mm}-01`;
  const lastDay = new Date(yyyy, Number(mm), 0).getDate();
  const hasta = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { desde, hasta, periodo_yyyymm: `${yyyy}-${mm}` };
}

function isEventoDatosPersonales(evento) {
  const tipoId = String(evento?.tipo_evento_id || "").trim().toLowerCase();
  return tipoId.startsWith("cfg_tev_datos_") || tipoId.startsWith("cfg_tev_auth_") || tipoId === "cfg_tev_ddjj";
}

function formatFechaEventoDdMmAaaa(value) {
  let d = null;
  if (value && typeof value.toDate === "function") {
    try {
      d = value.toDate();
    } catch {
      d = null;
    }
  } else if (value && typeof value === "object" && typeof value.seconds === "number") {
    d = new Date(value.seconds * 1000);
  } else if (value && typeof value === "object" && typeof value._seconds === "number") {
    d = new Date(value._seconds * 1000);
  } else {
    d = new Date(String(value || ""));
  }
  if (!(d instanceof Date)) return "—";
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function toDateSafe(value) {
  const raw =
    value && typeof value.toDate === "function"
      ? value.toDate()
      : value && typeof value === "object" && typeof value.seconds === "number"
        ? new Date(value.seconds * 1000)
        : value && typeof value === "object" && typeof value._seconds === "number"
          ? new Date(value._seconds * 1000)
          : new Date(String(value || ""));
  return Number.isNaN(raw.getTime()) ? null : raw;
}

function toYmd(dateObj) {
  if (!(dateObj instanceof Date)) return "";
  const yyyy = String(dateObj.getFullYear());
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeEstadoBandeja(evento) {
  const estadoId = String(
    evento?.estado_bandeja_rrhh_id || evento?.payload?.contexto?.estado_bandeja_rrhh_id || "",
  )
    .trim()
    .toLowerCase();
  return estadoId || ESTADO_BANDEJA_PENDIENTE_ID;
}

function mapAccionToUiLabel(accionRaw) {
  const accion = String(accionRaw || "").trim().toLowerCase();
  if (accion === "notificar_actualizacion_perfil_usuario") return "Actualización perfil usuario";
  if (accion === "notificar_cambio_email_solicitado") return "Cambio correo solicitado";
  if (accion === "notificar_cambio_email_confirmado") return "Cambio correo confirmado";
  if (accion === "notificar_cambio_password") return "Cambio contraseña";
  if (accion === "guardar_actualizacion") return "Actualización de datos";
  if (accion === "guardar_alta") return "Alta de datos";
  return accion || "—";
}

function formatUiError(err, fallbackMsg) {
  const code = String(err?.code || "").trim().toLowerCase();
  const message = String(err?.message || "").trim();
  if (message.includes("[EVT-BANDEJA-001]")) {
    return "Falta índice de Firestore para la bandeja RRHH. Avisá para desplegar índices.";
  }
  if (message.includes("[EVT-BANDEJA-002]")) {
    return "No tenés permisos para leer la bandeja RRHH con esta sesión.";
  }
  if (message.includes("[EVT-BANDEJA-003]") || code.includes("internal")) {
    return "No se pudo cargar la bandeja RRHH. Reintentá en unos segundos.";
  }
  return message || fallbackMsg;
}

function getEstadoStyles(estadoBandeja) {
  if (estadoBandeja === ESTADO_BANDEJA_PENDIENTE_ID) {
    return {
      card: "border-amber-300 bg-amber-50",
      badge: "border-amber-300 bg-amber-100 text-amber-800",
    };
  }
  if (estadoBandeja === ESTADO_BANDEJA_VISTO_ID) {
    return {
      card: "border-emerald-300 bg-emerald-50",
      badge: "border-emerald-300 bg-emerald-100 text-emerald-800",
    };
  }
  return {
    card: "border-slate-200 bg-slate-50",
    badge: "border-slate-300 bg-slate-100 text-slate-700",
  };
}

function marcarVistoLocal(row) {
  const nextPayload = {
    ...(row?.payload && typeof row.payload === "object" ? row.payload : {}),
    contexto: {
      ...((row?.payload?.contexto && typeof row.payload.contexto === "object"
        ? row.payload.contexto
        : {})),
      estado_bandeja_rrhh_id: ESTADO_BANDEJA_VISTO_ID,
    },
  };
  return {
    ...row,
    estado_bandeja_rrhh_id: ESTADO_BANDEJA_VISTO_ID,
    estado_bandeja_id_normalizado: ESTADO_BANDEJA_VISTO_ID,
    estado_bandeja_label: row?.estado_bandeja_label || "Visto",
    payload: nextPayload,
  };
}

export default function NotificacionesEventosDatosPersonalesRRHH() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursorId, setNextCursorId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendientes");
  const [filtroAccion, setFiltroAccion] = useState("todas");
  const [desde, setDesde] = useState(() => mesEnCursoRangoLocal().desde);
  const [hasta, setHasta] = useState(() => mesEnCursoRangoLocal().hasta);
  const [periodoYyyymm] = useState(() => mesEnCursoRangoLocal().periodo_yyyymm);

  async function cargar() {
    setLoading(true);
    try {
      const [ev, pe, te, eb] = await Promise.all([
        callRrhhListarBandejaEventos({ limit: PAGE_SIZE_DEFAULT, periodo_yyyymm: periodoYyyymm }),
        callListarColeccion({ collectionName: "personas" }),
        callListarColeccion({ collectionName: "cfg_tipo_evento" }),
        callListarColeccion({ collectionName: "cfg_estado_bandeja_rrhh" }),
      ]);
      const eventos = (ev?.data?.items || []).filter(
        (e) => isEventoDatosPersonales(e) && normalizeEstadoBandeja(e) !== ESTADO_BANDEJA_ARCHIVADO_ID,
      );
      const idxPersonas = new Map((pe?.data?.items || []).map((p) => [String(p.id), p]));
      const idxTipoEvento = new Map(
        (te?.data?.items || []).map((t) => [
          String(t.id || "").trim().toLowerCase(),
          String(t.nombre || t.titulo_ui || t.codigo_interno || t.id || "").trim(),
        ]),
      );
      const idxEstadoBandeja = new Map(
        (eb?.data?.items || []).map((s) => [
          String(s.id || "").trim().toLowerCase(),
          String(s.nombre || s.titulo_ui || s.codigo_interno || s.id || "").trim(),
        ]),
      );
      const out = eventos
        .map((e) => {
          const p = idxPersonas.get(String(e.persona_id || ""));
          const personaNombreCompleto = p
            ? `${String(p.apellido || "").trim()} ${String(p.nombre || "").trim()}`.trim() || String(p.id || "")
            : String(e.persona_id || "—");
          const personaDni = p ? String(p.dni || "—") : "—";
          const tipoEventoId = String(e.tipo_evento_id || "").trim().toLowerCase();
          const estadoId = normalizeEstadoBandeja(e);
          const fecha = toDateSafe(e.ocurrido_en);
          const actorPersona = idxPersonas.get(String(e.actor_persona_id || ""));
          const actorNombreCompleto = actorPersona
            ? `${String(actorPersona.apellido || "").trim()} ${String(actorPersona.nombre || "").trim()}`.trim() ||
              String(actorPersona.id || "")
            : String(e.actor_persona_id || "—");
          const actorDni = actorPersona ? String(actorPersona.dni || "—") : "—";
          return {
            ...e,
            persona_nombre_completo: personaNombreCompleto,
            persona_dni: personaDni,
            actor_nombre_completo: actorNombreCompleto,
            actor_dni: actorDni,
            tipo_evento_label: idxTipoEvento.get(tipoEventoId) || tipoEventoId || "—",
            estado_bandeja_label: idxEstadoBandeja.get(estadoId) || estadoId || "—",
            estado_bandeja_id_normalizado: estadoId || "—",
            accion_ui: mapAccionToUiLabel(e.accion),
            occurred_date: fecha,
            occurred_ymd: toYmd(fecha),
          };
        })
        .sort((a, b) => String(b.ocurrido_en || "").localeCompare(String(a.ocurrido_en || "")));
      setRows(out);
      setNextCursorId(ev?.data?.page_info?.next_cursor_id || null);
      setHasMore(ev?.data?.page_info?.has_more === true);
    } catch (err) {
      toast.error(formatUiError(err, "No se pudo cargar notificaciones RRHH."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [periodoYyyymm]);

  async function cargarMas() {
    if (!hasMore || !nextCursorId) return;
    setLoadingMore(true);
    try {
      const [ev, pe, te, eb] = await Promise.all([
        callRrhhListarBandejaEventos({
          limit: PAGE_SIZE_DEFAULT,
          periodo_yyyymm: periodoYyyymm,
          cursor_id: nextCursorId,
        }),
        callListarColeccion({ collectionName: "personas" }),
        callListarColeccion({ collectionName: "cfg_tipo_evento" }),
        callListarColeccion({ collectionName: "cfg_estado_bandeja_rrhh" }),
      ]);
      const idxPersonas = new Map((pe?.data?.items || []).map((p) => [String(p.id), p]));
      const idxTipoEvento = new Map(
        (te?.data?.items || []).map((t) => [
          String(t.id || "").trim().toLowerCase(),
          String(t.nombre || t.titulo_ui || t.codigo_interno || t.id || "").trim(),
        ]),
      );
      const idxEstadoBandeja = new Map(
        (eb?.data?.items || []).map((s) => [
          String(s.id || "").trim().toLowerCase(),
          String(s.nombre || s.titulo_ui || s.codigo_interno || s.id || "").trim(),
        ]),
      );
      const nuevos = (ev?.data?.items || []).map((e) => {
        const p = idxPersonas.get(String(e.persona_id || ""));
        const personaNombreCompleto = p
          ? `${String(p.apellido || "").trim()} ${String(p.nombre || "").trim()}`.trim() || String(p.id || "")
          : String(e.persona_id || "—");
        const personaDni = p ? String(p.dni || "—") : "—";
        const actorPersona = idxPersonas.get(String(e.actor_persona_id || ""));
        const actorNombreCompleto = actorPersona
          ? `${String(actorPersona.apellido || "").trim()} ${String(actorPersona.nombre || "").trim()}`.trim() ||
            String(actorPersona.id || "")
          : String(e.actor_persona_id || "—");
        const actorDni = actorPersona ? String(actorPersona.dni || "—") : "—";
        const tipoEventoId = String(e.tipo_evento_id || "").trim().toLowerCase();
        const estadoId = normalizeEstadoBandeja(e);
        return {
          ...e,
          persona_nombre_completo: personaNombreCompleto,
          persona_dni: personaDni,
          actor_nombre_completo: actorNombreCompleto,
          actor_dni: actorDni,
          tipo_evento_label: idxTipoEvento.get(tipoEventoId) || tipoEventoId || "—",
          estado_bandeja_label: idxEstadoBandeja.get(estadoId) || estadoId || "—",
          estado_bandeja_id_normalizado: estadoId || "—",
          accion_ui: mapAccionToUiLabel(e.accion),
          occurred_date: toDateSafe(e.ocurrido_en),
          occurred_ymd: toYmd(toDateSafe(e.ocurrido_en)),
        };
      });
      setRows((prev) => [...prev, ...nuevos]);
      setNextCursorId(ev?.data?.page_info?.next_cursor_id || null);
      setHasMore(ev?.data?.page_info?.has_more === true);
    } catch (err) {
      toast.error(formatUiError(err, "No se pudo cargar más eventos."));
    } finally {
      setLoadingMore(false);
    }
  }

  const pendientes = useMemo(() => rows.filter((x) => normalizeEstadoBandeja(x) === ESTADO_BANDEJA_PENDIENTE_ID), [rows]);
  const vistos = useMemo(() => rows.filter((x) => normalizeEstadoBandeja(x) === ESTADO_BANDEJA_VISTO_ID), [rows]);

  const rowsFiltradas = useMemo(() => {
    const q = String(busqueda || "").trim().toLowerCase();
    const estadoFiltro = String(filtroEstado || "pendientes").trim().toLowerCase();
    return rows
      .filter((r) => {
        const estado = normalizeEstadoBandeja(r);
        if (estadoFiltro === "pendientes") return estado === ESTADO_BANDEJA_PENDIENTE_ID;
        if (estadoFiltro === "vistos") return estado === ESTADO_BANDEJA_VISTO_ID;
        return true;
      })
      .filter((r) => {
        if (filtroAccion === "todas") return true;
        return String(r.accion || "").trim().toLowerCase() === filtroAccion;
      })
      .filter((r) => {
        const ymd = String(r.occurred_ymd || "");
        if (desde && ymd && ymd < desde) return false;
        if (hasta && ymd && ymd > hasta) return false;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        const target = [
          r.persona_nombre_completo,
          r.persona_dni,
          r.persona_id,
          r.id,
          r.accion_ui,
          r.tipo_evento_label,
          r.estado_bandeja_label,
        ]
          .join(" ")
          .toLowerCase();
        return target.includes(q);
      });
  }, [rows, busqueda, filtroEstado, filtroAccion, desde, hasta]);

  const accionesDisponibles = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const accion = String(r.accion || "").trim().toLowerCase();
      if (accion) set.add(accion);
    });
    return [...set].sort();
  }, [rows]);

  async function marcarVisto(id) {
    setBusyId(id);
    try {
      const row = rows.find((r) => String(r.id || "") === String(id || ""));
      const eventoObjetivo = String(row?.evento_id || id || "");
      await callRrhhMarcarEventoDatosPersonalesVisto({ evento_id: eventoObjetivo });
      setRows((prev) =>
        prev.map((item) => {
          const itemId = String(item?.id || "");
          const itemEventoId = String(item?.evento_id || "");
          if (itemId === String(id || "") || itemId === eventoObjetivo || itemEventoId === eventoObjetivo) {
            return marcarVistoLocal(item);
          }
          return item;
        }),
      );
      toast.success("Evento marcado como visto.");
    } catch (err) {
      toast.error(formatUiError(err, "No se pudo marcar como visto."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
            Notificaciones de eventos de Datos Personales para toma de conocimiento
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Bandeja RRHH para revisar eventos notificados por usuarios y cambios auditados en datos personales.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pendientes: <strong>{pendientes.length}</strong> · Total visibles: <strong>{rows.length}</strong>
          </p>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, apellido, DNI, persona_id, evento_id…"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="pendientes">Pendientes</option>
                <option value="vistos">Vistos</option>
                <option value="todos">Todos</option>
              </select>
              <select
                value={filtroAccion}
                onChange={(e) => setFiltroAccion(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="todas">Todas las acciones</option>
                {accionesDisponibles.map((acc) => (
                  <option key={acc} value={acc}>
                    {mapAccionToUiLabel(acc)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void cargar()}
                disabled={loading}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                {loading ? "Refrescando..." : "Refrescar"}
              </button>
            </div>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <label className="text-xs text-slate-600">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
              />
            </label>
            <div className="text-xs text-slate-600 md:col-span-2">
              Resumen filtro
              <div className="mt-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Pendientes: <strong>{pendientes.length}</strong> · Vistos: <strong>{vistos.length}</strong> · Mostrando:{" "}
                <strong>{rowsFiltradas.length}</strong>
              </div>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando notificaciones...</p>
          ) : rowsFiltradas.length === 0 ? (
            <p className="text-sm text-slate-500">Sin notificaciones para mostrar.</p>
          ) : (
            <div className="space-y-3">
              {rowsFiltradas.map((r) => {
                const estadoBandeja = normalizeEstadoBandeja(r);
                const estadoStyles = getEstadoStyles(estadoBandeja);
                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border px-3 py-3 text-xs ${estadoStyles.card}`}
                  >
                    <p className="text-slate-700">
                      {formatFechaEventoDdMmAaaa(r.ocurrido_en)} · {String(r.persona_nombre_completo || "—")} · DNI:{" "}
                      {String(r.persona_dni || "—")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-slate-600">{String(r.tipo_evento_label || "—")}</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estadoStyles.badge}`}
                      >
                        Estado: {String(r.estado_bandeja_label || "—")} (
                        {String(r.estado_bandeja_id_normalizado || estadoBandeja || "—")})
                      </span>
                    </div>
                    {String(r.accion || "").trim() ? (
                      <p className="text-slate-600">Acción: {mapAccionToUiLabel(r.accion)}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] italic text-slate-500">({String(r.id || "—")})</p>
                    {String(r.evento_id || "").trim() ? (
                      <p className="text-[11px] text-slate-500">Evento canónico: {String(r.evento_id)}</p>
                    ) : null}
                    <p className="text-slate-700">
                      Por el USUARIO: {String(r.actor_nombre_completo || "—")} · DNI: {String(r.actor_dni || "—")}
                    </p>
                    {Array.isArray(r.payload?.cambios) && r.payload.cambios.length > 0 && (
                      <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-2">
                        {r.payload.cambios.map((c, i) => (
                          <p key={`${r.id}-chg-${i}`} className="text-slate-600">
                            {String(c.campo || "campo")}: {String(c.antes ?? c.anterior ?? "null")} {"->"}{" "}
                            {String(c.despues ?? c.nuevo ?? "null")}
                          </p>
                        ))}
                      </div>
                    )}
                    {estadoBandeja === ESTADO_BANDEJA_PENDIENTE_ID && (
                      <button
                        type="button"
                        onClick={() => marcarVisto(String(r.id || ""))}
                        disabled={busyId === String(r.id || "")}
                        className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {busyId === String(r.id || "") ? "Marcando..." : "Marcar visto"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!loading && hasMore && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => void cargarMas()}
                disabled={loadingMore}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
