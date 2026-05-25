import { useState } from "react";
import { TICKETERA } from "./ticketeraUi.js";
import PatronCPreviewInfo from "./PatronCPreviewInfo.jsx";

const PASOS = [
  { n: 1, titulo: "Fecha y horas", etiquetaPaso: "1", hint: "Elegí la fecha y las horas" },
  { n: 2, titulo: "Validar", etiquetaPaso: "2", hint: "Revisá la elegibilidad" },
  { n: 3, titulo: "Enviar", etiquetaPaso: "Enviar", hint: "" },
];

export default function SolicitudPatronCForm(props) {
  const {
    wizardSeed,
    personaId,
    claimsLoading,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    horasSolicitadas,
    setHorasSolicitadas,
    articuloNombre,
    cargando,
    error,
    enviando,
    onEnviar,
    onPrevisualizar,
    preview,
    previewCargando,
    previewError,
    puedeEnviarTrasPreview,
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    gruposCargando,
    requiereSeleccionGrupo,
    grupoAnclaOk,
    onValidarEntornoPaso2,
    validandoEntorno,
    entornoMensajes,
    entornoOk,
    reiniciarValidacionYPreview,
  } = props;

  const [paso, setPaso] = useState(1);

  const puedeAvanzar1 =
    /^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fechaHasta) &&
    Number(horasSolicitadas) > 0 &&
    grupoAnclaOk;

  async function avanzarPaso2() {
    if (!puedeAvanzar1) return;
    const res = await onValidarEntornoPaso2();
    if (res?.success) {
      const pv = await onPrevisualizar({ forzarTrasEntorno: true });
      setPaso(2);
    }
  }

  async function avanzarPaso3() {
    if (!puedeEnviarTrasPreview) return;
    setPaso(3);
  }

  return (
    <div key={wizardSeed} className="space-y-4">
      {articuloNombre ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className="text-sm font-semibold text-slate-800">{articuloNombre}</p>
          <p className="text-xs text-slate-500">Patrón C · Cuenta corriente (horas)</p>
        </div>
      ) : null}

      {/* Stepper */}
      <nav className="flex gap-2">
        {PASOS.map((p) => (
          <div
            key={p.n}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition-colors ${
              paso === p.n
                ? "bg-violet-100 text-violet-900 ring-1 ring-violet-300"
                : paso > p.n
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-50 text-slate-400"
            }`}
          >
            {p.titulo}
          </div>
        ))}
      </nav>

      {cargando ? <p className={TICKETERA.muted}>Cargando artículo…</p> : null}

      {/* Paso 1: Fecha + Horas + Grupo */}
      {paso === 1 && !cargando ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad} space-y-4`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Fecha desde</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); reiniciarValidacionYPreview(); }}
                className={TICKETERA.input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Fecha hasta</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                min={fechaDesde}
                className={TICKETERA.input}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Horas solicitadas</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={horasSolicitadas}
              onChange={(e) => { setHorasSolicitadas(e.target.value); reiniciarValidacionYPreview(); }}
              placeholder="Ej: 6"
              className={TICKETERA.input}
            />
          </label>

          {gruposCargando ? <p className={TICKETERA.muted}>Cargando grupos…</p> : null}
          {!gruposCargando && requiereSeleccionGrupo ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Grupo de trabajo</span>
              <select
                value={grupoAnclaId}
                onChange={(e) => setGrupoAnclaId(e.target.value)}
                className={TICKETERA.input}
              >
                <option value="">Seleccioná grupo</option>
                {gruposVigentes.map((g) => (
                  <option key={g.grupo_de_trabajo_id} value={g.grupo_de_trabajo_id}>
                    {g.etiqueta_ui || g.nombre || g.grupo_de_trabajo_id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {!gruposCargando && !requiereSeleccionGrupo && gruposVigentes.length === 1 ? (
            <p className="text-sm text-slate-600">
              Grupo:{" "}
              <span className="font-medium">
                {String(gruposVigentes[0]?.etiqueta_ui || gruposVigentes[0]?.grupo_de_trabajo_id || "—")}
              </span>
            </p>
          ) : null}

          {entornoMensajes.length > 0 ? (
            <div className="rounded-lg bg-amber-50 p-3">
              {entornoMensajes.map((m, i) => (
                <p key={i} className="text-sm text-amber-800">{m}</p>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!puedeAvanzar1 || validandoEntorno || previewCargando}
            onClick={avanzarPaso2}
            className={TICKETERA.btnPrimary}
          >
            {validandoEntorno || previewCargando ? "Validando…" : "Validar solicitud"}
          </button>
        </div>
      ) : null}

      {/* Paso 2: Preview */}
      {paso === 2 ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad} space-y-4`}>
          {previewCargando ? <p className={TICKETERA.muted}>Evaluando elegibilidad…</p> : null}
          {previewError ? <p className="text-sm text-red-700">{previewError}</p> : null}

          {preview ? <PatronCPreviewInfo preview={preview} /> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPaso(1); reiniciarValidacionYPreview(); }}
              className={TICKETERA.btnSecondary}
            >
              Volver
            </button>
            {puedeEnviarTrasPreview ? (
              <button type="button" onClick={avanzarPaso3} className={TICKETERA.btnPrimary}>
                Continuar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Paso 3: Confirmar y enviar */}
      {paso === 3 ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad} space-y-4`}>
          <p className="text-sm font-medium text-slate-800">
            Vas a solicitar <strong>{horasSolicitadas} hora(s)</strong> para el{" "}
            {fechaDesde === fechaHasta ? fechaDesde : `${fechaDesde} al ${fechaHasta}`}.
          </p>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaso(2)}
              className={TICKETERA.btnSecondary}
            >
              Volver
            </button>
            <button
              type="button"
              disabled={enviando || !puedeEnviarTrasPreview}
              onClick={onEnviar}
              className={TICKETERA.btnSuccess}
            >
              {enviando ? "Enviando…" : "Solicitar compensatorio"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
