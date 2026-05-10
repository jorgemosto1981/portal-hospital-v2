/**
 * Plazos y documentación diferida: campos de `cfg_articulos` alineados al schema.
 */
function PlazoSelect({ id, label, hint, catalogo, value, onChange, emptyLabel, fieldError }) {
  const disabled = catalogo.status === "loading";

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {catalogo.status === "loading" ? (
        <p className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Cargando opciones…
        </p>
      ) : catalogo.status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {catalogo.error || "Error"}
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation disabled:opacity-60"
        >
          <option value="">{emptyLabel}</option>
          {catalogo.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {catalogo.status === "ok" && catalogo.options.length === 0 ? (
        <p className="text-xs text-amber-700">No hay opciones: cargá filas en Configuración maestra.</p>
      ) : null}
      {fieldError ? (
        <span className="block text-sm text-red-600" role="alert">
          {fieldError}
        </span>
      ) : null}
    </div>
  );
}

function ContextNote({ children }) {
  return (
    <p className="mt-1 rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1 text-xs text-blue-900">
      <strong>Efecto:</strong> {children}
    </p>
  );
}

export default function PlazosTab({ data, update, errors, catalogosPlazos, onRecargarCatalogos }) {
  const fe = errors?.fieldErrors || {};

  const docDiff = data.documentacion_diferida_habilitada === true;
  const momentoId =
    typeof data.momento_entrega_documentacion_id === "string"
      ? data.momento_entrega_documentacion_id
      : "";
  const tcpId =
    typeof data.plazo_documental_tipo_dias_id === "string" ? data.plazo_documental_tipo_dias_id : "";
  const accionId =
    typeof data.accion_vencimiento_documental_id === "string"
      ? data.accion_vencimiento_documental_id
      : "";
  const momentoLabel = catalogosPlazos.momentoEntrega?.options?.find((o) => o.value === momentoId)?.label;
  const tcpLabel = catalogosPlazos.tipoComputoPlazo?.options?.find((o) => o.value === tcpId)?.label;
  const accionLabel = catalogosPlazos.accionVencimiento?.options?.find((o) => o.value === accionId)?.label;

  const diasRaw = data.plazo_documental_post_inicio_dias;
  const diasStr =
    typeof diasRaw === "number" && Number.isFinite(diasRaw) ? String(diasRaw) : "";

  const setOptionalId = (key, raw) => {
    const v = String(raw || "").trim();
    update.field(key, v.length ? v : undefined);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <p>
          Define cómo corre el plazo documental posterior al inicio de la licencia y qué pasa si vence.
          Los catálogos se administran en{" "}
          <span className="font-semibold text-slate-800">Configuración maestra → Artículos</span>.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRecargarCatalogos?.()}
        className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50"
      >
        Recargar catálogos
      </button>

      <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          checked={docDiff}
          onChange={(e) => update.field("documentacion_diferida_habilitada", e.target.checked)}
        />
        <span>
          <span className="font-medium">Documentación diferida habilitada</span>
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Permite exigir documentación después del último día de licencia (política institucional).
          </span>
        </span>
      </label>
      <ContextNote>
        Si está desactivada, no se exige documentación posterior al tramo aprobado de licencia.
      </ContextNote>

      <div className="grid gap-5 sm:grid-cols-2">
        <PlazoSelect
          id="momento_entrega_documentacion_id"
          label="Momento de entrega de documentación"
          hint="Antes / después / mixto (catálogo)."
          catalogo={catalogosPlazos.momentoEntrega}
          value={momentoId}
          onChange={(v) => setOptionalId("momento_entrega_documentacion_id", v)}
          emptyLabel="Sin selección"
          fieldError={fe.momento_entrega_documentacion_id?.[0]}
        />
        {momentoLabel ? (
          <ContextNote>
            El artículo exige documentación en modalidad <strong>{momentoLabel}</strong>.
          </ContextNote>
        ) : null}
        <PlazoSelect
          id="plazo_documental_tipo_dias_id"
          label="Tipo de cómputo del plazo documental"
          hint="Referencia cfg_tipo_computo_plazo (corrido, hábil compuesto, etc.)."
          catalogo={catalogosPlazos.tipoComputoPlazo}
          value={tcpId}
          onChange={(v) => setOptionalId("plazo_documental_tipo_dias_id", v)}
          emptyLabel="Sin selección"
          fieldError={fe.plazo_documental_tipo_dias_id?.[0]}
        />
        {tcpLabel ? (
          <ContextNote>
            El vencimiento se calcula según <strong>{tcpLabel}</strong>.
          </ContextNote>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="plazo_documental_post_inicio_dias" className="block text-sm font-medium text-slate-700">
            Plazo documental (días después del inicio)
          </label>
          <p className="text-xs text-slate-500">Entero ≥ 0 según normativa del artículo.</p>
          <input
            id="plazo_documental_post_inicio_dias"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
            placeholder="Ej. 10"
            value={diasStr}
            onChange={(e) => {
              const t = e.target.value.trim();
              if (t === "") {
                update.field("plazo_documental_post_inicio_dias", undefined);
                return;
              }
              const n = parseInt(t, 10);
              if (!Number.isFinite(n) || n < 0) return;
              update.field("plazo_documental_post_inicio_dias", n);
            }}
          />
          {fe.plazo_documental_post_inicio_dias?.[0] ? (
            <span className="block text-sm text-red-600" role="alert">
              {fe.plazo_documental_post_inicio_dias[0]}
            </span>
          ) : null}
        </div>

        <PlazoSelect
          id="accion_vencimiento_documental_id"
          label="Acción si vence el plazo documental"
          hint="Catálogo cfg_accion_vencimiento (alerta, escalamiento, etc.)."
          catalogo={catalogosPlazos.accionVencimiento}
          value={accionId}
          onChange={(v) => setOptionalId("accion_vencimiento_documental_id", v)}
          emptyLabel="Sin selección"
          fieldError={fe.accion_vencimiento_documental_id?.[0]}
        />
        {accionLabel ? (
          <ContextNote>
            Si vence el plazo sin documentación, se ejecuta: <strong>{accionLabel}</strong>.
          </ContextNote>
        ) : null}
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Resumen final de impacto (Plazos)</h3>
        <ul className="mt-2 space-y-1 text-sm text-emerald-900">
          <li>
            Documentación diferida: <strong>{docDiff ? "habilitada" : "deshabilitada"}</strong>.
          </li>
          <li>
            Momento de entrega: <strong>{momentoLabel || "sin definir"}</strong>.
          </li>
          <li>
            Cómputo del plazo: <strong>{tcpLabel || "sin definir"}</strong> · Días post-inicio:{" "}
            <strong>{diasStr || "sin definir"}</strong>.
          </li>
          <li>
            Acción al vencer: <strong>{accionLabel || "sin definir"}</strong>.
          </li>
        </ul>
      </section>
    </div>
  );
}
