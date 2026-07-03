import HistorialLMCollapse from "./HistorialLMCollapse.jsx";
import { etiquetaTipoAvisoMedico } from "./avisoMedicoProvisorioUi.js";
import {
  esFichaAtencionFamiliar,
  fichaIngresoAgenteTieneDatos,
  filasClinicaFichaIngreso,
  filasContactoFichaIngreso,
  filasContextoFichaIngreso,
  textoFamiliarAtendido,
} from "./fichaIngresoAgenteUi.js";

/**
 * @param {{ label: string, filas: Array<{ key: string, label: string, value: string }> }} props
 */
function BloqueFicha({ label, filas }) {
  if (!filas.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <dl className="grid gap-2">
        {filas.map(({ key, label: rowLabel, value }) => (
          <div
            key={key}
            className="grid grid-cols-1 gap-0.5 sm:grid-cols-[minmax(7rem,9.5rem)_1fr] sm:gap-3"
          >
            <dt className="text-xs font-medium text-slate-600">{rowLabel}</dt>
            <dd className="whitespace-pre-wrap text-sm leading-snug text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Ficha de ingreso declarada por el agente (solo lectura) — bandeja auditoría médica.
 * @param {{
 *   ficha?: Record<string, unknown> | null,
 *   titularPersonaId?: string | null,
 *   solicitudIdExcluir?: string | null,
 * }} props
 */
export default function FichaIngresoAgente({
  ficha = null,
  titularPersonaId = null,
  solicitudIdExcluir = null,
}) {
  if (!fichaIngresoAgenteTieneDatos(ficha)) {
    return (
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ficha del aviso (agente)
        </p>
        <p className="text-sm text-slate-500">
          Sin datos de ingreso en este ítem. Si el aviso es reciente, actualizá la bandeja tras el
          despliegue del listado ampliado.
        </p>
      </section>
    );
  }

  const tipoLabel = etiquetaTipoAvisoMedico(ficha?.tipo_ingreso_id);
  const contexto = filasContextoFichaIngreso(ficha);
  const contacto = filasContactoFichaIngreso(ficha);
  const clinica = filasClinicaFichaIngreso(ficha);
  const familiar = esFichaAtencionFamiliar(ficha) ? textoFamiliarAtendido(ficha) : "";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ficha del aviso (agente)
        </p>
        {tipoLabel ? (
          <span className="inline-flex min-h-7 items-center rounded-full bg-teal-100 px-2.5 text-xs font-semibold text-teal-900">
            {tipoLabel}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Datos declarados por el titular al dar el aviso. Solo lectura — no reemplaza el certificado
        médico.
      </p>

      {familiar ? (
        <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2.5">
          <p className="text-xs font-semibold text-sky-900">Familiar atendido</p>
          <p className="mt-1 text-sm text-sky-950">{familiar}</p>
        </div>
      ) : null}

      <BloqueFicha label="Contexto" filas={contexto} />
      <BloqueFicha label="Contacto" filas={contacto} />
      <BloqueFicha label="Declaración clínica" filas={clinica} />

      <HistorialLMCollapse
        titularPersonaId={titularPersonaId}
        solicitudIdExcluir={solicitudIdExcluir}
      />
    </section>
  );
}
