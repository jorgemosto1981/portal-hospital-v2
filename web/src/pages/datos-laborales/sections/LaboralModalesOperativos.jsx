import LabeledTextField from "../components/LabeledTextField.jsx";

export default function LaboralModalesOperativos({
  deshabilitarModalAbierto,
  deshabilitarForm,
  setDeshabilitarForm,
  opcionesMotivoDeshabilitacionHlc,
  deshabilitarError,
  deshabilitando,
  cerrarModalDeshabilitarHlc,
  confirmarDeshabilitacionHlc,
  deshabilitarHlgModalAbierto,
  deshabilitarHlgForm,
  setDeshabilitarHlgForm,
  deshabilitarHlgError,
  deshabilitarHlgPaso,
  deshabilitarHlgResumen,
  cerrarModalDeshabilitarHlg,
  confirmarDeshabilitacionHlg,
  resultadoModalAbierto,
  resultadoModalMsg,
  setResultadoModalAbierto,
  cerrarFlujoFormularioManteniendoPersona,
}) {
  return (
    <>
      {deshabilitarModalAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:p-5">
            <p className="text-base font-semibold text-slate-900">Deshabilitar ciclo HLC</p>
            <p className="mt-1 text-sm text-slate-600">
              Esta acción retira el ciclo de los flujos operativos, cierra y deshabilita la cadena asociada (HLd/HLg) sin
              borrar historial.
            </p>
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              No se podrá rehabilitar este ciclo. Si se requiere continuidad, deberás crear un nuevo ciclo HLC.
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-800">Motivo de deshabilitación</span>
                <select
                  value={deshabilitarForm.motivo_id}
                  onChange={(e) => setDeshabilitarForm((prev) => ({ ...prev, motivo_id: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  <option value="">Seleccioná un motivo</option>
                  {opcionesMotivoDeshabilitacionHlc.map((opt) => (
                    <option key={String(opt.id)} value={String(opt.id)}>
                      {String(opt.nombre || opt.label || opt.descripcion || "Sin nombre")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-800">Fecha de corte (opcional)</span>
                <input
                  type="date"
                  value={deshabilitarForm.fecha_corte}
                  onChange={(e) => setDeshabilitarForm((prev) => ({ ...prev, fecha_corte: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-300"
                />
                <span className="text-xs text-slate-500">Si no la informás, se usa la fecha de hoy.</span>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-800">Comentario (opcional)</span>
                <textarea
                  value={deshabilitarForm.comentario}
                  onChange={(e) => setDeshabilitarForm((prev) => ({ ...prev, comentario: e.target.value.slice(0, 500) }))}
                  rows={3}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-300"
                  placeholder="Observación interna"
                />
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={deshabilitarForm.confirmar_impacto}
                  onChange={(e) =>
                    setDeshabilitarForm((prev) => ({ ...prev, confirmar_impacto: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>Confirmo que se deshabilitará el HLC y se cerrarán/deshabilitarán sus HLd/HLg asociados.</span>
              </label>
            </div>
            {deshabilitarError ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{deshabilitarError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarModalDeshabilitarHlc}
                disabled={deshabilitando}
                className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarDeshabilitacionHlc}
                disabled={deshabilitando}
                className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deshabilitando ? "Deshabilitando..." : "Deshabilitar ciclo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deshabilitarHlgModalAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:p-5">
            <p className="text-base font-semibold text-slate-900">Deshabilitar asignación a grupo (HLg)</p>
            {deshabilitarHlgPaso === 1 ? (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  La asignación quedará inactiva y cerrada en la fecha de corte. Ese día sigue vigente solo para
                  solicitudes/imputación de períodos; en la grilla operativa deja de incorporarse desde el corte.
                </p>
                <div className="mt-4 space-y-3">
                  <LabeledTextField
                    label="Fecha de corte"
                    value={deshabilitarHlgForm.fecha_corte}
                    onValueChange={(v) => setDeshabilitarHlgForm((prev) => ({ ...prev, fecha_corte: v }))}
                    placeholder="AAAA-MM-DD"
                  />
                  <LabeledTextField
                    label="Motivo (opcional, auditoría)"
                    value={deshabilitarHlgForm.motivo}
                    onValueChange={(v) =>
                      setDeshabilitarHlgForm((prev) => ({ ...prev, motivo: String(v || "").slice(0, 100) }))
                    }
                    placeholder="Hasta 100 caracteres"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Tras el corte se purgará la <strong>capa teórica</strong> (turnos RDA) en{" "}
                  <strong>{deshabilitarHlgResumen?.grupoLabel || "este grupo"}</strong>, desde la fecha de corte inclusive
                  hasta el fin del mes siguiente (ventana operativa M+M+1). No se modifican licencias ni eventos MDC ya
                  registrados.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Fecha de corte indicada: {deshabilitarHlgForm.fecha_corte || deshabilitarHlgResumen?.fechaCorte || "—"}
                </p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={deshabilitarHlgForm.confirmar}
                      onChange={(e) =>
                        setDeshabilitarHlgForm((prev) => ({ ...prev, confirmar: e.target.checked }))
                      }
                      className="mt-1"
                    />
                    Confirmo deshabilitar esta asignación HLg.
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={deshabilitarHlgForm.confirmar_purge}
                      onChange={(e) =>
                        setDeshabilitarHlgForm((prev) => ({ ...prev, confirmar_purge: e.target.checked }))
                      }
                      className="mt-1"
                    />
                    Confirmo la purga de turnos teóricos (RDA) en días posteriores al corte en ese grupo.
                  </label>
                </div>
              </>
            )}
            {deshabilitarHlgError ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{deshabilitarHlgError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarModalDeshabilitarHlg}
                disabled={deshabilitando}
                className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarDeshabilitacionHlg}
                disabled={deshabilitando}
                className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deshabilitando
                  ? "Deshabilitando..."
                  : deshabilitarHlgPaso === 1
                    ? "Continuar"
                    : "Deshabilitar asignación"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resultadoModalAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:p-5">
            <p className="text-base font-semibold text-slate-900">Resultado de la operación</p>
            <p
              className={`mt-3 max-h-[40vh] overflow-y-auto rounded-lg px-3 py-2 text-sm ${
                resultadoModalMsg.startsWith("Guardado correctamente")
                  ? "bg-emerald-50 text-emerald-700"
                  : resultadoModalMsg.startsWith("Guardado con advertencias:")
                    ? "bg-amber-50 text-amber-800"
                    : "bg-rose-50 text-rose-700"
              }`}
            >
              {resultadoModalMsg}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const fueGuardado =
                    resultadoModalMsg.startsWith("Guardado correctamente") ||
                    resultadoModalMsg.startsWith("Guardado con advertencias:");
                  setResultadoModalAbierto(false);
                  if (fueGuardado) cerrarFlujoFormularioManteniendoPersona();
                }}
                className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
