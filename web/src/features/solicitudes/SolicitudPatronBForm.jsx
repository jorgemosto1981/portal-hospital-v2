import { useEffect, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import PatronBPreviewInfo from "./PatronBPreviewInfo.jsx";
import { etiquetaArticulo } from "./ticketeraUtils.js";

const PASOS = [
  { n: 1, titulo: "Artículo", hint: "Elegí el tipo de licencia" },
  { n: 2, titulo: "Fechas", hint: "Confirmá fechas y grupo" },
  { n: 3, titulo: "Previsualizar", hint: "Validá antes de enviar" },
];

function WizardStepper({ paso }) {
  return (
    <ol className="flex gap-1" aria-label="Pasos del trámite">
      {PASOS.map(({ n, titulo }) => {
        const activo = paso === n;
        const listo = paso > n;
        return (
          <li key={n} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                activo
                  ? "bg-sky-600 text-white ring-2 ring-sky-200"
                  : listo
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500",
              ].join(" ")}
              aria-current={activo ? "step" : undefined}
            >
              {listo ? "✓" : n}
            </span>
            <span
              className={[
                "hidden text-center text-[10px] font-medium sm:block",
                activo ? "text-sky-800" : "text-slate-500",
              ].join(" ")}
            >
              {titulo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Formulario alta Patrón B — wizard 3 pasos (Fase 2 ticketera).
 */
export default function SolicitudPatronBForm({
  personaId,
  claimsLoading = false,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  diasSolicitados,
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
  titulo = "Asuntos particulares y similares",
  descripcion = "Elegí el artículo, confirmá fechas y previsualizá antes de enviar.",
  wizardSeed = 0,
}) {
  const [paso, setPaso] = useState(1);

  useEffect(() => {
    setPaso(1);
  }, [wizardSeed, fechaDesde]);

  useEffect(() => {
    if (!articuloSel && paso > 1) setPaso(1);
  }, [articuloSel, paso]);

  /** Un solo artículo elegible → paso 2 sin clic extra (piloto 64-A). */
  useEffect(() => {
    if (
      paso === 1 &&
      !cargando &&
      articulos.length === 1 &&
      articuloSel &&
      /^per_/i.test(personaId)
    ) {
      setPaso(2);
    }
  }, [paso, cargando, articulos.length, articuloSel, personaId]);

  const pasoMeta = PASOS.find((p) => p.n === paso) || PASOS[0];

  const puedeContinuarPaso1 = Boolean(articuloSel) && !cargando && /^per_/i.test(personaId);
  const puedeIntentarContinuarPaso2 =
    puedeContinuarPaso1 &&
    !gruposCargando &&
    !validandoEntorno &&
    gruposVigentes.length > 0 &&
    (!requiereSeleccionGrupo || grupoAnclaOk);

  const puedePrevisualizar =
    puedeContinuarPaso1 &&
    !enviando &&
    !previewCargando &&
    typeof onPrevisualizar === "function";

  const puedeEnviar =
    puedeContinuarPaso1 && !enviando && !previewCargando && puedeEnviarTrasPreview;

  function irAtras() {
    setPaso((p) => Math.max(1, p - 1));
  }

  function irPaso2() {
    if (!puedeContinuarPaso1) return;
    setPaso(2);
  }

  async function handleContinuarPaso2() {
    if (!puedeIntentarContinuarPaso2 || typeof onValidarEntornoPaso2 !== "function") return;
    const result = await onValidarEntornoPaso2();
    if (result?.success) setPaso(3);
  }

  return (
    <>
      {titulo ? <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2> : null}
      {descripcion ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{descripcion}</p> : null}

      <div className="mt-4">
        <WizardStepper paso={paso} />
        <p className="mt-2 text-center text-xs text-slate-500 sm:text-left">
          Paso {paso} de 3 · {pasoMeta.hint}
        </p>
      </div>

      <Card className="mt-4 space-y-4 p-4">
        {!claimsLoading && !/^per_/i.test(personaId) ? (
          <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
        ) : null}

        {paso === 1 ? (
          <>
            <p className="text-sm font-medium text-slate-700">Fecha del permiso (referencia del listado)</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">{fechaDesde}</p>
            <p className="text-xs text-slate-500">
              Podés ajustar la fecha en el paso 2; al cambiarla se actualiza qué artículos aparecen.
            </p>

            {cargando ? <p className="text-sm text-slate-500">Buscando artículos disponibles…</p> : null}

            {!cargando && articulos.length === 0 && !error ? (
              <p className="text-sm text-slate-600">
                {motivoVacio ||
                  "No hay artículos disponibles para esa fecha (revisá cargo vigente, rol en cargo o requisitos del artículo)."}
              </p>
            ) : null}

            {!cargando && articulos.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Tipo de licencia</legend>
                {articulos.map((a) => {
                  const id = String(a.articulo_id || "");
                  const sel = String(articuloSel?.articulo_id || "") === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setArticuloSel(a)}
                      className={[
                        "flex min-h-[48px] w-full touch-manipulation flex-col rounded-xl border px-4 py-3 text-left transition-colors",
                        sel
                          ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span className="text-sm font-semibold text-slate-900">{etiquetaArticulo(a)}</span>
                      {Number(a.dias_solicitados) > 1 ? (
                        <span className="mt-0.5 text-xs text-slate-600">
                          {a.dias_solicitados} días por evento
                        </span>
                      ) : (
                        <span className="mt-0.5 text-xs text-slate-600">1 día por solicitud</span>
                      )}
                    </button>
                  );
                })}
              </fieldset>
            ) : null}

            <button
              type="button"
              disabled={!puedeContinuarPaso1}
              onClick={irPaso2}
              className="min-h-[44px] w-full touch-manipulation rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          </>
        ) : null}

        {paso === 2 ? (
          <>
            {articuloSel ? (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">
                Artículo: <span className="font-semibold">{etiquetaArticulo(articuloSel)}</span>
              </p>
            ) : null}

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Fecha del permiso</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Fecha hasta (solo lectura)</span>
              <input
                type="date"
                readOnly
                value={fechaHasta}
                className="min-h-[44px] w-full cursor-not-allowed touch-manipulation rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700"
                aria-readonly="true"
              />
              <span className="text-xs text-slate-500">
                Calculada por el artículo · {diasSolicitados} {diasSolicitados === 1 ? "día" : "días"}
              </span>
            </label>

            {gruposCargando ? (
              <p className="text-sm text-slate-500">Cargando grupos de trabajo vigentes…</p>
            ) : null}

            {!gruposCargando && gruposVigentes.length === 0 && !error ? (
              <p className="text-sm text-amber-800">
                No hay grupo de trabajo vigente para la fecha elegida.
              </p>
            ) : null}

            {requiereSeleccionGrupo && setGrupoAnclaId ? (
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Grupo de trabajo (ancla)</span>
                <select
                  value={grupoAnclaId}
                  onChange={(e) => setGrupoAnclaId(e.target.value)}
                  className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base"
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

            {entornoMensajes.length > 0 ? (
              <div
                className="rounded-xl border border-red-200 bg-red-50/90 px-3 py-3 text-sm text-red-950"
                role="alert"
              >
                {entornoMensajes.map((msg) => (
                  <p key={msg} className={entornoMensajes.length > 1 ? "mt-1 first:mt-0" : ""}>
                    {msg}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={irAtras}
                className="min-h-[44px] flex-1 touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={!puedeIntentarContinuarPaso2}
                onClick={() => void handleContinuarPaso2()}
                className="min-h-[44px] flex-1 touch-manipulation rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
              >
                {validandoEntorno ? "Validando entorno…" : "Continuar"}
              </button>
            </div>
          </>
        ) : null}

        {paso === 3 ? (
          <>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-700">
              <p>
                <span className="font-medium">{etiquetaArticulo(articuloSel)}</span>
              </p>
              <p className="mt-1 font-mono text-xs">
                {fechaDesde}
                {fechaHasta !== fechaDesde ? ` → ${fechaHasta}` : ""} · {diasSolicitados}{" "}
                {diasSolicitados === 1 ? "día" : "días"}
              </p>
            </div>

            <p className="text-sm text-slate-600">
              El motor valida elegibilidad y saldo sin guardar nada. Si todo está en verde, podés enviar.
            </p>

            <PatronBPreviewInfo preview={preview} error={previewError} cargando={previewCargando} />

            {onPrevisualizar ? (
              <button
                type="button"
                disabled={!puedePrevisualizar}
                onClick={onPrevisualizar}
                className="min-h-[44px] w-full touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewCargando
                  ? "Previsualizando…"
                  : preview
                    ? "Volver a previsualizar"
                    : "Previsualizar solicitud"}
              </button>
            ) : null}

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={irAtras}
                disabled={enviando}
                className="min-h-[44px] flex-1 touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={!puedeEnviar}
                onClick={onEnviar}
                className="min-h-[44px] flex-1 touch-manipulation rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando
                  ? "Enviando…"
                  : puedeEnviarTrasPreview
                    ? `Confirmar envío`
                    : "Confirmar envío (previsualizá antes)"}
              </button>
            </div>
          </>
        ) : null}

        {paso < 3 && error ? <p className="text-sm text-red-700">{error}</p> : null}
      </Card>
    </>
  );
}
