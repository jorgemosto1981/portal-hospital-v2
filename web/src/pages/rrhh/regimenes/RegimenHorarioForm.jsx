import { useCallback, useState } from "react";

import { regimenHorarioSchema } from "../../../schemas/regimenHorario.schema.js";

const TIPOS_PATRON = [
  { key: "fijo", label: "Fijo / Semanal", desc: "Días fijos de la semana (admin, guardia, consultorio)" },
  { key: "rotativo", label: "Rotativo / Cíclico", desc: "Ciclo de N días que se repite (enfermería 2x2, 6x2)" },
  { key: "planificado", label: "Planificado / Jefe", desc: "El jefe arma la grilla mensual con turnos disponibles" },
];

const DIAS_SEMANA = [
  { num: 1, label: "Lunes", short: "Lun" },
  { num: 2, label: "Martes", short: "Mar" },
  { num: 3, label: "Miércoles", short: "Mié" },
  { num: 4, label: "Jueves", short: "Jue" },
  { num: 5, label: "Viernes", short: "Vie" },
  { num: 6, label: "Sábado", short: "Sáb" },
  { num: 7, label: "Domingo", short: "Dom" },
];

const TIPOS_DIA = [
  { key: "laborable", label: "Laborable" },
  { key: "guardia", label: "Guardia" },
  { key: "no_laborable", label: "No laborable" },
  { key: "franco", label: "Franco" },
];

function turnoVacio() {
  return {
    ingreso: "08:00",
    egreso: "14:00",
    horas_efectivas: 6,
    es_nocturno: false,
    tolerancia_ingreso_min: 15,
    tolerancia_egreso_min: 10,
    banda_ingreso: null,
    banda_egreso: null,
    descanso: null,
  };
}

function diasFijosDefault() {
  return DIAS_SEMANA.map((d) => ({
    dia_semana: d.num,
    tipo_dia: d.num <= 5 ? "laborable" : "franco",
    turno: d.num <= 5 ? turnoVacio() : null,
  }));
}

function cicloRotativoDefault() {
  return [
    { posicion: 1, tipo_dia: "laborable", turno: turnoVacio() },
    { posicion: 2, tipo_dia: "laborable", turno: turnoVacio() },
    { posicion: 3, tipo_dia: "franco", turno: null },
    { posicion: 4, tipo_dia: "franco", turno: null },
  ];
}

function turnoDisponibleDefault(idx) {
  const id = idx === 0 ? "M" : idx === 1 ? "T" : idx === 2 ? "N" : `T${idx + 1}`;
  const etiqueta = idx === 0 ? "Mañana" : idx === 1 ? "Tarde" : idx === 2 ? "Noche" : `Turno ${idx + 1}`;
  const ingreso = idx === 0 ? "06:00" : idx === 1 ? "14:00" : "22:00";
  const egreso = idx === 0 ? "14:00" : idx === 1 ? "22:00" : "06:00";
  return {
    turno_id: id, etiqueta, ingreso, egreso,
    horas_efectivas: 8, es_nocturno: idx === 2,
    tolerancia_ingreso_min: 15, tolerancia_egreso_min: 15,
    banda_ingreso: null, banda_egreso: null, descanso: null,
  };
}

function initFromItem(item) {
  if (!item) return null;
  return {
    nombre: item.nombre || "",
    codigo: item.codigo || "",
    activo: item.activo !== false,
    tipo_patron: item.tipo_patron || "fijo",
    carga_horaria_semanal_teorica: item.carga_horaria_semanal_teorica ?? "",
    impacta_calendario_institucional: item.impacta_calendario_institucional !== false,
    notas_rrhh: item.notas_rrhh || "",
    horas_extra_max_semanal: item.horas_extra_max_semanal ?? "",
    horas_extra_max_mensual: item.horas_extra_max_mensual ?? "",
    tipo_contrato_ids: item.tipo_contrato_ids || null,
    dias: item.dias || diasFijosDefault(),
    ciclo: item.ciclo || cicloRotativoDefault(),
    ciclo_total: item.ciclo_total ?? 4,
    turnos_disponibles: item.turnos_disponibles || [turnoDisponibleDefault(0), turnoDisponibleDefault(1), turnoDisponibleDefault(2)],
    reglas_planificacion: item.reglas_planificacion || null,
  };
}

