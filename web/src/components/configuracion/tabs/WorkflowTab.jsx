/**
 * Workflow y políticas de solicitud (`cfg_articulos`).
 */
function WorkflowSelect({
  id,
  label,
  hint,
  catalogo,
  value,
  onChange,
  emptyLabel,
  fieldError,
  inactive = false,
}) {
  const disabled = catalogo.status === "loading" || inactive;

  return (
    <div className={`space-y-1 ${inactive ? "opacity-60" : ""}`}>
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
      {inactive ? (
        <p className="text-xs text-slate-500">
          Campo persistido pero ignorado mientras la opción habilitante esté desactivada.
        </p>
      ) : null}
      {fieldError ? (
        <span className="block text-sm text-red-600" role="alert">
          {fieldError}
        </span>
      ) : null}
    </div>
  );
}

function ToggleField({ checked, onChange, title, description }) {
  return (
    <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
      <input
        type="checkbox"
        className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        checked={checked === true}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">{title}</span>
        {description ? <span className="mt-0.5 block text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

function ContextNote({ children }) {
  return (
    <p className="mt-1 rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1 text-xs text-blue-900">
      <strong>Efecto:</strong> {children}
    </p>
  );
}

function ToggleFieldWithState({ checked, onChange, title, description, inactive = false }) {
  return (
    <div className={`${inactive ? "opacity-60" : ""}`}>
      <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          checked={checked === true}
          disabled={inactive}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="font-medium">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
          ) : null}
        </span>
      </label>
      {inactive ? (
        <p className="mt-1 text-xs text-slate-500">
          Campo persistido pero ignorado mientras la opción habilitante esté desactivada.
        </p>
      ) : null}
    </div>
  );
}

export default function WorkflowTab({
  data,
  update,
  errors,
  catalogosWorkflow,
  onRecargarCatalogos,
}) {
  const fe = errors?.fieldErrors || {};
  const permiteParcial = data.permite_aprobacion_parcial === true;
  const requiereDecisionRrhh = data.requiere_decision_rrhh_para_remanente === true;

  const origenAlta =
    typeof data.origen_alta_id_default === "string" ? data.origen_alta_id_default : "";
  const reglaSplit =
    typeof data.regla_split_remanente_id === "string" ? data.regla_split_remanente_id : "";
  const prioridadNormativa =
    typeof data.prioridad_normativa_id === "string" ? data.prioridad_normativa_id : "";
  const politicaSuperposicion =
    typeof data.politica_superposicion_id === "string" ? data.politica_superposicion_id : "";
  const usaPrioridadNormativa = politicaSuperposicion === "CFG_PS_PRIORIDAD_NORMATIVA";
  const origenAltaContext = {
    CFG_OAS_AGENTE: "La solicitud nace por autogestión del agente.",
    CFG_OAS_JEFE_GRUPO: "La solicitud nace por delegación de jefatura.",
    CFG_OAS_RRHH: "La solicitud nace por carga directa de RRHH.",
  }[origenAlta];
  const reglaSplitContext = {
    CFG_RSR_RECHAZAR_REMANENTE: "Lo no aprobado se descarta; no continúa como trámite nuevo.",
    CFG_RSR_NUEVA_SOLICITUD: "Lo no aprobado se deriva a una solicitud independiente.",
    CFG_RSR_DERIVAR_RRHH: "Lo no aprobado requiere intervención explícita de RRHH.",
  }[reglaSplit];
  const politicaSuperposicionContext = {
    CFG_PS_BLOQUEO_TOTAL:
      "Bloquea el trámite ante choque de rangos hasta que se ajuste manualmente (criterio plan).",
    CFG_PS_PRIORIDAD_NORMATIVA: "Resuelve conflictos por prioridad normativa configurada.",
    CFG_PS_DERIVAR_RRHH: "Escala el conflicto a resolución manual de RRHH.",
    CFG_PS_PERMITIR_CONVIVENCIA: "Permite convivir con trazabilidad y registro de excepción.",
  }[politicaSuperposicion];
  const prioridadNormativaContext = {
    CFG_PN_DECRETO_PREVALECE: "Ante conflicto, prevalece el marco normativo principal.",
    CFG_PN_POLITICA_INSTITUCIONAL: "Ante conflicto, prevalece política institucional vigente.",
    CFG_PN_DECISION_RRHH: "Ante conflicto, RRHH toma la decisión final.",
  }[prioridadNormativa];
  const origenAltaLabel = catalogosWorkflow.origenAlta?.options?.find((o) => o.value === origenAlta)?.label;
  const reglaSplitLabel = catalogosWorkflow.reglaSplit?.options?.find((o) => o.value === reglaSplit)?.label;
  const politicaSuperposicionLabel = catalogosWorkflow.politicaSuperposicion?.options?.find(
    (o) => o.value === politicaSuperposicion,
  )?.label;
  const prioridadNormativaLabel = catalogosWorkflow.prioridadNormativa?.options?.find(
    (o) => o.value === prioridadNormativa,
  )?.label;

  const setOptionalId = (key, raw) => {
    const v = String(raw || "").trim();
    update.field(key, v.length ? v : undefined);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <p>
          Define origen de alta, split/remanente y políticas de conflicto para solicitudes nuevas de este
          artículo.
        </p>
        <p className="mt-2">
          <strong>Guía:</strong> las <strong>tildes</strong> habilitan capacidades (sí/no); los{" "}
          <strong>selects</strong> definen la política específica. Si algo queda sombreado, se conserva en
          el documento pero se ignora en operación.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRecargarCatalogos?.()}
        className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50"
      >
        Recargar catálogos
      </button>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Origen y autorización</h3>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-3 text-xs text-slate-500">
            Paso 1: definí quién puede iniciar. Paso 2: elegí el origen por defecto.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField
              checked={data.permite_alta_iniciada_por_jefe_grupo}
              onChange={(v) => update.field("permite_alta_iniciada_por_jefe_grupo", v)}
              title="Permite alta iniciada por jefe de grupo"
            />
            <ToggleField
              checked={data.requiere_autorizacion_jefe}
              onChange={(v) => update.field("requiere_autorizacion_jefe", v)}
              title="Requiere autorización de jefe"
            />
          </div>
          <div className="mt-3">
            <WorkflowSelect
              id="origen_alta_id_default"
              label="Origen de alta por defecto"
              hint="Catálogo cfg_origen_alta_solicitud. Define quién inicia por defecto la solicitud."
              catalogo={catalogosWorkflow.origenAlta}
              value={origenAlta}
              onChange={(v) => setOptionalId("origen_alta_id_default", v)}
              emptyLabel="Sin selección"
              fieldError={fe.origen_alta_id_default?.[0]}
            />
            {origenAltaContext ? <ContextNote>{origenAltaContext}</ContextNote> : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Aprobación parcial y remanente</h3>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-3 text-xs text-slate-500">
            Paso 1: activá aprobación parcial. Paso 2: configurá la regla de remanente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField
              checked={permiteParcial}
              onChange={(v) => {
                update.field("permite_aprobacion_parcial", v);
                if (v && !reglaSplit) {
                  update.field("regla_split_remanente_id", "CFG_RSR_DERIVAR_RRHH");
                }
              }}
              title="Permite aprobación parcial"
              description="Si está desactivado, todo el bloque de remanente queda persistido pero no operativo."
            />
            <ToggleFieldWithState
              checked={data.permite_remanente_sin_articulo}
              onChange={(v) => update.field("permite_remanente_sin_articulo", v)}
              title="Permite remanente sin artículo"
              description="Habilita dejar saldo pendiente sin vincularlo a otro artículo inmediatamente."
              inactive={!permiteParcial}
            />
            <ToggleFieldWithState
              checked={data.permite_nueva_solicitud_remanente}
              onChange={(v) => update.field("permite_nueva_solicitud_remanente", v)}
              title="Permite nueva solicitud para remanente"
              description="Cuando hay saldo no aprobado, permite abrir trámite separado para ese remanente."
              inactive={!permiteParcial}
            />
            <ToggleFieldWithState
              checked={requiereDecisionRrhh}
              onChange={(v) => {
                update.field("requiere_decision_rrhh_para_remanente", v);
                if (v && !reglaSplit) {
                  update.field("regla_split_remanente_id", "CFG_RSR_DERIVAR_RRHH");
                }
              }}
              title="Requiere decisión RRHH para remanente"
              description="Fuerza intervención manual de RRHH antes de cerrar destino del remanente."
              inactive={!permiteParcial}
            />
            <ToggleFieldWithState
              checked={data.requiere_auditoria_medica}
              onChange={(v) => update.field("requiere_auditoria_medica", v)}
              title="Requiere auditoría médica"
              description="Agrega control clínico cuando la política del artículo lo exige."
              inactive={!permiteParcial}
            />
          </div>
          <div className="mt-3">
            <WorkflowSelect
              id="regla_split_remanente_id"
              label="Regla de split remanente"
              hint="Catálogo cfg_regla_split_remanente. Define qué pasa con el saldo no aprobado."
              catalogo={catalogosWorkflow.reglaSplit}
              value={reglaSplit}
              onChange={(v) => setOptionalId("regla_split_remanente_id", v)}
              emptyLabel="Sin selección"
              fieldError={fe.regla_split_remanente_id?.[0]}
              inactive={!permiteParcial}
            />
            {permiteParcial && reglaSplitContext ? <ContextNote>{reglaSplitContext}</ContextNote> : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Conflictos e impacto</h3>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-3 text-xs text-slate-500">
            Paso 1: elegí política de superposición. Paso 2: si corresponde, definí prioridad normativa.
          </p>
          <ToggleField
            checked={data.admite_reemplazo}
            onChange={(v) => update.field("admite_reemplazo", v)}
            title="Admite reemplazo"
            description="Habilita acciones de cobertura/reemplazo en módulos paralelos cuando aplique."
          />
          <ToggleField
            checked={data.dispara_evento_contrataciones}
            onChange={(v) => update.field("dispara_evento_contrataciones", v)}
            title="Dispara evento a contrataciones"
            description="Emite señal para circuito de contrataciones según integración institucional."
          />
        </div>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <WorkflowSelect
            id="politica_superposicion_id"
            label="Política de superposición"
            hint="Catálogo cfg_politica_superposicion. Regla principal para conflictos de rangos."
            catalogo={catalogosWorkflow.politicaSuperposicion}
            value={politicaSuperposicion}
            onChange={(v) => setOptionalId("politica_superposicion_id", v)}
            emptyLabel="Sin selección"
            fieldError={fe.politica_superposicion_id?.[0]}
          />
          {!politicaSuperposicionContext ? (
            <ContextNote>
              Define cómo resolver choques de rango con otras licencias/solicitudes. Si no se define,
              la resolución queda ambigua y puede requerir intervención manual de RRHH.
            </ContextNote>
          ) : null}
          <WorkflowSelect
            id="prioridad_normativa_id"
            label="Prioridad normativa"
            hint="Catálogo cfg_prioridad_normativa. Solo aplica si la política de superposición usa prioridad."
            catalogo={catalogosWorkflow.prioridadNormativa}
            value={prioridadNormativa}
            onChange={(v) => setOptionalId("prioridad_normativa_id", v)}
            emptyLabel="Sin selección"
            fieldError={fe.prioridad_normativa_id?.[0]}
            inactive={!usaPrioridadNormativa}
          />
        </div>
        {politicaSuperposicionContext ? <ContextNote>{politicaSuperposicionContext}</ContextNote> : null}
        {usaPrioridadNormativa && prioridadNormativaContext ? (
          <ContextNote>{prioridadNormativaContext}</ContextNote>
        ) : null}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Resumen final de impacto (Workflow)</h3>
        <ul className="mt-2 space-y-1 text-sm text-emerald-900">
          <li>
            Origen por defecto: <strong>{origenAltaLabel || "sin definir"}</strong> · Alta por jefe:{" "}
            <strong>{data.permite_alta_iniciada_por_jefe_grupo ? "sí" : "no"}</strong> · Requiere
            autorización de jefe: <strong>{data.requiere_autorizacion_jefe ? "sí" : "no"}</strong>.
          </li>
          <li>
            Aprobación parcial: <strong>{permiteParcial ? "habilitada" : "deshabilitada"}</strong> · Regla
            remanente: <strong>{reglaSplitLabel || "sin definir"}</strong>.
          </li>
          <li>
            Remanente: sin artículo{" "}
            <strong>{data.permite_remanente_sin_articulo ? "sí" : "no"}</strong> · nueva solicitud{" "}
            <strong>{data.permite_nueva_solicitud_remanente ? "sí" : "no"}</strong> · decisión RRHH{" "}
            <strong>{requiereDecisionRrhh ? "sí" : "no"}</strong> · auditoría médica{" "}
            <strong>{data.requiere_auditoria_medica ? "sí" : "no"}</strong>.
          </li>
          <li>
            Superposición: <strong>{politicaSuperposicionLabel || "sin definir"}</strong> · Prioridad
            normativa:{" "}
            <strong>
              {usaPrioridadNormativa
                ? prioridadNormativaLabel || "sin definir"
                : "no aplica (según política de superposición)"}
            </strong>
            .
          </li>
          <li>
            Impacto operativo: reemplazo <strong>{data.admite_reemplazo ? "sí" : "no"}</strong> · evento a
            contrataciones <strong>{data.dispara_evento_contrataciones ? "sí" : "no"}</strong>.
          </li>
        </ul>
      </section>
    </div>
  );
}
