import { useMemo, useState } from "react";

import ContextNote from "../ContextNote.jsx";
import { getVencimientoDocumental } from "../../../utils/licencias/plazos.js";

/**
 * @param {{ value: string, label: string }[] | undefined} options
 * @param {string} id
 */
function etiquetaCatalogo(options, id) {
  if (!id || !Array.isArray(options)) return "";
  const s = String(id).trim();
  const found = options.find(
    (o) => o.value === s || String(o.value).toLowerCase() === s.toLowerCase(),
  );
  return found?.label?.trim() || "";
}

/**
 * Texto principal para UI: nombre legible; si no hay catálogo, el ID.
 * @param {{ value: string, label: string }[] | undefined} options
 * @param {string} id
 */
function textoOpcion(options, id) {
  if (!id) return "sin definir";
  const label = etiquetaCatalogo(options, id);
  return label || id;
}

/**
 * @param {object} props
 * @param {string} props.tituloCampo
 * @param {string} props.id
 * @param {{ value: string, label: string }[] | undefined} props.options
 */
function LineaCatalogo({ tituloCampo, id, options }) {
  const label = etiquetaCatalogo(options, id);
  const principal = id ? label || id : "sin definir";
  const titleTip =
    id && label && label !== id ? `${label} — ${id}` : id && !label ? `ID: ${id}` : undefined;

  return (
    <li>
      {tituloCampo}:{" "}
      <strong className="cursor-help" title={titleTip}>
        {principal}
      </strong>
    </li>
  );
}

/**
 * @param {string} s
 * @returns {Array<{ fecha: string, alcance_efector_id?: string | null }>}
 */
function parseFeriadosInput(s) {
  const rows = String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return rows
    .map((line) => {
      const [fechaRaw, efectorRaw] = line.split("|").map((x) => String(x || "").trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) return null;
      return {
        fecha: fechaRaw,
        alcance_efector_id: efectorRaw || null,
      };
    })
    .filter(Boolean);
}

/**
 * @param {string} s
 * @returns {string[]}
 */
function parseFechasInput(s) {
  return String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
}

/**
 * @param {string} s
 * @returns {string[]}
 */
