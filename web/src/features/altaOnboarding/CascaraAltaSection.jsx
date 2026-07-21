import { useState } from "react";
import toast from "react-hot-toast";

import { AltaAgenteForm } from "../rrhh/sections/RrhhForms.jsx";
import { buildAltaAgentePayload, normalizeDni } from "../rrhh/utils.js";
import { callRrhhAltaAgente } from "../../services/callables.js";
import { AYUDA_IDENTIDAD } from "./altaNuevoUsuarioAyuda.js";

/**
 * Formulario de cáscara embebido en el hub de alta.
 * @param {{ onCreado: (personaId: string) => void }} props
 */
export default function CascaraAltaSection({ onCreado }) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{6,12}$/.test(normalizeDni(dni))) {
      toast.error("DNI: 6 a 12 dígitos.");
      return;
    }
    setBusy(true);
    const t = toast.loading("Creando identidad del agente…");
    try {
      const { data } = await callRrhhAltaAgente(buildAltaAgentePayload({ dni, nombre, apellido }));
      if (!data?.ok) throw new Error();
      const per = String(data.persona_id || "").trim();
      toast.success(`Identidad creada: ${per}`, { id: t, duration: 5000 });
      setDni("");
      setNombre("");
      setApellido("");
      if (/^per_/i.test(per)) onCreado?.(per);
    } catch (err) {
      const msg =
        (err && /** @type {{ message?: string }} */ (err).message) || "Revisá DNI o permisos de RRHH";
      toast.error(String(msg), { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{AYUDA_IDENTIDAD.titulo}</p>
        {AYUDA_IDENTIDAD.parrafos.map((p) => (
          <p key={p} className="mt-1 leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <AltaAgenteForm
        handleSubmit={handleSubmit}
        dni={dni}
        setDni={setDni}
        nombre={nombre}
        setNombre={setNombre}
        apellido={apellido}
        setApellido={setApellido}
        busy={busy}
      />
    </section>
  );
}
