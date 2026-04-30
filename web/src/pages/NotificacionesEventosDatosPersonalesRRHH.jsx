import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import { callListarColeccion, callRrhhMarcarEventoDatosPersonalesVisto } from "../services/callables.js";

export default function NotificacionesEventosDatosPersonalesRRHH() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function cargar() {
    setLoading(true);
    try {
      const [ev, pe] = await Promise.all([
        callListarColeccion({ collectionName: "eventos_ticket" }),
        callListarColeccion({ collectionName: "personas" }),
      ]);
      const eventos = (ev?.data?.items || []).filter(
        (e) =>
          String(e.tipo_evento_id || "").startsWith("EVT_DATOS_") &&
          String(e.estado_bandeja_rrhh || "pendiente_revision") !== "archivado",
      );
      const idxPersonas = new Map((pe?.data?.items || []).map((p) => [String(p.id), p]));
      const out = eventos
        .map((e) => {
          const p = idxPersonas.get(String(e.persona_id || ""));
          return {
            ...e,
            persona_label: p
              ? `${String(p.apellido || "").trim()} ${String(p.nombre || "").trim()} (${String(p.id || "")})`.trim()
              : String(e.persona_id || "—"),
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

  const pendientes = useMemo(
    () => rows.filter((x) => String(x.estado_bandeja_rrhh || "pendiente_revision") === "pendiente_revision"),
    [rows],
  );

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
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs">
                  <p className="font-mono text-slate-700">{String(r.id || "")}</p>
                  <p className="text-slate-700">
                    {String(r.tipo_evento_id || "—")} · {String(r.persona_label || "—")}
                  </p>
                  <p className="text-slate-600">
                    Estado: {String(r.estado_bandeja_rrhh || "pendiente_revision")} · Ocurrido:{" "}
                    {String(r.ocurrido_en || "—")}
                  </p>
                  {Array.isArray(r.payload?.cambios) && r.payload.cambios.length > 0 && (
                    <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-2">
                      {r.payload.cambios.slice(0, 8).map((c, i) => (
                        <p key={`${r.id}-chg-${i}`} className="text-slate-600">
                          {String(c.campo || "campo")}: {String(c.anterior ?? "null")} {"->"}{" "}
                          {String(c.nuevo ?? "null")}
                        </p>
                      ))}
                    </div>
                  )}
                  {String(r.estado_bandeja_rrhh || "pendiente_revision") === "pendiente_revision" && (
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
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
