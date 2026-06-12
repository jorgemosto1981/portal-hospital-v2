import { useState } from "react";

/**
 * @param {{
 *   abierto: boolean;
 *   titulo: string;
 *   onCerrar: () => void;
 *   onConfirmar: (motivo: string) => void | Promise<void>;
 *   busy?: boolean;
 * }} props
 */
export default function ModalMotivoAuditoria({ abierto, titulo, onCerrar, onConfirmar, busy }) {
  const [motivo, setMotivo] = useState("");

  if (!abierto) return null;

  const handleConfirm = async () => {
    const m = motivo.trim();
    if (m.length < 3) return;
    await onConfirmar(m);
    setMotivo("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-motivo-titulo"
      >
        <h2 id="modal-motivo-titulo" className="text-lg font-semibold text-slate-900">
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Motivo corto de auditoría (obligatorio).</p>
        <textarea
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: tarjeta duplicada en enrolamiento"
          disabled={busy}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => {
              setMotivo("");
              onCerrar();
            }}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handleConfirm}
            disabled={busy || motivo.trim().length < 3}
          >
            {busy ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
