import BandejaSolicitudExpandDatos from "./BandejaSolicitudExpandDatos.jsx";
import BandejaAuditorPreviewTramos from "./BandejaAuditorPreviewTramos.jsx";
import BandejaAuditorArticuloImputacionSelect from "./BandejaAuditorArticuloImputacionSelect.jsx";
import FichaIngresoAgente from "./FichaIngresoAgente.jsx";
import VisorPDF from "../../components/medico/VisorPDF.jsx";
import {
  diasCorridosBandejaAuditor,
  fechasModificadasPorAuditor,
  fechasSolicitudCompletas,
} from "./bandejaAuditorFechasUi.js";

function textoDiagnostico(sel) {
  const cod = String(sel?.cie10_codigo || "").trim();
  const desc = String(sel?.cie10_descripcion || "").trim();
  if (cod && desc) return `${cod} — ${desc}`;
  return desc || cod || "";
}

export default function BandejaAuditorSolicitudDetalle({
  sel,
  selPreview,
  fechaDesdeEdit,
  fechaHastaEdit,
  fechaDesdeOriginal,
  fechaHastaOriginal,
  onFechaDesdeChange,
  onFechaHastaChange,
  imputacionArticulo,
  onImputacionArticuloChange,
  observacion,
  setObservacion,
  procesando,
  onClasificar,
}) {
  if (!sel) return null;

  const fechasValidas = fechasSolicitudCompletas(fechaDesdeEdit, fechaHastaEdit);
  const fechasModificadas = fechasModificadasPorAuditor(
    fechaDesdeOriginal,
    fechaHastaOriginal,
    fechaDesdeEdit,
    fechaHastaEdit,
  );
  const dias = diasCorridosBandejaAuditor(fechaDesdeEdit, fechaHastaEdit) || Number(sel.dias_solicitados) || 1;
  const esLarga = sel.es_licencia_larga === true;
  const juntaHint = dias > 15;
  const diagnostico = textoDiagnostico(sel);
  const adjuntos = Array.isArray(sel.certificado_adjuntos) ? sel.certificado_adjuntos : [];
  const tieneCertificado = sel.tiene_certificado === true || adjuntos.length > 0;
  const previewSel = selPreview || sel;

  return (
    <div className="space-y-4 border-t border-teal-100 bg-teal-50/30 px-4 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del aviso médico</p>
        <div className="mt-2">
          <BandejaSolicitudExpandDatos sel={sel} variant="auditor" />
        </div>
      </div>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Certificado médico</p>
        {tieneCertificado && adjuntos[0] ? (
          <>
            {adjuntos.length > 1 ? (
              <p className="text-xs text-slate-500">
                {adjuntos.length} archivos en el aviso — mostrando el primero.
              </p>
            ) : null}
            <VisorPDF adjunto={adjuntos[0]} />
          </>
        ) : (
          <p className="text-sm text-slate-500">Sin certificado adjunto en este aviso.</p>
        )}
      </section>

      <FichaIngresoAgente
        ficha={sel.ficha_ingreso_agente}
        titularPersonaId={sel.titular_persona_id}
        solicitudIdExcluir={sel.solicitud_id}
      />

      <BandejaAuditorArticuloImputacionSelect
        sel={sel}
        imputacion={imputacionArticulo}
        onImputacionChange={onImputacionArticuloChange}
      />

      {sel.puede_clasificar === true ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rango de licencia (dictamen)
          </p>
          <p className="text-xs text-slate-500">
            Podés ajustar las fechas respecto al aviso del agente. El preview y el dictamen usan este rango.
          </p>
          {fechasModificadas ? (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              Atención: Estás modificando el rango de fechas original solicitado por el agente.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Desde</span>
              <input
                type="date"
                value={fechaDesdeEdit}
                onChange={(e) => onFechaDesdeChange(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Hasta</span>
              <input
                type="date"
                value={fechaHastaEdit}
                min={fechaDesdeEdit || undefined}
                onChange={(e) => onFechaHastaChange(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
          {!fechasValidas ? (
            <p className="text-sm text-red-800">Indicá un rango válido (desde ≤ hasta).</p>
          ) : (
            <p className="text-xs text-slate-600">{dias} día{dias === 1 ? "" : "s"} corridos en el rango editado.</p>
          )}
        </section>
      ) : null}

      <BandejaAuditorPreviewTramos sel={previewSel} imputacionArticulo={imputacionArticulo} />

      {esLarga ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Datos médicos — licencia larga (Art. 16/19)
          </p>
          {sel.causal_larga_nombre ? (
            <p className="text-sm text-slate-800">
              <span className="font-medium text-slate-600">Causal (Art. 19):</span>{" "}
              {String(sel.causal_larga_nombre)}
            </p>
          ) : sel.causal_larga_duracion_id ? (
            <p className="text-sm text-amber-900">
              Causal registrada ({String(sel.causal_larga_duracion_id)}); sin etiqueta en catálogo.
            </p>
          ) : (
            <p className="text-sm text-amber-900">
              Falta causal de larga duración en el aviso. El agente debe completarla antes de clasificar.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Diagnóstico (CIE-10)</span>
            <input
              type="text"
              readOnly
              value={diagnostico}
              placeholder="Sin diagnóstico CIE-10 en el aviso"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
            />
            <span className="text-xs text-slate-500">
              Solo lectura — proviene del alta del agente (wizard). No se edita en auditoría.
            </span>
          </label>
        </section>
      ) : null}

      {sel.es_licencia_incompleta === true ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aviso provisorio: el agente debe completar el certificado antes de clasificar. Usá el filtro
          &quot;Completas&quot; para la cola de auditoría.
        </p>
      ) : null}

      {sel.puede_clasificar === true ? (
        <>
          {juntaHint ? (
            <p className="text-sm text-slate-700">
              Este tramo supera 15 días corridos. Un dictamen <strong>favorable</strong> derivará a junta médica;
              desfavorable rechaza el aviso.
              {esLarga ? " Episodio continuo (motor S_MED_LARGA)." : ""}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              {esLarga
                ? "Dictamen favorable aprueba la licencia larga y consolida en grilla (S_MED_LARGA); desfavorable rechaza."
                : "Dictamen favorable aprueba la licencia corta (Art. 14) y consolida en grilla; desfavorable rechaza."}
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Observación del auditor (opcional)</span>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              placeholder="Notas de clasificación"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando || !fechasValidas}
              onClick={() => onClasificar(true)}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Dictamen favorable
            </button>
            <button
              type="button"
              disabled={procesando || !fechasValidas}
              onClick={() => onClasificar(false)}
              className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Dictamen desfavorable
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">Sin acciones de clasificación para este ítem.</p>
      )}
    </div>
  );
}
