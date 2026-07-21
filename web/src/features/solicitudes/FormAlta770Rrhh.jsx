import { useState } from "react";
import toast from "react-hot-toast";

import { callCrearSolicitud770AltaRrhh } from "../../services/callables.js";
import { TICKETERA } from "./ticketeraUi.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

/**
 * Formulario mínimo alta directa Art. 77-0 (RRHH).
 * @param {{
 *   titularPersonaId: string,
 *   titularLabel?: string,
 *   onCancel: () => void,
 *   onOk: (solicitudId: string) => void,
 * }} props
 */
export default function FormAlta770Rrhh({ titularPersonaId, titularLabel, onCancel, onOk }) {
  const [fechaDesde, setFechaDesde] = useState(ymdHoyBa());
  const [observacion, setObservacion] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const fd = String(fechaDesde || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fd)) {
      toast.error("Indicá una fecha válida.");
      return;
    }
    if (!/^per_/i.test(titularPersonaId)) {
      toast.error("Falta titular.");
      return;
    }
    const detalles = observacion.trim();
    if (!detalles) {
      toast.error("Completá el campo Detalles.");
      return;
    }
    setEnviando(true);
    try {
      const res = await callCrearSolicitud770AltaRrhh({
        titular_persona_id: titularPersonaId,
        fecha_desde: fd,
        fecha_hasta: fd,
        dias_solicitados: 1,
        observacion_alta: detalles,
      });
      const solId = String(res?.data?.solicitud_77_0_id || "").trim();
      if (!solId) throw new Error("Sin solicitud_77_0_id en la respuesta.");
      toast.success(`77-0 creado: ${solId}`);
      onOk(solId);
    } catch (e) {
      toast.error(e?.message || "No se pudo crear el Art. 77-0.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
      <h2 className="text-base font-semibold text-slate-900">Alta Art. 77-0</h2>
      <p className={TICKETERA.muted}>
        Inasistencia injustificada · titular{" "}
        <span className="font-medium text-slate-800">{titularLabel || titularPersonaId}</span>
      </p>

      <label className="block space-y-1">
        <span className={TICKETERA.label}>Fecha de la inasistencia</span>
        <input
          type="date"
          className={TICKETERA.input}
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          inputMode="numeric"
        />
      </label>

      <label className="block space-y-1">
        <span className={TICKETERA.label}>Detalles *</span>
        <textarea
          className={`${TICKETERA.input} min-h-[5.5rem] py-2`}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          required
          maxLength={2000}
          placeholder="Detallá el motivo o la referencia interna"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={TICKETERA.btnSecondary} disabled={enviando} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={TICKETERA.btnPrimary}
          disabled={enviando || !observacion.trim()}
          onClick={enviar}
        >
          {enviando ? "Guardando…" : "Confirmar alta"}
        </button>
      </div>
    </div>
  );
}
