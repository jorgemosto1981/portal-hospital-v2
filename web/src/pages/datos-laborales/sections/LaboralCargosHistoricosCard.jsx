import Card from "../../../components/ui/Card.jsx";

export default function LaboralCargosHistoricosCard({
  snapshotHistorico,
  onEditarHlg,
  onEditarHlc,
  onDeshabilitarHlc,
}) {
  const items = Array.isArray(snapshotHistorico) ? snapshotHistorico : [];

  return (
    <Card className="px-4 py-4 md:px-5">
      <p className="text-base font-semibold text-slate-900">CARGOS CERRADOS O HISTÓRICOS</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Sin períodos cerrados para la persona seleccionada.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-300 bg-slate-50 p-3">
              <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                Ciclo {item.orden}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Período de cargo cerrado</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{item.titulo}</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-700">
                <li>- Tipo de vínculo: {item.tipoVinculo || "—"}</li>
                <li>- Rol asignado: {item.rolHlc || "—"}</li>
                <li>- Escalafón: {item.escalafon || "—"}</li>
                <li>- Agrupamiento: {item.agrupamiento || "—"}</li>
                <li>- Categoría: {item.categoria || "—"}</li>
                <li>- Función: {item.funcion || "—"}</li>
                <li>- Carga horaria: {item.cargaHoraria || "—"}</li>
                <li>- {item.periodo}</li>
                <li>- Períodos de asignación a grupos de trabajo: {item.asignaciones}</li>
              </ul>
              {item.hlgVigentes.length > 0 ? (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Períodos de asignación a grupos de trabajo vigentes ({item.hlgVigentes.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {item.hlgVigentes.map((hlg) => (
                      <div key={hlg.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {hlg.grupo} · {hlg.funcion}
                        </p>
                        <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                          <li>- {hlg.periodo}</li>
                          <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                        </ul>
                        <button
                          type="button"
                          onClick={() => onEditarHlg(hlg.id)}
                          className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                        >
                          Editar este grupo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {item.hlgHistoricos.length > 0 ? (
                <div className="mt-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Períodos de asignación a grupos de trabajo históricos ({item.hlgHistoricos.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {item.hlgHistoricos.map((hlg) => (
                      <div key={hlg.id} className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {hlg.grupo} · {hlg.funcion}
                        </p>
                        <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                          <li>- {hlg.periodo}</li>
                          <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                        </ul>
                        <button
                          type="button"
                          onClick={() => onEditarHlg(hlg.id)}
                          className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                        >
                          Editar este grupo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onEditarHlc(item.hlcId)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                >
                  Editar período de cargo
                </button>
                <button
                  type="button"
                  onClick={() => onDeshabilitarHlc(item.hlcId)}
                  className="h-9 rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 active:bg-rose-100"
                >
                  Deshabilitar ciclo HLC
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
