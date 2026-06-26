import { useEffect, useState } from "react";

import OpcionConsumoSelect from "./OpcionConsumoSelect.jsx";
import PatronBPreviewInfo from "./PatronBPreviewInfo.jsx";
import { TICKETERA } from "./ticketeraUi.js";
import { etiquetaArticulo, mensajeBloqueoPreview } from "./ticketeraUtils.js";

const PASOS = [
  { n: 1, titulo: "Artículo", etiquetaPaso: "1", hint: "Elegí el tipo de licencia" },
  { n: 2, titulo: "Fecha", etiquetaPaso: "Fecha", hint: "Fechas y grupo de trabajo" },
  { n: 3, titulo: "Enviar", etiquetaPaso: "Enviar", hint: "" },
];

/** @param {Record<string, unknown>} a */
function ArticuloBoton({ a, sel, onSelect }) {
  const id = String(a.articulo_id || "");
  const cod = String(a.codigo_grilla || "").trim() || "Artículo";
  const nom = String(a.nombre || "").trim();
  return (
    <button
      key={id}
      type="button"
      onClick={() => onSelect(a)}
      className={[
        TICKETERA.btnTileBase,
        TICKETERA.btnTilePatron,
        sel ? "border-sky-500 ring-2 ring-sky-200" : "",
      ].join(" ")}
    >
      <span className={TICKETERA.codigoPatron}>{cod}</span>
      {nom ? <span className={TICKETERA.nombreTile}>{nom}</span> : null}
    </button>
  );
}

