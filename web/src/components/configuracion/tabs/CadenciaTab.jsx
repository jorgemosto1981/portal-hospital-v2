import ContextNote from "../ContextNote.jsx";

function NumField({ id, label, hint, value, onChange, fieldError }) {
  const str =
    typeof value === "number" && Number.isFinite(value) ? String(value) : "";

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
        placeholder="Vacío = sin regla"
        value={str}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === "") {
            onChange(undefined);
            return;
          }
          const n = parseInt(t, 10);
          if (!Number.isFinite(n) || n < 0) return;
          onChange(n);
        }}
      />
      {fieldError ? (
        <span className="block text-sm text-red-600" role="alert">
          {fieldError}
        </span>
      ) : null}
    </div>
  );
}

function UnitSelect({ id, label, catalogo, value, onChange, fieldError }) {
  const disabled = catalogo.status === "loading";
  const sel = typeof value === "string" ? value : "";

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {catalogo.status === "loading" ? (
        <p className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Cargando…
        </p>
      ) : catalogo.status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {catalogo.error || "Error"}
        </div>
      ) : (
        <select
          id={id}
          value={sel}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v.length ? v : undefined);
          }}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation disabled:opacity-60"
        >
          <option value="">Sin unidad</option>
          {catalogo.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {fieldError ? (
        <span className="block text-sm text-red-600" role="alert">
          {fieldError}
        </span>
      ) : null}
    </div>
  );
}

/**
 * RFC 1919 — `reglas_cadencia` en cfg_articulos.
 */
export default function CadenciaTab({ data, update, errors, catalogosCadencia, onRecargarCatalogos }) {
  const feRoot = errors?.fieldErrors?.reglas_cadencia || {};
  const rc =
    data?.reglas_cadencia != null && typeof data.reglas_cadencia === "object"
      ? data.reglas_cadencia
      : {};

  const patch = (p) => update.section("reglas_cadencia", p);

  const cat = catalogosCadencia?.unidadIntervalo || {
    status: "loading",
    options: [],
    error: null,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <p>
          Define ritmo de uso, preavisos y límites por ventana. Las unidades salen de{" "}
          <span className="font-semibold text-slate-800">cfg_unidad_intervalo_tiempo</span>. La duración
          mínima usa la misma magnitud que la unidad de medida del artículo (pestaña General).
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRecargarCatalogos?.()}
        className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50"
      >
        Recargar catálogos
      </button>

      <div className="grid gap-5 sm:grid-cols-2">
        <NumField
          id="intervalo_minimo_entre_usos_cantidad"
          label="Intervalo mínimo entre usos (cantidad)"
          hint="Mayor a 0 exige elegir unidad."
          value={rc.intervalo_minimo_entre_usos_cantidad}
          onChange={(v) => patch({ intervalo_minimo_entre_usos_cantidad: v })}
          fieldError={feRoot.intervalo_minimo_entre_usos_cantidad?.[0]}
        />
        <UnitSelect
          id="intervalo_minimo_entre_usos_unidad_id"
          label="Unidad (intervalo entre usos)"
          catalogo={cat}
          value={rc.intervalo_minimo_entre_usos_unidad_id}
          onChange={(v) => patch({ intervalo_minimo_entre_usos_unidad_id: v })}
          fieldError={feRoot.intervalo_minimo_entre_usos_unidad_id?.[0]}
        />
        <NumField
          id="preaviso_cantidad"
          label="Preaviso (cantidad)"
          hint="Tiempo mínimo antes del inicio solicitado."
          value={rc.preaviso_cantidad}
          onChange={(v) => patch({ preaviso_cantidad: v })}
          fieldError={feRoot.preaviso_cantidad?.[0]}
        />
        <UnitSelect
          id="preaviso_unidad_id"
          label="Unidad (preaviso)"
          catalogo={cat}
          value={rc.preaviso_unidad_id}
          onChange={(v) => patch({ preaviso_unidad_id: v })}
          fieldError={feRoot.preaviso_unidad_id?.[0]}
        />
        <NumField
          id="duracion_minima_solicitud_cantidad"
          label="Duración mínima de solicitud"
          hint="En la unidad del artículo (días, horas, etc.)."
          value={rc.duracion_minima_solicitud_cantidad}
          onChange={(v) => patch({ duracion_minima_solicitud_cantidad: v })}
          fieldError={feRoot.duracion_minima_solicitud_cantidad?.[0]}
        />
        <NumField
          id="limite_maximo_periodo_cantidad"
          label="Límite máximo por periodo (cantidad)"
          hint="Ej. tope anual; combinar con unidad de periodo."
          value={rc.limite_maximo_periodo_cantidad}
          onChange={(v) => patch({ limite_maximo_periodo_cantidad: v })}
          fieldError={feRoot.limite_maximo_periodo_cantidad?.[0]}
        />
        <UnitSelect
          id="limite_maximo_periodo_unidad_id"
          label="Unidad (periodo del límite)"
          catalogo={cat}
          value={rc.limite_maximo_periodo_unidad_id}
          onChange={(v) => patch({ limite_maximo_periodo_unidad_id: v })}
          fieldError={feRoot.limite_maximo_periodo_unidad_id?.[0]}
        />
      </div>

      <ContextNote>
        El motor aplicará cadencia cuando existan solicitudes previas del mismo artículo o rangos
        solapados; esta pantalla solo persiste reglas en{" "}
        <span className="font-mono text-slate-600">cfg_articulos</span>.
      </ContextNote>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Resumen (Cadencia)</h3>
        <ul className="mt-2 space-y-1 text-sm text-emerald-900">
          <li>
            Intervalo entre usos:{" "}
            <strong>
              {rc.intervalo_minimo_entre_usos_cantidad != null
                ? `${rc.intervalo_minimo_entre_usos_cantidad} (con unidad si aplica)`
                : "sin definir"}
            </strong>
            .
          </li>
          <li>
            Preaviso:{" "}
            <strong>
              {rc.preaviso_cantidad != null ? `${rc.preaviso_cantidad} + unidad` : "sin definir"}
            </strong>
            .
          </li>
          <li>
            Duración mínima:{" "}
            <strong>{rc.duracion_minima_solicitud_cantidad ?? "sin definir"}</strong> (UM del artículo).
          </li>
          <li>
            Límite por periodo:{" "}
            <strong>
              {rc.limite_maximo_periodo_cantidad != null
                ? `${rc.limite_maximo_periodo_cantidad} + unidad`
                : "sin definir"}
            </strong>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
