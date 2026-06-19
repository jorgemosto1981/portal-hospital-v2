import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callGuardarCapaFichadaDia } from "../../services/callables.js";
import { laboralCallableErrorMessage } from "../../pages/datos-laborales/callableErrorMessage.js";
import {
  lineasHorarioFichadaReal,
  parseFichadasRealesCelda,
} from "./grillaFichadaPresenciaDisplay.js";
import DiaGrillaFichadaHistorialRrhh from "./DiaGrillaFichadaHistorialRrhh.jsx";

/** @typedef {'menu' | 'agregar' | 'borrar' | 'modificar'} VistaFichadaAbm */

function normalizarHm(v) {
  const s = String(v || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) return "";
  const [h, m] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** @param {Array<Record<string, unknown>>} filas */
function marcasPayloadDesdeFilas(filas) {
  const marcas = [];
  for (const row of filas) {
    if (!row || typeof row !== "object") continue;
    const ing = row.ingreso ? String(row.ingreso).trim() : "";
    const egr = row.egreso ? String(row.egreso).trim() : "";
    const hm = row.hora_hm ? String(row.hora_hm).trim() : "";
    if (ing) marcas.push({ hora_hm: ing, rol: "ingreso" });
    if (egr) marcas.push({ hora_hm: egr, rol: "egreso" });
    if (hm && !ing && !egr) marcas.push({ hora_hm: hm });
  }
  return marcas.filter((m) => m.hora_hm);
}

/**
 * @param {{
 *   personaId: string;
 *   fechaYmd: string;
 *   grupoTrabajoId: string;
 *   celdaVis: Record<string, unknown> | null;
 *   soloLectura?: boolean;
 *   vista: VistaFichadaAbm;
 *   onVistaChange: (v: VistaFichadaAbm) => void;
 *   onCerrar: () => void;
 *   onGuardado?: () => void | Promise<void>;
 *   onInicioGuardadoFichada?: () => void;
 *   onFinalizadoGuardadoFichada?: (result: { ok: boolean }) => void | Promise<void>;
 * }} props
 */
export default function DiaGrillaFichadaAbmPanel({
  personaId,
  fechaYmd,
  grupoTrabajoId,
  celdaVis,
  soloLectura = false,
  vista,
  onVistaChange,
  onCerrar,
  onGuardado,
  onInicioGuardadoFichada,
  onFinalizadoGuardadoFichada,
}) {
  const [motivoModal, setMotivoModal] = useState(null);
  const [ingresoAlta, setIngresoAlta] = useState("");
  const [egresoAlta, setEgresoAlta] = useState("");
  const [filaEditIdx, setFilaEditIdx] = useState(0);
  const [ingresoEdit, setIngresoEdit] = useState("");
  const [egresoEdit, setEgresoEdit] = useState("");
  const [guardando, setGuardando] = useState(false);

  const version = celdaVis?.fichadas_reales_version;
  const filas = useMemo(() => parseFichadasRealesCelda(celdaVis), [celdaVis]);
  const lineas = useMemo(() => lineasHorarioFichadaReal(filas), [filas]);

  const ejecutar = useCallback(
    async (payload) => {
      setGuardando(true);
      onInicioGuardadoFichada?.();
      let guardadoOk = false;
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
          toast("Sin cambios detectados en servidor.", { icon: "ℹ️" });
        } else {
          toast.success("Fichada actualizada.");
        }
        guardadoOk = true;
        setMotivoModal(null);
        setIngresoAlta("");
        setEgresoAlta("");
        await onGuardado?.();
        onVistaChange("menu");
      } catch (e) {
        toast.error(laboralCallableErrorMessage(e, "Error al guardar fichada."));
      } finally {
        setGuardando(false);
        await onFinalizadoGuardadoFichada?.({ ok: guardadoOk });
      }
    },
    [
      personaId,
      grupoTrabajoId,
      fechaYmd,
      version,
      onGuardado,
      onVistaChange,
      onInicioGuardadoFichada,
      onFinalizadoGuardadoFichada,
    ],
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

  const agregarMarcas = async () => {
    const ing = normalizarHm(ingresoAlta);
    const egr = normalizarHm(egresoAlta);
    if (!ing && !egr) {
      toast.error("Indicá al menos ingreso o egreso (HH:MM).");
      return;
    }
    /** @type {Array<{ hora_hm: string; rol?: string }>} */
    const marcas = [];
    if (ing) marcas.push({ hora_hm: ing, rol: "ingreso" });
    if (egr) marcas.push({ hora_hm: egr, rol: "egreso" });
    await ejecutar({
      accion: "AGREGAR_MARCAS",
      motivo: "Alta desde grilla RRHH",
      marcas,
    });
  };

  const iniciarModificar = () => {
    if (!filas.length) {
      toast.error("No hay marcas para modificar.");
      return;
    }
    const idx = 0;
    setFilaEditIdx(idx);
    const row = filas[idx] || {};
    setIngresoEdit(String(row.ingreso || row.hora_hm || "").trim());
    setEgresoEdit(String(row.egreso || "").trim());
    onVistaChange("modificar");
  };

  const guardarModificacion = async () => {
    const ing = normalizarHm(ingresoEdit);
    const egr = normalizarHm(egresoEdit);
    if (!ing && !egr) {
      toast.error("Indicá al menos ingreso o egreso.");
      return;
    }
    const nuevasFilas = filas.map((row, idx) => {
      if (idx !== filaEditIdx) return row;
      return { ingreso: ing || undefined, egreso: egr || undefined };
    });
    await ejecutar({
      accion: "REEMPLAZAR_MARCAS",
      motivo: "Modificación desde grilla RRHH",
      marcas: marcasPayloadDesdeFilas(nuevasFilas),
    });
  };

  if (!personaId || !fechaYmd || !grupoTrabajoId) return null;

  const botonMenu = (label, modo, disabled = false) => (
    <button
      type="button"
      disabled={disabled || guardando || soloLectura}
      onClick={() => {
        if (modo === "modificar") iniciarModificar();
        else onVistaChange(modo);
      }}
      className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-violet-200 bg-white text-sm font-semibold text-violet-900 active:bg-violet-50 disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-violet-950">Fichadas ABM</h4>
        <button
          type="button"
          onClick={vista === "menu" ? onCerrar : () => onVistaChange("menu")}
          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
        >
          {vista === "menu" ? "Cerrar" : "← Menú"}
        </button>
      </div>

      {vista === "menu" ? (
        <>
          <p className="text-xs text-slate-600">
            {lineas.length > 0 ? (
              <>
                Marcas actuales:{" "}
                <span className="font-medium text-slate-800">{lineas.join(" · ")}</span>
              </>
            ) : (
              "Sin marcas en la capa real de este día."
            )}
          </p>
          <div className="flex flex-col gap-2">
            {botonMenu("Agregar marcas", "agregar")}
            {botonMenu("Borrar marcas", "borrar", lineas.length === 0)}
            {botonMenu("Modificar marcas", "modificar", lineas.length === 0)}
          </div>
          <DiaGrillaFichadaHistorialRrhh celdaVis={celdaVis} />
        </>
      ) : null}

      {vista === "agregar" ? (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-600">
            Ingreso y egreso en formato HH:MM. Si el egreso es del día siguiente (turno noche), cargá
            igual la hora de egreso; el sistema la imputa al cierre del turno.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-slate-700">
              Ingreso
              <input
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="HH:MM"
                value={ingresoAlta}
                onChange={(e) => setIngresoAlta(e.target.value)}
                disabled={guardando}
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Egreso
              <input
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="HH:MM"
                value={egresoAlta}
                onChange={(e) => setEgresoAlta(e.target.value)}
                disabled={guardando}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={guardando}
            className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white active:bg-violet-800"
            onClick={agregarMarcas}
          >
            {guardando ? "Guardando…" : "Confirmar alta"}
          </button>
        </div>
      ) : null}

      {vista === "borrar" ? (
        <div className="space-y-2 text-sm">
          {filas.length === 0 ? (
            <p className="text-xs text-slate-600">No hay filas para borrar.</p>
          ) : (
            <ul className="space-y-2">
              {filas.map((row, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-800">{lineas[idx] || "—"}</span>
                  <button
                    type="button"
                    disabled={guardando || soloLectura}
                    className="font-semibold text-rose-700 underline"
                    onClick={() => pedirMotivoYEjecutar("BORRAR_FILA", { fila_index: idx })}
                  >
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filas.length > 0 ? (
            <button
              type="button"
              disabled={guardando || soloLectura}
              className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-rose-300 bg-rose-50 text-sm font-semibold text-rose-900"
              onClick={() => pedirMotivoYEjecutar("BORRAR_CAPA")}
            >
              Limpiar todas las marcas del día
            </button>
          ) : null}
        </div>
      ) : null}

      {vista === "modificar" ? (
        <div className="space-y-3 text-sm">
          {filas.length > 1 ? (
            <label className="block text-xs font-medium text-slate-700">
              Fila a modificar
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={filaEditIdx}
                disabled={guardando}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setFilaEditIdx(idx);
                  const row = filas[idx] || {};
                  setIngresoEdit(String(row.ingreso || row.hora_hm || "").trim());
                  setEgresoEdit(String(row.egreso || "").trim());
                }}
              >
                {filas.map((_, idx) => (
                  <option key={idx} value={idx}>
                    {lineas[idx] || `Fila ${idx + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-slate-700">
              Ingreso
              <input
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="HH:MM"
                value={ingresoEdit}
                onChange={(e) => setIngresoEdit(e.target.value)}
                disabled={guardando}
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Egreso
              <input
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="HH:MM"
                value={egresoEdit}
                onChange={(e) => setEgresoEdit(e.target.value)}
                disabled={guardando}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={guardando}
            className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white active:bg-violet-800"
            onClick={guardarModificacion}
          >
            {guardando ? "Guardando…" : "Guardar modificación"}
          </button>
        </div>
      ) : null}

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
  const titulo =
    accion === "BORRAR_CAPA" ? "Motivo de limpieza de capa" : "Motivo de baja de fila";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <h5 className="text-sm font-semibold text-slate-900">{titulo}</h5>
        <textarea
          className="mt-2 w-full rounded-xl border border-slate-300 p-2 text-sm"
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
            className="rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white"
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
