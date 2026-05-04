import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import { callListarColeccion, callRrhhMarcarEventoDatosPersonalesVisto } from "../services/callables.js";

const ESTADO_BANDEJA_ARCHIVADO_ID = "cfg_ebr_arch";
const ESTADO_BANDEJA_PENDIENTE_ID = "cfg_ebr_pend_rev";

function isEventoDatosPersonales(evento) {
  const tipoCfgId = String(evento?.tipo_evento_cfg_id || "").trim().toLowerCase();
  return tipoCfgId.startsWith("cfg_tev_datos_");
}

function formatFechaEventoDdMmAaaa(value) {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function normalizeEstadoBandeja(evento) {
  const estadoId = String(evento?.estado_bandeja_rrhh_id || "").trim().toLowerCase();
  return estadoId || ESTADO_BANDEJA_PENDIENTE_ID;
}

export default function NotificacionesEventosDatosPersonalesRRHH() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function cargar() {
    setLoading(true);
    try {
      const [ev, pe, te, eb] = await Promise.all([
        callListarColeccion({ collectionName: "eventos_ticket" }),
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
          const tipoEventoId = String(e.tipo_evento_cfg_id || "").trim().toLowerCase();
          const estadoId = normalizeEstadoBandeja(e);
          return {
            ...e,
            persona_nombre_completo: personaNombreCompleto,
            persona_dni: personaDni,
            tipo_evento_label: idxTipoEvento.get(tipoEventoId) || tipoEventoId || "—",
            estado_bandeja_label: idxEstadoBandeja.get(estadoId) || estadoId || "—",
            estado_bandeja_id_normalizado: estadoId || "—",
          };
        })
        .sort((a, b) => String(b.ocurrido_en || "").localeCompare(String(a.ocurrido_en || "")));
      setRows(out);
    } catch (err) {
      const msg = (err && err.message) || "No se pudo cargar notificaciones RRHH.";
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const pendientes = useMemo(() => rows.filter((x) => normalizeEstadoBandeja(x) === ESTADO_BANDEJA_PENDIENTE_ID), [rows]);

  async function marcarVisto(id) {
    setBusyId(id);
    try {
      await callRrhhMarcarEventoDatosPersonalesVisto({ evento_id: id });
      toast.success("Evento marcado como visto.");
      await cargar();
    } catch (err) {
      const msg = (err && err.message) || "No se pudo marcar como visto.";
      toast.error(String(msg));
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
          {loading ? (
            <p className="text-sm text-slate-500">Cargando notificaciones...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin notificaciones para mostrar.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const estadoBandeja = normalizeEstadoBandeja(r);
                return (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs">
                    <p className="text-slate-700">
                      {formatFechaEventoDdMmAaaa(r.ocurrido_en)} · {String(r.persona_nombre_completo || "—")} · DNI:{" "}
                      {String(r.persona_dni || "—")}
                    </p>
                    <p className="text-slate-600">
                      {String(r.tipo_evento_label || "—")} · Estado: {String(r.estado_bandeja_label || "—")} (
                      {String(r.estado_bandeja_id_normalizado || estadoBandeja || "—")})
                    </p>
                    <p className="mt-0.5 text-[11px] italic text-slate-500">({String(r.id || "—")})</p>
                    {Array.isArray(r.payload?.cambios) && r.payload.cambios.length > 0 && (
                      <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-2">
                        {r.payload.cambios.map((c, i) => (
                          <p key={`${r.id}-chg-${i}`} className="text-slate-600">
                            {String(c.campo || "campo")}: {String(c.anterior ?? "null")} {"->"}{" "}
                            {String(c.nuevo ?? "null")}
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
        </Card>
      </div>
    </div>
  );
}