function blankState() {
  return {
    nombre: "", codigo: "", activo: true,
    tipo_patron: "fijo",
    carga_horaria_semanal_teorica: "",
    impacta_calendario_institucional: true,
    notas_rrhh: "", horas_extra_max_semanal: "", horas_extra_max_mensual: "",
    tipo_contrato_ids: null,
    dias: diasFijosDefault(),
    ciclo: cicloRotativoDefault(),
    ciclo_total: 4,
    turnos_disponibles: [turnoDisponibleDefault(0), turnoDisponibleDefault(1), turnoDisponibleDefault(2)],
    reglas_planificacion: { dias_trabajo_max_mes: null, dias_franco_min_mes: null, max_consecutivos_trabajo: null, min_consecutivos_franco: null },
  };
}

function InputField({ label, value, onChange, type = "text", placeholder, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        {...props}
      />
    </label>
  );
}

function TurnoEditor({ turno, onChange, path }) {
  if (!turno) return null;
  const set = (k, v) => onChange({ ...turno, [k]: v });
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <InputField label="Ingreso" value={turno.ingreso} onChange={(v) => set("ingreso", v)} placeholder="HH:MM" />
        <InputField label="Egreso" value={turno.egreso} onChange={(v) => set("egreso", v)} placeholder="HH:MM" />
        <InputField
          label="Hs efectivas"
          value={turno.horas_efectivas}
          onChange={(v) => set("horas_efectivas", v === "" ? "" : Number(v))}
          type="number"
          min="0"
          max="24"
          step="0.5"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={turno.es_nocturno}
            onChange={(e) => set("es_nocturno", e.target.checked)}
            className="rounded border-slate-300"
          />
          Nocturno
        </label>
        <InputField
          label="Toler. ingreso (min)"
          value={turno.tolerancia_ingreso_min}
          onChange={(v) => set("tolerancia_ingreso_min", v === "" ? 0 : Number(v))}
          type="number" min="0" max="60"
          className="w-28"
        />
        <InputField
          label="Toler. egreso (min)"
          value={turno.tolerancia_egreso_min}
          onChange={(v) => set("tolerancia_egreso_min", v === "" ? 0 : Number(v))}
          type="number" min="0" max="60"
          className="w-28"
        />
      </div>
    </div>
  );
}