function parseEfectoresInput(s) {
  return String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * @param {string} fechaIso
 */
function diaSiguiente(fechaIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaIso || ""))) return "";
  const d = new Date(`${fechaIso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Documentación diferida + simulador de vencimiento.
 * @param {object} props
 * @param {object} props.data
 * @param {Record<string, { options?: { value: string, label: string }[] }>} [props.catalogosPlazos]
 * @param {Record<string, { options?: { value: string, label: string }[] }>} [props.catalogosElegibilidad]
 */
export default function DocumentacionTab({ data, catalogosPlazos, catalogosElegibilidad }) {
  const [ultimoDiaLicencia, setUltimoDiaLicencia] = useState("");
  const [laborablesRaw, setLaborablesRaw] = useState("");
  const [feriadosRaw, setFeriadosRaw] = useState("");
  const [efectoresRaw, setEfectoresRaw] = useState("");

  const optMomento = catalogosPlazos?.momentoEntrega?.options ?? [];
  const optTcp = catalogosPlazos?.tipoComputoPlazo?.options ?? [];
  const optAv = catalogosPlazos?.accionVencimiento?.options ?? [];
  const optEfectores = catalogosElegibilidad?.efector?.options ?? [];

  const docDiff = data.documentacion_diferida_habilitada === true;
  const momentoEntrega =
    typeof data.momento_entrega_documentacion_id === "string"
      ? data.momento_entrega_documentacion_id
      : "";
  const tipoComputo =
    typeof data.plazo_documental_tipo_dias_id === "string" ? data.plazo_documental_tipo_dias_id : "";
  const accionVencimiento =
    typeof data.accion_vencimiento_documental_id === "string"
      ? data.accion_vencimiento_documental_id
      : "";
  const diasPlazo =
    typeof data.plazo_documental_post_inicio_dias === "number" && Number.isFinite(data.plazo_documental_post_inicio_dias)
      ? data.plazo_documental_post_inicio_dias
      : null;

  const simulacion = useMemo(() => {
    const laborables = parseFechasInput(laborablesRaw);
    const feriados = parseFeriadosInput(feriadosRaw);
    const efectores = parseEfectoresInput(efectoresRaw);
    const depurados = getVencimientoDocumental(laborables, feriados, efectores);
    const vencimiento =
      diasPlazo && diasPlazo > 0 && depurados.length >= diasPlazo ? depurados[diasPlazo - 1] : "";
    return {
      laborables,
      feriados,
      efectores,
      depurados,
      vencimiento,
      ancla: diaSiguiente(ultimoDiaLicencia),
    };
  }, [laborablesRaw, feriadosRaw, efectoresRaw, ultimoDiaLicencia, diasPlazo]);

  const efectoresSimuladorLegibles = useMemo(() => {
    const ids = parseEfectoresInput(efectoresRaw);
    if (!ids.length) return "";
    return ids.map((id) => etiquetaCatalogo(optEfectores, id) || id).join(", ");
  }, [efectoresRaw, optEfectores]);

  const feriadosSimuladorLegibles = useMemo(() => {
    return simulacion.feriados
      .map((f) => {
        const alcance = f.alcance_efector_id
          ? etiquetaCatalogo(optEfectores, f.alcance_efector_id) || f.alcance_efector_id
          : "todos los efectores";
        return `${f.fecha} · ${alcance}`;
      })
      .join(" · ");
  }, [simulacion.feriados, optEfectores]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <p>
          Esta pestaña muestra el impacto documental del artículo y permite simular vencimiento con fechas
          laborables (MDC) y feriados institucionales (`cfg_cfi_*`).
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="text-base font-semibold text-slate-900">Parámetros documentales activos</h3>
        <ul className="mt-3 space-y-1 text-sm text-slate-800">
          <li>
            Documentación diferida: <strong>{docDiff ? "habilitada" : "deshabilitada"}</strong>
          </li>
          <LineaCatalogo tituloCampo="Momento de entrega" id={momentoEntrega} options={optMomento} />
          <LineaCatalogo tituloCampo="Tipo de cómputo" id={tipoComputo} options={optTcp} />
          <li>
            Días de plazo post inicio: <strong>{diasPlazo ?? "sin definir"}</strong>
          </li>
          <LineaCatalogo tituloCampo="Acción al vencer" id={accionVencimiento} options={optAv} />
        </ul>
        <ContextNote>
          En aprobación parcial/split, el ancla documental usa el último día del tramo efectivamente
          aprobado.
        </ContextNote>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Simulador rápido de vencimiento</h3>
        <p className="mt-1 text-xs text-slate-500">
          Cargá ejemplos para validar impacto operativo antes de publicar reglas.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Último día de licencia</span>
            <input
              type="date"
              value={ultimoDiaLicencia}
              onChange={(e) => setUltimoDiaLicencia(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Efectores del agente (IDs <span className="font-mono text-xs">cfg_efe_*</span>, coma)
            </span>
            <input
              type="text"
              value={efectoresRaw}
              onChange={(e) => setEfectoresRaw(e.target.value)}
              placeholder="Ej.: CFG_EFE_HOSPITAL_CENTRAL, CFG_EFE_SAMCO_NORTE"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
              autoComplete="off"
            />
            {efectoresSimuladorLegibles ? (
              <p className="mt-1.5 text-xs leading-snug text-slate-600">
                <span className="font-medium text-slate-700">Nombre según catálogo:</span>{" "}
                {efectoresSimuladorLegibles}
              </p>
            ) : null}
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Fechas laborables (una por línea)
            </span>
            <textarea
              rows={6}
              value={laborablesRaw}
              onChange={(e) => setLaborablesRaw(e.target.value)}
              placeholder={"2026-05-12\n2026-05-13\n2026-05-14"}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Feriados institucionales (YYYY-MM-DD|EFECTOR_ID opcional)
            </span>
            <textarea
              rows={6}
              value={feriadosRaw}
              onChange={(e) => setFeriadosRaw(e.target.value)}
              placeholder={"2026-05-13|\n2026-05-14|CFG_EFE_HOSPITAL_CENTRAL"}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Ancla simulada (día posterior): <strong>{simulacion.ancla || "sin fecha"}</strong>
          </p>
          <p>
            Laborables cargados: <strong>{simulacion.laborables.length}</strong> · Feriados cargados:{" "}
            <strong>{simulacion.feriados.length}</strong>
          </p>
          {feriadosSimuladorLegibles ? (
            <p className="mt-1 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Feriados (fecha · alcance):</span>{" "}
              {feriadosSimuladorLegibles}
            </p>
          ) : null}
          <p>
            Laborables válidos tras restar feriados: <strong>{simulacion.depurados.length}</strong>
          </p>
          <p>
            Vencimiento simulado: <strong>{simulacion.vencimiento || "no calculable aún"}</strong>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Resumen final de impacto (Documentación)</h3>
        <ul className="mt-2 space-y-1 text-sm text-emerald-900">
          <li>
            Control documental: <strong>{docDiff ? "activo" : "inactivo"}</strong>.
          </li>
          <li>
            Si está activo, el sistema exigirá documentación según{" "}
            <strong>{textoOpcion(optMomento, momentoEntrega)}</strong>.
          </li>
          <li>
            El vencimiento se calcula con <strong>{textoOpcion(optTcp, tipoComputo)}</strong> y plazo{" "}
            <strong>{diasPlazo ?? "sin días definidos"}</strong>.
          </li>
          <li>
            Al vencer sin documentación: <strong>{textoOpcion(optAv, accionVencimiento)}</strong>.
          </li>
        </ul>
      </section>
    </div>
  );
}