function WizardStepper({ paso, pasosVisibles, confirmarFallido = false, confirmarExitoso = false }) {
  const pasos = pasosVisibles;
  const ultimoIdx = pasos.length - 1;

  const nodos = pasos.map((step) => {
    const n = step.n;
    const activo = paso === n;
    const completado = paso > n;
    const esEnviar = n === 3;
    const confirmarError = esEnviar && activo && confirmarFallido;
    const confirmarOk = esEnviar && activo && confirmarExitoso;
    const etiqueta = String(step.titulo || step.etiquetaPaso || n);

    let dotClass =
      "block shrink-0 rounded-full border-2 transition-colors h-3.5 w-3.5 sm:h-4 sm:w-4";
    if (confirmarError) {
      dotClass += " border-red-600 bg-red-600 ring-4 ring-red-100";
    } else if (confirmarOk || completado) {
      dotClass += " border-emerald-600 bg-emerald-600 ring-4 ring-emerald-100";
    } else if (activo) {
      dotClass += " border-sky-600 bg-sky-600 ring-4 ring-sky-100";
    } else {
      dotClass += " border-slate-300 bg-white";
    }

    let labelClass =
      "text-center text-[10px] font-medium leading-tight sm:text-xs max-w-[4.75rem] sm:max-w-[5.5rem]";
    if (confirmarError) labelClass += " text-red-700";
    else if (confirmarOk || completado) labelClass += " text-emerald-800";
    else if (activo) labelClass += " text-sky-800";
    else labelClass += " text-slate-500";

    return { n, activo, confirmarError, etiqueta, dotClass, labelClass, lineaCompleta: paso > n };
  });

  return (
    <div className="w-full" aria-label="Pasos del trámite" role="list">
      <div className="flex w-full items-center px-1">
        {nodos.map((node, idx) => (
          <div
            key={node.n}
            className={idx < ultimoIdx ? "flex min-w-0 flex-1 items-center" : "flex shrink-0 items-center"}
            role="listitem"
            aria-current={node.activo ? "step" : undefined}
          >
            <span
              className={node.dotClass}
              aria-invalid={node.confirmarError ? true : undefined}
              title={node.etiqueta}
            />
            {idx < ultimoIdx ? (
              <div
                className={[
                  "mx-2 h-0.5 min-w-[0.75rem] flex-1 rounded-full sm:mx-3",
                  node.lineaCompleta ? "bg-emerald-400" : "bg-slate-200",
                ].join(" ")}
                aria-hidden
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex w-full justify-between gap-1 px-0.5">
        {nodos.map((node) => (
          <span key={`lbl-${node.n}`} className={node.labelClass}>
            {node.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Formulario alta Patrón B — wizard (solo UI; validaciones en hook/callables).
 */
export default function SolicitudPatronBForm({
  personaId,
  claimsLoading = false,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  diasSolicitados,
  diasPreestablecidos = true,
  fechasCompletas = false,
  fechasListasParaEntorno = false,
  requiereOpcionConsumo = false,
  opcionConsumoId = "",
  onOpcionConsumoChange,
  articulos,
  articuloSel,
  setArticuloSel,
  cargando,
  error,
  motivoVacio,
  enviando,
  onEnviar,
  onPrevisualizar,
  preview = null,
  previewCargando = false,
  previewError = "",
  puedeEnviarTrasPreview = false,
  gruposVigentes = [],
  grupoAnclaId = "",
  setGrupoAnclaId,
  gruposCargando = false,
  requiereSeleccionGrupo = false,
  grupoAnclaOk = true,
  onValidarEntornoPaso2,
  validandoEntorno = false,
  entornoMensajes = [],
  entornoOk = false,
  titulo = "",
  descripcion = "",
  wizardSeed = 0,
  omitirPasoArticulo = false,
  reiniciarValidacionYPreview,
}) {
  const pasosVisibles = omitirPasoArticulo
    ? [
        { n: 2, titulo: "Fecha", etiquetaPaso: "Fecha", hint: "Fechas y grupo de trabajo" },
        { n: 3, titulo: "Enviar", etiquetaPaso: "Enviar", hint: "" },
      ]
    : PASOS;

  const pasoInicial = omitirPasoArticulo && articuloSel ? 2 : 1;
  const [paso, setPaso] = useState(pasoInicial);

  useEffect(() => {
    setPaso(omitirPasoArticulo && articuloSel ? 2 : 1);
  }, [wizardSeed, omitirPasoArticulo, articuloSel?.articulo_id]);

  useEffect(() => {
    if (!articuloSel && paso > 1) setPaso(omitirPasoArticulo ? 2 : 1);
  }, [articuloSel, paso, omitirPasoArticulo]);

  const pasoMeta = pasosVisibles.find((p) => p.n === paso) || pasosVisibles[0];
  const hintPaso = String(pasoMeta.hint || "").trim();

  const puedeContinuarPaso1 = Boolean(articuloSel) && !cargando && /^per_/i.test(personaId);

  const tieneFechaDesde = /^\d{4}-\d{2}-\d{2}$/.test(fechaDesde);
  const opcionConsumoOk = !requiereOpcionConsumo || Boolean(opcionConsumoId);
  const mostrarFechaHasta =
    tieneFechaDesde && (!requiereOpcionConsumo || opcionConsumoOk);
  const mostrarGrupo = fechasListasParaEntorno || fechasCompletas;
  const puedeValidarPaso2 =
    puedeContinuarPaso1 &&
    opcionConsumoOk &&
    (fechasListasParaEntorno || fechasCompletas) &&
    !gruposCargando &&
    !validandoEntorno &&
    !previewCargando &&
    !enviando &&
    gruposVigentes.length > 0 &&
    grupoAnclaOk;

  const puedeEnviar =
    puedeContinuarPaso1 && !enviando && !previewCargando && puedeEnviarTrasPreview && entornoOk;

  const mensajePreviewNegativo =
    entornoOk && preview && !puedeEnviarTrasPreview && !previewError
      ? mensajeBloqueoPreview(preview)
      : "";

  const confirmarFallido =
    paso === 3 &&
    !previewCargando &&
    Boolean(previewError || mensajePreviewNegativo);

  const confirmarExitoso =
    paso === 3 && !previewCargando && entornoOk && puedeEnviarTrasPreview && !previewError;

  function irAtras() {
    if (paso === 3) {
      reiniciarValidacionYPreview?.();
      setPaso(2);
      return;
    }
    if (paso === 2) {
      reiniciarValidacionYPreview?.();
      if (!omitirPasoArticulo) {
        setPaso(1);
        return;
      }
    }
  }

  function seleccionarArticulo(a) {
    reiniciarValidacionYPreview?.();
    setArticuloSel(a);
    setPaso(2);
  }

  async function handleValidarYPrevisualizar() {
    if (!puedeValidarPaso2 || typeof onValidarEntornoPaso2 !== "function") return;
    const result = await onValidarEntornoPaso2();
    if (!result?.success) return;
    if (typeof onPrevisualizar === "function") {
      await onPrevisualizar({ forzarTrasEntorno: true });
    }
    setPaso(3);
  }

  return (
    <>
      {titulo ? <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2> : null}
      {descripcion ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{descripcion}</p> : null}

      <div className="mt-2">
        <WizardStepper
          paso={paso}
          pasosVisibles={pasosVisibles}
          confirmarFallido={confirmarFallido}
          confirmarExitoso={confirmarExitoso}
        />
        {hintPaso ? (
          <p className="mt-2 text-center text-sm text-slate-600 sm:text-left">{hintPaso}</p>
        ) : null}
      </div>

      <div className={`mt-4 ${TICKETERA.card} ${TICKETERA.cardPad}`}>
        {!claimsLoading && !/^per_/i.test(personaId) ? (
          <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
        ) : null}

        {!omitirPasoArticulo && paso === 1 ? (
          <>
            {cargando ? <p className={TICKETERA.muted}>Buscando artículos disponibles…</p> : null}

            {!cargando && articulos.length === 0 && !error ? (
              <p className="text-sm text-slate-600">
                {motivoVacio ||
                  "No hay artículos disponibles (revisá cargo vigente o requisitos del artículo)."}
              </p>
            ) : null}

            {!cargando && articulos.length > 0 ? (
              <div className="space-y-2">
                {articulos.map((a) => (
                  <ArticuloBoton
                    key={String(a.articulo_id)}
                    a={a}
                    sel={String(articuloSel?.articulo_id || "") === String(a.articulo_id || "")}
                    onSelect={seleccionarArticulo}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {paso === 2 ? (
          <>
            {articuloSel ? (
              <div className={TICKETERA.chipArticulo}>
                <span className="text-xs font-medium uppercase tracking-wide text-sky-800">Solicitud</span>
                <p className={`mt-0.5 ${TICKETERA.codigoPatron}`}>
                  {String(articuloSel.codigo_grilla || "").trim() || "Artículo"}
                </p>
                {articuloSel.nombre ? (
                  <p className="mt-1 text-[11px] font-medium uppercase leading-snug tracking-wide text-sky-900/90">
                    {String(articuloSel.nombre)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {requiereOpcionConsumo ? (
              <OpcionConsumoSelect
                opciones={articuloSel?.opciones_consumo_solicitud}
                value={opcionConsumoId}
                onChange={(id) => onOpcionConsumoChange?.(id)}
                disabled={validandoEntorno || previewCargando || enviando}
              />
            ) : null}

            <label className="block space-y-1">
              <span className={TICKETERA.label}>Fecha de inicio</span>
              <input
                type="date"
                inputMode="numeric"
                value={fechaDesde}
                onChange={(e) => {
                  reiniciarValidacionYPreview?.();
                  setFechaDesde(e.target.value);
                }}
                className={TICKETERA.input}
              />
            </label>

            {mostrarFechaHasta ? (
              <label className="block space-y-1">
                <span className={TICKETERA.label}>
                  {diasPreestablecidos ? "Fecha de fin (automática)" : "Fecha de fin"}
                </span>
                <input
                  type="date"
                  inputMode="numeric"
                  readOnly={diasPreestablecidos}
                  value={fechaHasta}
                  min={fechaDesde || undefined}
                  onChange={(e) => setFechaHasta?.(e.target.value)}
                  className={diasPreestablecidos ? TICKETERA.inputReadonly : TICKETERA.input}
                  aria-readonly={diasPreestablecidos ? "true" : undefined}
                />
                <span className="text-xs text-slate-500">
                  {requiereOpcionConsumo && !entornoOk
                    ? "Se calculará con el calendario institucional al validar la solicitud."
                    : diasPreestablecidos
                      ? `Definida por el artículo · ${diasSolicitados} ${diasSolicitados === 1 ? "día laborable" : "días laborables"}`
                      : `Seleccioná el último día del permiso (${diasSolicitados} ${diasSolicitados === 1 ? "día" : "días"})`}
                </span>
              </label>
            ) : null}

            {mostrarGrupo ? (
              <>
                {gruposCargando ? (
                  <p className={TICKETERA.muted}>Cargando grupos de trabajo vigentes…</p>
                ) : null}

                {!gruposCargando && gruposVigentes.length === 0 && !error ? (
                  <p className="text-sm text-amber-800">
                    No hay grupo de trabajo vigente para la fecha elegida.
                  </p>
                ) : null}

                {requiereSeleccionGrupo && setGrupoAnclaId ? (
                  <label className="block space-y-1">
                    <span className={TICKETERA.label}>Grupo de trabajo</span>
                    <select
                      value={grupoAnclaId}
                      onChange={(e) => setGrupoAnclaId(e.target.value)}
                      className={TICKETERA.select}
                    >
                      <option value="">Elegí el grupo sobre el que pedís la licencia</option>
                      {gruposVigentes.map((g) => (
                        <option key={String(g.grupo_de_trabajo_id)} value={String(g.grupo_de_trabajo_id)}>
                          {String(g.etiqueta_ui || g.grupo_de_trabajo_id)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {!requiereSeleccionGrupo && gruposVigentes.length === 1 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Grupo:{" "}
                    <span className="font-medium">
                      {String(gruposVigentes[0]?.etiqueta_ui || gruposVigentes[0]?.grupo_de_trabajo_id || "—")}
                    </span>
                  </p>
                ) : null}
              </>
            ) : null}

            {entornoMensajes[0] ? (
              <p className={TICKETERA.alertError} role="alert">
                {entornoMensajes[0]}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              {!omitirPasoArticulo ? (
                <button type="button" onClick={irAtras} className={`flex-1 ${TICKETERA.btnSecondary}`}>
                  Atrás
                </button>
              ) : null}
              <button
                type="button"
                disabled={!puedeValidarPaso2}
                onClick={() => void handleValidarYPrevisualizar()}
                className={`flex-1 ${TICKETERA.btnPrimary}`}
              >
                {validandoEntorno
                  ? "Validando…"
                  : previewCargando
                    ? "Previsualizando…"
                    : "Validar solicitud"}
              </button>
            </div>
          </>
        ) : null}

        {paso === 3 ? (
          <>
            {articuloSel ? (
              <div className={TICKETERA.chipArticulo}>
                <span className="text-xs font-medium uppercase tracking-wide text-sky-800">Solicitud</span>
                <p className={`mt-0.5 ${TICKETERA.codigoPatron}`}>
                  {String(articuloSel.codigo_grilla || "").trim() || "Artículo"}
                </p>
                {articuloSel.nombre ? (
                  <p className="mt-1 text-[11px] font-medium uppercase leading-snug tracking-wide text-sky-900/90">
                    {String(articuloSel.nombre)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {previewCargando ? (
              <p className={TICKETERA.muted}>Validando y previsualizando la solicitud…</p>
            ) : null}

            {entornoOk && !previewError && puedeEnviarTrasPreview ? (
              <p className={TICKETERA.alertOk}>Validación correcta. Podés solicitar la licencia.</p>
            ) : null}

            {mensajePreviewNegativo ? (
              <p className={TICKETERA.alertError} role="alert">
                {mensajePreviewNegativo}
              </p>
            ) : null}

            <PatronBPreviewInfo preview={preview} error={previewError} cargando={previewCargando} />

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={irAtras}
                disabled={enviando}
                className={`flex-1 ${TICKETERA.btnSecondary}`}
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={!puedeEnviar}
                onClick={onEnviar}
                className={`flex-1 ${TICKETERA.btnSuccess}`}
              >
                {enviando ? "Enviando…" : "Solicitar licencia"}
              </button>
            </div>
          </>
        ) : null}

        {paso < 3 && error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </>
  );
}
