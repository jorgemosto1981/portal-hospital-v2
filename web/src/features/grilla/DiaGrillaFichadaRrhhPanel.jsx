import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callGuardarCapaFichadaDia } from "../../services/callables.js";
import { laboralCallableErrorMessage } from "../../pages/datos-laborales/callableErrorMessage.js";
import {
  lineasHorarioFichadaReal,
  parseFichadasRealesCelda,
} from "./grillaFichadaPresenciaDisplay.js";
import DiaGrillaFichadaHistorialRrhh from "./DiaGrillaFichadaHistorialRrhh.jsx";

function normalizarHm(v) {
  const s = String(v || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) return "";
  const [h, m] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @param {{
 *   personaId: string;
 *   fechaYmd: string;
 *   grupoTrabajoId: string;
 *   celdaVis: Record<string, unknown> | null;
 *   soloLectura?: boolean;
 *   onGuardado?: () => void | Promise<void>;
 * }} props
 */
export default function DiaGrillaFichadaRrhhPanel({
  personaId,
  fechaYmd,
  grupoTrabajoId,
  celdaVis,
  soloLectura = false,
  onGuardado,
}) {
  const [motivoModal, setMotivoModal] = useState(null);
  const [marcaSueltas, setMarcaSueltas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const version = celdaVis?.fichadas_reales_version;
  const filas = useMemo(() => parseFichadasRealesCelda(celdaVis), [celdaVis]);
  const lineas = useMemo(() => lineasHorarioFichadaReal(filas), [filas]);

  const ejecutar = useCallback(
    async (payload) => {
      setGuardando(true);
      try {
        const res = await callGuardarCapaFichadaDia({
          persona_id: personaId,
          grupo_trabajo_id: grupoTrabajoId,
          fecha_ymd: fechaYmd,
          origen: "GRILLA_ABM",
          version_esperada: version ?? undefined,
          ...payload,
        });
        const data = res?.data;
        if (data?.ok === false) {
          toast.error(data.mensaje || "No se pudo guardar la fichada.");
          return;
        }
        if (data?.write_skipped) {
          toast("El servidor no detectó cambios (marcas ya iguales o alineación sin delta).", { icon: "ℹ️" });
        } else {
          toast.success("Fichada actualizada.");
        }
        setMotivoModal(null);
        setMarcaSueltas("");
        await onGuardado?.();
      } catch (e) {
        toast.error(laboralCallableErrorMessage(e, "Error al guardar fichada."));
      } finally {
        setGuardando(false);
      }
    },
    [personaId, grupoTrabajoId, fechaYmd, version, onGuardado],
  );

  const pedirMotivoYEjecutar = (accion, extra = {}) => {
    setMotivoModal({ accion, extra });
  };

  const confirmarMotivo = async (motivo) => {
    if (!motivoModal) return;
    const m = String(motivo || "").trim();
    if (!m) {
      toast.error("El motivo es obligatorio.");
      return;
    }
    await ejecutar({
      accion: motivoModal.accion,
      motivo: m,
      ...motivoModal.extra,
    });
  };

  const agregarMarcasSueltas = async () => {
    const partes = String(marcaSueltas || "")
      .split(/[\s,;]+/)
      .map(normalizarHm)
      .filter(Boolean);
    if (!partes.length) {
      toast.error("Indicá al menos una hora (HH:MM).");
      return;
    }
    await ejecutar({
      accion: "AGREGAR_MARCAS",
      motivo: "Alta desde grilla RRHH",
      marcas: partes.map((hora_hm) => ({ hora_hm })),
    });
  };

  if (!personaId || !fechaYmd || !grupoTrabajoId) return null;

  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/30 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-900">
        Gestión fichada real (RRHH)
      </h4>
      {lineas.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-800">
          {filas.map((row, idx) => (
            <li key={idx} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
              <span className="font-medium">{lineas[idx] || "—"}</span>
              {!soloLectura ? (
                <button
                  type="button"
                  disabled={guardando}
                  className="text-[11px] font-semibold text-rose-700 underline"
                  onClick={() => pedirMotivoYEjecutar("BORRAR_FILA", { fila_index: idx })}
                >
                  Borrar fila
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-600">Sin marcas en la capa real.</p>
      )}

      {!soloLectura ? (
        <div className="mt-3 space-y-2 text-xs">
          <label className="block">
            <span className="font-medium text-slate-700">Agregar horas (HH:MM, separadas por espacio)</span>
            <input
              type="text"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="06:05 14:00"
              value={marcaSueltas}
              onChange={(e) => setMarcaSueltas(e.target.value)}
              disabled={guardando}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={guardando}
              className="rounded bg-violet-700 px-2 py-1 text-[11px] font-semibold text-white"
              onClick={agregarMarcasSueltas}
            >
              Agregar marcas
            </button>
            {filas.length > 0 ? (
              <button
                type="button"
                disabled={guardando}
                className="rounded border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-800"
                onClick={() => pedirMotivoYEjecutar("BORRAR_CAPA")}
              >
                Limpiar capa (baja lógica)
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <DiaGrillaFichadaHistorialRrhh celdaVis={celdaVis} />

      {motivoModal ? (
        <MotivoBorradoDialog
          accion={motivoModal.accion}
          onCancel={() => setMotivoModal(null)}
          onConfirm={confirmarMotivo}
          guardando={guardando}
        />
      ) : null}
    </div>
  );
}

function MotivoBorradoDialog({ accion, onCancel, onConfirm, guardando }) {
  const [motivo, setMotivo] = useState("");
  const titulo = accion === "BORRAR_CAPA" ? "Motivo de limpieza de capa" : "Motivo de baja de fila";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h5 className="text-sm font-semibold text-slate-900">{titulo}</h5>
        <textarea
          className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Obligatorio para auditoría legal"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="text-sm text-slate-600" onClick={onCancel} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="rounded bg-violet-700 px-3 py-1 text-sm font-semibold text-white"
            disabled={guardando}
            onClick={() => onConfirm(motivo)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
