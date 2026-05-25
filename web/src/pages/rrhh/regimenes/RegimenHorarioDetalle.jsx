const DIAS_SEMANA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const TIPO_DIA_LABEL = {
  laborable: "Laborable",
  guardia: "Guardia",
  no_laborable: "No laborable",
  franco: "Franco",
};

const TIPO_DIA_COLOR = {
  laborable: "text-green-700 bg-green-50",
  guardia: "text-orange-700 bg-orange-50",
  no_laborable: "text-slate-500 bg-slate-50",
  franco: "text-blue-600 bg-blue-50",
};

function TurnoInfo({ turno }) {
  if (!turno) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-medium text-slate-700">
        {turno.ingreso} → {turno.egreso}
        <span className="ml-1 text-slate-400">({turno.horas_efectivas}hs)</span>
      </p>
      {turno.es_nocturno && (
        <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
          Nocturno
        </span>
      )}
      {turno.banda_ingreso && (
        <p className="text-slate-500">
          Banda ingreso: {turno.banda_ingreso.desde}–{turno.banda_ingreso.hasta}
        </p>
      )}
      {turno.banda_egreso && (
        <p className="text-slate-500">
          Banda egreso: {turno.banda_egreso.desde}–{turno.banda_egreso.hasta}
        </p>
      )}
      {(turno.tolerancia_ingreso_min > 0 || turno.tolerancia_egreso_min > 0) && (
        <p className="text-slate-400">
          Tolerancia: ±{turno.tolerancia_ingreso_min}min ingreso / ±{turno.tolerancia_egreso_min}min egreso
        </p>
      )}
      {turno.descanso && (
        <p className="text-slate-400">
          Descanso: {turno.descanso.duracion_min}min
          {turno.descanso.es_pago ? " (pago)" : " (no pago)"}
          {turno.descanso.despues_de_horas > 0 && ` después de ${turno.descanso.despues_de_horas}hs`}
        </p>
      )}
    </div>
  );
}

function SeccionFijo({ dias }) {
  if (!Array.isArray(dias)) return null;
  const sorted = [...dias].sort((a, b) => a.dia_semana - b.dia_semana);
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grilla semanal</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Día</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Tipo</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Turno</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((d) => (
              <tr key={d.dia_semana} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-700">
                  {DIAS_SEMANA[d.dia_semana]}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TIPO_DIA_COLOR[d.tipo_dia] || ""}`}>
                    {TIPO_DIA_LABEL[d.tipo_dia] || d.tipo_dia}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <TurnoInfo turno={d.turno} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeccionRotativo({ ciclo, ciclo_total }) {
  if (!Array.isArray(ciclo)) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Ciclo rotativo ({ciclo_total} posiciones)
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Pos.</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Tipo</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Turno</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ciclo.map((p) => (
              <tr key={p.posicion} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-center text-sm font-mono font-bold text-slate-600">
                  {p.posicion}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TIPO_DIA_COLOR[p.tipo_dia] || ""}`}>
                    {TIPO_DIA_LABEL[p.tipo_dia] || p.tipo_dia}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <TurnoInfo turno={p.turno} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeccionPlanificado({ turnos_disponibles, reglas_planificacion }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Paleta de turnos</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(turnos_disponibles || []).map((t) => (
            <div key={t.turno_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                  {t.turno_id}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.etiqueta}</p>
                  <p className="text-xs text-slate-500">
                    {t.ingreso} → {t.egreso} ({t.horas_efectivas}hs)
                  </p>
                </div>
              </div>
              {t.es_nocturno && (
                <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                  Nocturno
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {reglas_planificacion && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reglas de planificación</h4>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="grid grid-cols-2 gap-2">
              {reglas_planificacion.dias_trabajo_max_mes != null && (
                <p>Max. días trabajo/mes: <strong>{reglas_planificacion.dias_trabajo_max_mes}</strong></p>
              )}
              {reglas_planificacion.dias_franco_min_mes != null && (
                <p>Min. francos/mes: <strong>{reglas_planificacion.dias_franco_min_mes}</strong></p>
              )}
              {reglas_planificacion.max_consecutivos_trabajo != null && (
                <p>Max. consecutivos trabajo: <strong>{reglas_planificacion.max_consecutivos_trabajo}</strong></p>
              )}
              {reglas_planificacion.min_consecutivos_franco != null && (
                <p>Min. consecutivos franco: <strong>{reglas_planificacion.min_consecutivos_franco}</strong></p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegimenHorarioDetalle({ item, onCerrar, onEditar }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{item.nombre}</h3>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{item.codigo} · {item.id}</p>
          </div>
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

        {/* Metadata */}
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <span>Carga semanal: <strong>{item.carga_horaria_semanal_teorica ?? "—"}hs</strong></span>
            <span>Calendario inst.: <strong>{item.impacta_calendario_institucional !== false ? "Sí" : "No"}</strong></span>
            {item.notas_rrhh && <span className="italic text-slate-400">Nota: {item.notas_rrhh}</span>}
          </div>
        </div>

        {/* Cuerpo según tipo */}
        <div className="px-5 py-4">
          {item.tipo_patron === "fijo" && <SeccionFijo dias={item.dias} />}
          {item.tipo_patron === "rotativo" && <SeccionRotativo ciclo={item.ciclo} ciclo_total={item.ciclo_total} />}
          {item.tipo_patron === "planificado" && (
            <SeccionPlanificado
              turnos_disponibles={item.turnos_disponibles}
              reglas_planificacion={item.reglas_planificacion}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onEditar}
            className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
