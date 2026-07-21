import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { AYUDA_AVISO, buildMensajePrimerAccesoAgente } from "./altaNuevoUsuarioAyuda.js";

/**
 * Mensaje copiable — solo visible cuando los 3 hitos del alta están OK.
 * @param {{ habilitado: boolean, dni?: string }} props
 */
export default function AvisoPrimerAccesoRrhh({ habilitado, dni = "" }) {
  const [copiado, setCopiado] = useState(false);

  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const mensaje = useMemo(() => buildMensajePrimerAccesoAgente(origin, dni), [origin, dni]);

  if (!habilitado) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        El aviso al agente se habilita cuando identidad, laboral y check-in estén en verde.
      </div>
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      toast.success("Mensaje copiado al portapapeles");
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto manualmente.");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div>
        <p className="text-base font-semibold text-emerald-950">{AYUDA_AVISO.titulo}</p>
        {AYUDA_AVISO.parrafos.map((p) => (
          <p key={p} className="mt-1 text-sm leading-relaxed text-emerald-900">
            {p}
          </p>
        ))}
      </div>
      <textarea
        readOnly
        value={mensaje}
        rows={5}
        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-slate-800"
        aria-label="Mensaje para el agente"
      />
      <PrimaryButton type="button" onClick={copiar} className="w-full min-h-11 touch-manipulation">
        {copiado ? "Copiado" : "Copiar mensaje para el agente"}
      </PrimaryButton>
    </section>
  );
}
