import Card from "../../../components/ui/Card.jsx";
import LaboralHldVigenciaPanel from "../components/LaboralHldVigenciaPanel.jsx";

export default function LaboralCargosActivosCard({
  snapshotActual,
  modoAvanzado,
  ultimaActualizacionTexto,
  onEditarHlg,
  onDeshabilitarHlg,
  onNuevoHlgEnHlc,
  onEditarHlc,
  onDeshabilitarHlc,
}) {
  const bloques = snapshotActual?.bloquesVigentes ?? [];
  const totalHlcPersona = snapshotActual?.totalHlcPersona ?? 0;
  const alertas = snapshotActual?.alertas ?? [];

  return (
    <Card className="px-4 py-4 md:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-slate-900">CARGOS ACTIVOS</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {bloques.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            {totalHlcPersona === 0 ? (
              <>
                <p className="text-sm font-semibold text-slate-900">Esta persona no tiene cargos registrados</p>
                <p className="mt-1 text-sm text-slate-600">
                  No existen períodos de cargo vigentes ni históricos para la persona seleccionada.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">No hay período de cargo vigente</p>
                <p className="mt-1 text-sm text-slate-600">
                  La persona tiene cargos registrados, pero ninguno vigente en este momento.
                </p>
              </>
            )}
          </div>
        ) : (
          bloques.map((bloque, idx) => (
            <div key={bloque.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                Ciclo {idx + 1}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Período de cargo vigente</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{bloque.tituloHlc}</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-700">
                <li>- Tipo de vínculo: {bloque.tipoVinculo || "—"}</li>
                <li>- Rol asignado: {bloque.rolHlc || "—"}</li>
                <li>- Escalafón: {bloque.escalafon || "—"}</li>
                <li>- Agrupamiento: {bloque.agrupamiento || "—"}</li>
                <li>- Categoría: {bloque.categoria || "—"}</li>
                <li>- Función: {bloque.funcion || "—"}</li>
                <li>- Carga horaria: {bloque.cargaHoraria || "—"}</li>
                <li>- {bloque.vigenciaHlc}</li>
              </ul>
              {bloque.warningsHlc.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {bloque.warningsHlc.map((warning) => (
                    <span
                      key={`${bloque.id}-${warning}`}
                      className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                    >
                      Advertencia · {warning}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Períodos de asignación a grupos de trabajo vigentes ({bloque.hlgVigentes.length})
                </p>
                {bloque.hlgVigentes.length === 0 ? (
                  <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Inconsistencia: cargo sin asignación a grupo de trabajo
                  </span>
                ) : (
                  <div className="mt-2 space-y-2">
                    {bloque.hlgVigentes.map((hlg) => (
                      <div key={hlg.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {hlg.grupo} · {hlg.funcion}
                        </p>
                        <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                          <li>- {hlg.periodo}</li>
                          <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                        </ul>
                        {hlg.warningHlg.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {hlg.warningHlg.map((warning) => (
                              <span
                                key={`${hlg.id}-${warning}`}
                                className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                              >
                                {warning}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onEditarHlg(hlg.id)}
                            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                          >
                            Editar este grupo
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeshabilitarHlg(hlg.id)}
                            className="h-8 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 active:bg-rose-100"
                          >
                            Deshabilitar asignación
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => onNuevoHlgEnHlc(bloque.hlcId)}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                  >
                    Crear nuevo grupo
                  </button>
                </div>
              </div>
              {bloque.hlgHistoricos.length > 0 ? (
                <div className="mt-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Períodos de asignación a grupos de trabajo históricos ({bloque.hlgHistoricos.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {bloque.hlgHistoricos.map((hlg) => (
                      <div
                        key={hlg.id}
                        className={`rounded-lg border px-2.5 py-2 ${
                          hlg.deshabilitado ? "border-rose-200 bg-rose-50/80" : "border-slate-300 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {hlg.grupo} · {hlg.funcion}
                          </p>
                          {hlg.deshabilitado ? (
                            <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                              Deshabilitado
                            </span>
                          ) : null}
                        </div>
                        <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                          <li>- {hlg.periodo}</li>
                          <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                        </ul>
                        {!hlg.deshabilitado ? (
                          <button
                            type="button"
                            onClick={() => onEditarHlg(hlg.id)}
                            className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                          >
                            Editar este grupo
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <LaboralHldVigenciaPanel
                vigenciaPantalla={bloque.hldVigenciaPantalla}
                hldId={bloque.hldId}
                modoAvanzado={modoAvanzado}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onEditarHlc(bloque.hlcId)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                >
                  Editar período de cargo
                </button>
                <button
                  type="button"
                  onClick={() => onDeshabilitarHlc(bloque.hlcId)}
                  className="h-9 rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 active:bg-rose-100"
                >
                  Deshabilitar ciclo HLC
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-1 text-xs text-slate-500">Última actualización: {ultimaActualizacionTexto}</p>
        <p className="text-sm font-semibold text-slate-900">Consistencia</p>
        {alertas.length === 0 ? (
          <div className="mt-2">
            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              OK · Sin alertas críticas
            </span>
          </div>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm text-amber-800">
            {alertas.map((a) => (
              <li
                key={a}
                className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
              >
                Advertencia · {a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