function EditorFijo({ dias, onChange }) {
  const updateDia = (idx, patch) => {
    const next = [...dias];
    next[idx] = { ...next[idx], ...patch };
    if (patch.tipo_dia && (patch.tipo_dia === "no_laborable" || patch.tipo_dia === "franco")) {
      next[idx].turno = null;
    }
    if (patch.tipo_dia && (patch.tipo_dia === "laborable" || patch.tipo_dia === "guardia") && !next[idx].turno) {
      next[idx].turno = turnoVacio();
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grilla semanal</h4>
      {dias.map((d, i) => (
        <div key={d.dia_semana} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <span className="w-20 text-sm font-medium text-slate-700">{DIAS_SEMANA[i]?.label}</span>
            <select
              value={d.tipo_dia}
              onChange={(e) => updateDia(i, { tipo_dia: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              {TIPOS_DIA.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          {d.turno && (
            <div className="mt-2">
              <TurnoEditor turno={d.turno} onChange={(t) => updateDia(i, { turno: t })} path={`dias[${i}].turno`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditorRotativo({ ciclo, onChange }) {
  const updatePos = (idx, patch) => {
    const next = [...ciclo];
    next[idx] = { ...next[idx], ...patch };
    if (patch.tipo_dia && (patch.tipo_dia === "no_laborable" || patch.tipo_dia === "franco")) {
      next[idx].turno = null;
    }
    if (patch.tipo_dia && (patch.tipo_dia === "laborable" || patch.tipo_dia === "guardia") && !next[idx].turno) {
      next[idx].turno = turnoVacio();
    }
    onChange(next);
  };

  const agregarPosicion = () => {
    const next = [...ciclo, { posicion: ciclo.length + 1, tipo_dia: "franco", turno: null }];
    onChange(next);
  };

  const quitarUltima = () => {
    if (ciclo.length <= 2) return;
    onChange(ciclo.slice(0, -1));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Ciclo ({ciclo.length} posiciones)
        </h4>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={quitarUltima}
            disabled={ciclo.length <= 2}
            className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-40"
          >
            − Quitar
          </button>
          <button
            type="button"
            onClick={agregarPosicion}
            disabled={ciclo.length >= 60}
            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-40"
          >
            + Agregar
          </button>
        </div>
      </div>
      {ciclo.map((p, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
              {p.posicion}
            </span>
            <select
              value={p.tipo_dia}
              onChange={(e) => updatePos(i, { tipo_dia: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              {TIPOS_DIA.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          {p.turno && (
            <div className="mt-2">
              <TurnoEditor turno={p.turno} onChange={(t) => updatePos(i, { turno: t })} path={`ciclo[${i}].turno`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditorPlanificado({ turnos, reglas, onChangeTurnos, onChangeReglas }) {
  const updateTurno = (idx, patch) => {
    const next = [...turnos];
    next[idx] = { ...next[idx], ...patch };
    onChangeTurnos(next);
  };

  const agregarTurno = () => {
    onChangeTurnos([...turnos, turnoDisponibleDefault(turnos.length)]);
  };

  const quitarTurno = (idx) => {
    if (turnos.length <= 1) return;
    onChangeTurnos(turnos.filter((_, i) => i !== idx));
  };

  const setRegla = (k, v) => {
    const next = { ...(reglas || {}), [k]: v === "" ? null : Number(v) };
    onChangeReglas(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Turnos disponibles</h4>
          <button
            type="button"
            onClick={agregarTurno}
            disabled={turnos.length >= 20}
            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-40"
          >
            + Agregar turno
          </button>
        </div>
        {turnos.map((t, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <InputField
                label="ID"
                value={t.turno_id}
                onChange={(v) => updateTurno(i, { turno_id: v })}
                className="w-16"
                maxLength={10}
              />
              <InputField
                label="Etiqueta"
                value={t.etiqueta}
                onChange={(v) => updateTurno(i, { etiqueta: v })}
                className="flex-1"
                maxLength={50}
              />
              {turnos.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarTurno(i)}
                  className="mt-4 rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <InputField label="Ingreso" value={t.ingreso} onChange={(v) => updateTurno(i, { ingreso: v })} placeholder="HH:MM" />
              <InputField label="Egreso" value={t.egreso} onChange={(v) => updateTurno(i, { egreso: v })} placeholder="HH:MM" />
              <InputField
                label="Hs efectivas"
                value={t.horas_efectivas}
                onChange={(v) => updateTurno(i, { horas_efectivas: v === "" ? "" : Number(v) })}
                type="number" min="0" max="24" step="0.5"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={t.es_nocturno}
                  onChange={(e) => updateTurno(i, { es_nocturno: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Nocturno
              </label>
              <InputField
                label="Toler. ingreso (min)"
                value={t.tolerancia_ingreso_min ?? 15}
                onChange={(v) => updateTurno(i, { tolerancia_ingreso_min: v === "" ? 0 : Number(v) })}
                type="number" min="0" max="120"
                className="w-32"
              />
              <InputField
                label="Toler. egreso (min)"
                value={t.tolerancia_egreso_min ?? 10}
                onChange={(v) => updateTurno(i, { tolerancia_egreso_min: v === "" ? 0 : Number(v) })}
                type="number" min="0" max="120"
                className="w-32"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reglas de planificación (opcionales, solo advertencias)</h4>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <InputField
            label="Max. días trabajo/mes"
            value={reglas?.dias_trabajo_max_mes ?? ""}
            onChange={(v) => setRegla("dias_trabajo_max_mes", v)}
            type="number" min="1" max="31"
          />
          <InputField
            label="Min. francos/mes"
            value={reglas?.dias_franco_min_mes ?? ""}
            onChange={(v) => setRegla("dias_franco_min_mes", v)}
            type="number" min="0" max="31"
          />
          <InputField
            label="Max. consecutivos trabajo"
            value={reglas?.max_consecutivos_trabajo ?? ""}
            onChange={(v) => setRegla("max_consecutivos_trabajo", v)}
            type="number" min="1" max="31"
          />
          <InputField
            label="Min. consecutivos franco"
            value={reglas?.min_consecutivos_franco ?? ""}
            onChange={(v) => setRegla("min_consecutivos_franco", v)}
            type="number" min="1" max="31"
          />
        </div>
      </div>
    </div>
  );
}

export default function RegimenHorarioForm({ modo, item, guardando, onGuardar, onCerrar }) {
  const [form, setForm] = useState(() => (modo === "editar" && item ? initFromItem(item) : blankState()));
  const [errores, setErrores] = useState([]);
  const [errorApi, setErrorApi] = useState("");

  const set = useCallback((k, v) => setForm((prev) => ({ ...prev, [k]: v })), []);

  const buildPayload = useCallback(() => {
    const base = {
      nombre: form.nombre,
      codigo: form.codigo,
      activo: form.activo,
      tipo_patron: form.tipo_patron,
      carga_horaria_semanal_teorica: form.carga_horaria_semanal_teorica === "" ? null : Number(form.carga_horaria_semanal_teorica),
      impacta_calendario_institucional: form.impacta_calendario_institucional,
      notas_rrhh: form.notas_rrhh.trim() || null,
      horas_extra_max_semanal: form.horas_extra_max_semanal === "" ? null : Number(form.horas_extra_max_semanal),
      horas_extra_max_mensual: form.horas_extra_max_mensual === "" ? null : Number(form.horas_extra_max_mensual),
      tipo_contrato_ids: form.tipo_contrato_ids,
    };

    if (form.tipo_patron === "fijo") {
      base.dias = form.dias;
    } else if (form.tipo_patron === "rotativo") {
      base.ciclo = form.ciclo;
      base.ciclo_total = form.ciclo.length;
    } else if (form.tipo_patron === "planificado") {
      base.turnos_disponibles = form.turnos_disponibles;
      base.reglas_planificacion = form.reglas_planificacion;
    }
    return base;
  }, [form]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setErrores([]);
      setErrorApi("");
      const payload = buildPayload();
      const result = regimenHorarioSchema.safeParse(payload);
      if (!result.success) {
        setErrores(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
        return;
      }
      try {
        await onGuardar(result.data, modo === "editar" && item ? item.id : undefined);
      } catch (e) {
        setErrorApi(e?.message || "Error al guardar.");
      }
    },
    [buildPayload, onGuardar, modo, item],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {modo === "editar" ? "Editar régimen" : "Nuevo régimen horario"}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(100dvh-12rem)] space-y-5 overflow-y-auto px-5 py-4">
          {/* Campos comunes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Nombre" value={form.nombre} onChange={(v) => set("nombre", v)} placeholder="Ej: Administrativo 7hs L-V" required />
            <InputField label="Código" value={form.codigo} onChange={(v) => set("codigo", v)} placeholder="Ej: ADM-7H-LV" required />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InputField
              label="Hs semanales teóricas"
              value={form.carga_horaria_semanal_teorica}
              onChange={(v) => set("carga_horaria_semanal_teorica", v)}
              type="number" min="0" max="168" step="0.5"
              placeholder="Ej: 35"
            />
            <InputField
              label="Extra max/sem"
              value={form.horas_extra_max_semanal}
              onChange={(v) => set("horas_extra_max_semanal", v)}
              type="number" min="0" step="0.5"
              placeholder="—"
            />
            <InputField
              label="Extra max/mes"
              value={form.horas_extra_max_mensual}
              onChange={(v) => set("horas_extra_max_mensual", v)}
              type="number" min="0" step="0.5"
              placeholder="—"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
                className="rounded border-slate-300"
              />
              Activo
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.impacta_calendario_institucional}
                onChange={(e) => set("impacta_calendario_institucional", e.target.checked)}
                className="rounded border-slate-300"
              />
              Impacta calendario institucional
            </label>
          </div>

          <InputField
            label="Notas RRHH"
            value={form.notas_rrhh}
            onChange={(v) => set("notas_rrhh", v)}
            placeholder="Notas internas opcionales…"
          />

          {/* Selector tipo_patron */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo de patrón</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {TIPOS_PATRON.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set("tipo_patron", key)}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    form.tipo_patron === key
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className={`text-sm font-semibold ${form.tipo_patron === key ? "text-indigo-700" : "text-slate-700"}`}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Editor condicional */}
          {form.tipo_patron === "fijo" && (
            <EditorFijo dias={form.dias} onChange={(d) => set("dias", d)} />
          )}
          {form.tipo_patron === "rotativo" && (
            <EditorRotativo ciclo={form.ciclo} onChange={(c) => { set("ciclo", c); set("ciclo_total", c.length); }} />
          )}
          {form.tipo_patron === "planificado" && (
            <EditorPlanificado
              turnos={form.turnos_disponibles}
              reglas={form.reglas_planificacion}
              onChangeTurnos={(t) => set("turnos_disponibles", t)}
              onChangeReglas={(r) => set("reglas_planificacion", r)}
            />
          )}

          {/* Errores Zod */}
          {errores.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-1 text-xs font-semibold text-red-700">Errores de validación:</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-red-600">
                {errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {errorApi && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorApi}</div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium">Nota sobre horarios</p>
            <p className="mt-1">
              Para evitar inconsistencias de cruce de día, no se permite usar <span className="font-mono">00:00</span> en ingreso o egreso.
              Si un turno finaliza en medianoche, cargalo como <span className="font-mono">23:59</span> o redefiní el tramo según la regla operativa.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear régimen"}
          </button>
        </div>
      </form>
    </div>
  );
}
