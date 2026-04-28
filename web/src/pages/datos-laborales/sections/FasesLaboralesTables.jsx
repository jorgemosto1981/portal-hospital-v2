import Card from "../../../components/ui/Card.jsx";
import { formatCargaPorDia, formatValue } from "../utils.js";

export default function FasesLaboralesTables({
  loadingByCollection,
  errorByCollection,
  hlcRows,
  hldRows,
  hlgRows,
  idxGrupos,
  idxEfectores,
  idxHlc,
  idxHld,
  labelDesdeIndice,
}) {
  return (
    <>
      <Card className="px-4 py-4 md:px-5">
        <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 1 (HLc + FK resueltas)</p>
        <p className="mt-1 text-sm text-slate-600">
          Vista operativa inicial de cargos laborales con resolución de grupo y efectores.
        </p>
        {loadingByCollection.historial_laboral_cargos ? (
          <p className="mt-3 text-sm text-slate-500">Cargando cargos...</p>
        ) : errorByCollection.historial_laboral_cargos ? (
          <p className="mt-3 text-sm text-rose-700">
            Error en `historial_laboral_cargos`: {errorByCollection.historial_laboral_cargos}
          </p>
        ) : hlcRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay cargos para mostrar.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Cargo ID</th>
                  <th className="px-3 py-2">Persona</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Efector designación</th>
                  <th className="px-3 py-2">Efector cumplimiento</th>
                  <th className="px-3 py-2">Estado asignación</th>
                  <th className="px-3 py-2">Carga total</th>
                  <th className="px-3 py-2">Desde</th>
                  <th className="px-3 py-2">Hasta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {hlcRows.slice(0, 30).map((row, idx) => (
                  <tr key={row.id || `hlc-row-${idx}`}>
                    <td className="px-3 py-2 font-mono">{row.id}</td>
                    <td className="px-3 py-2 font-mono">{formatValue(row.persona_id)}</td>
                    <td className="px-3 py-2">
                      {labelDesdeIndice(idxGrupos, row.grupo_de_trabajo_id)}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">
                        ({formatValue(row.grupo_de_trabajo_id)})
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {labelDesdeIndice(idxEfectores, row.efector_designacion_id)}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">
                        ({formatValue(row.efector_designacion_id)})
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {labelDesdeIndice(idxEfectores, row.efector_cumplimiento_id)}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">
                        ({formatValue(row.efector_cumplimiento_id)})
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">{formatValue(row.estado_asignacion_id)}</td>
                    <td className="px-3 py-2">{formatValue(row.carga_horaria_total)}</td>
                    <td className="px-3 py-2">{formatValue(row.fecha_desde)}</td>
                    <td className="px-3 py-2">{formatValue(row.fecha_hasta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="px-4 py-4 md:px-5">
        <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 2 (HLd + cruce con HLc)</p>
        <p className="mt-1 text-sm text-slate-600">
          Segundo nivel laboral (`historial_laboral_datos`) vinculado al cargo base por `cargo_id`.
        </p>
        {loadingByCollection.historial_laboral_datos ? (
          <p className="mt-3 text-sm text-slate-500">Cargando datos laborales...</p>
        ) : errorByCollection.historial_laboral_datos ? (
          <p className="mt-3 text-sm text-rose-700">
            Error en `historial_laboral_datos`: {errorByCollection.historial_laboral_datos}
          </p>
        ) : hldRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay datos laborales (hld_*) para mostrar.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Dato ID</th>
                  <th className="px-3 py-2">Cargo ID</th>
                  <th className="px-3 py-2">Persona</th>
                  <th className="px-3 py-2">Grupo (desde HLc)</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Escalafón</th>
                  <th className="px-3 py-2">Función real</th>
                  <th className="px-3 py-2">Nivel jerárquico</th>
                  <th className="px-3 py-2">Desde</th>
                  <th className="px-3 py-2">Hasta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {hldRows.slice(0, 40).map((row, idx) => {
                  const cargo = idxHlc.get(String(row.cargo_id || ""));
                  return (
                    <tr key={row.id || `hld-row-${idx}`}>
                      <td className="px-3 py-2 font-mono">{row.id}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.cargo_id)}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.persona_id)}</td>
                      <td className="px-3 py-2">
                        {cargo
                          ? labelDesdeIndice(idxGrupos, cargo.grupo_de_trabajo_id)
                          : "Cargo no encontrado"}
                        {cargo && (
                          <span className="ml-1 font-mono text-[10px] text-slate-400">
                            ({formatValue(cargo.grupo_de_trabajo_id)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.rol_id)}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.escalafon_id)}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.funcion_real_id)}</td>
                      <td className="px-3 py-2">{formatValue(row.nivel_jerarquico)}</td>
                      <td className="px-3 py-2">{formatValue(row.fecha_inicio)}</td>
                      <td className="px-3 py-2">{formatValue(row.fecha_fin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="px-4 py-4 md:px-5">
        <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 3 (HLg + cruce con HLd/Grupo)</p>
        <p className="mt-1 text-sm text-slate-600">
          Tercer nivel laboral (`historial_laboral_grupos`) vinculado al dato laboral (`dato_laboral_id`) y
          resolución de grupo operativo.
        </p>
        {loadingByCollection.historial_laboral_grupos ? (
          <p className="mt-3 text-sm text-slate-500">Cargando grupos laborales...</p>
        ) : errorByCollection.historial_laboral_grupos ? (
          <p className="mt-3 text-sm text-rose-700">
            Error en `historial_laboral_grupos`: {errorByCollection.historial_laboral_grupos}
          </p>
        ) : hlgRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay datos de grupos laborales (hlg_*) para mostrar.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Grupo laboral ID</th>
                  <th className="px-3 py-2">Dato laboral ID</th>
                  <th className="px-3 py-2">Cargo ID (desde HLd)</th>
                  <th className="px-3 py-2">Persona</th>
                  <th className="px-3 py-2">Grupo (HLg)</th>
                  <th className="px-3 py-2">Grupo (desde HLc)</th>
                  <th className="px-3 py-2">Nivel jerárquico</th>
                  <th className="px-3 py-2">Carga por día</th>
                  <th className="px-3 py-2">Desde</th>
                  <th className="px-3 py-2">Hasta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {hlgRows.slice(0, 40).map((row, idx) => {
                  const datoLaboral = idxHld.get(String(row.dato_laboral_id || ""));
                  const cargo = datoLaboral ? idxHlc.get(String(datoLaboral.cargo_id || "")) : null;
                  return (
                    <tr key={row.id || `hlg-row-${idx}`}>
                      <td className="px-3 py-2 font-mono">{row.id}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.dato_laboral_id)}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(datoLaboral && datoLaboral.cargo_id)}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.persona_id)}</td>
                      <td className="px-3 py-2">
                        {labelDesdeIndice(idxGrupos, row.grupo_de_trabajo_id)}
                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                          ({formatValue(row.grupo_de_trabajo_id)})
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {cargo ? labelDesdeIndice(idxGrupos, cargo.grupo_de_trabajo_id) : "Sin cruce HLc"}
                        {cargo && (
                          <span className="ml-1 font-mono text-[10px] text-slate-400">
                            ({formatValue(cargo.grupo_de_trabajo_id)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatValue(row.nivel_jerarquico)}</td>
                      <td className="px-3 py-2 font-mono">{formatCargaPorDia(row.carga_por_dia_semana)}</td>
                      <td className="px-3 py-2">{formatValue(row.fecha_inicio)}</td>
                      <td className="px-3 py-2">{formatValue(row.fecha_fin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
