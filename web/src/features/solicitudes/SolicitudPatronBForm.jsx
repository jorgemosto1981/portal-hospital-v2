import Card from "../../components/ui/Card.jsx";
import PatronBPreviewInfo from "./PatronBPreviewInfo.jsx";
import { etiquetaArticulo } from "./ticketeraUtils.js";

/**
 * Formulario alta Patrón B (64-A, 64-B, …).
 * @param {{
 *   personaId: string,
 *   claimsLoading?: boolean,
 *   fechaDesde: string,
 *   setFechaDesde: (v: string) => void,
 *   fechaHasta: string,
 *   diasSolicitados: number,
 *   articulos: Array<Record<string, unknown>>,
 *   articuloSel: Record<string, unknown> | null,
 *   setArticuloSel: (a: Record<string, unknown> | null) => void,
 *   cargando: boolean,
 *   error: string,
 *   motivoVacio: string,
 *   enviando: boolean,
 *   onEnviar: () => void | Promise<void>,
 *   onPrevisualizar?: () => void | Promise<void>,
 *   preview?: Record<string, unknown> | null,
 *   previewCargando?: boolean,
 *   previewError?: string,
 *   puedeEnviarTrasPreview?: boolean,
 *   showFechaDesde?: boolean,
 *   gruposVigentes?: Array<Record<string, unknown>>,
 *   grupoAnclaId?: string,
 *   setGrupoAnclaId?: (v: string) => void,
 *   gruposCargando?: boolean,
 *   requiereSeleccionGrupo?: boolean,
 *   grupoAnclaOk?: boolean,
 *   titulo?: string,
 *   descripcion?: string,
 * }} props
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
  showFechaDesde = true,
  gruposVigentes = [],
  grupoAnclaId = "",
  setGrupoAnclaId,
  gruposCargando = false,
  requiereSeleccionGrupo = false,
  grupoAnclaOk = true,
  titulo = "Asuntos particulares y similares",
  descripcion = "Un día por solicitud. El saldo del ciclo se reserva al enviar. Solo aparecen artículos para los que cumplís requisitos de cargo y rol.",
}) {
  const puedePrevisualizar =
    Boolean(articuloSel) &&
    !cargando &&
    !enviando &&
    !previewCargando &&
    !gruposCargando &&
    grupoAnclaOk &&
    /^per_/i.test(personaId);
  const puedeEnviar =
    Boolean(articuloSel) &&
    !cargando &&
    !enviando &&
    !previewCargando &&
    !gruposCargando &&
    grupoAnclaOk &&
    /^per_/i.test(personaId) &&
    puedeEnviarTrasPreview;

  return (
  <>
      {titulo ? <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2> : null}
      {descripcion ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{descripcion}</p> : null}

      <Card className="mt-4 space-y-4 p-4">
        {!claimsLoading && !/^per_/i.test(personaId) ? (
          <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
        ) : null}

        {showFechaDesde ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Fecha del permiso</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            />
          </label>
        ) : null}

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

        {cargando ? <p className="text-sm text-slate-500">Buscando artículos disponibles…</p> : null}

        {!cargando && articulos.length === 0 && !error ? (
          <p className="text-sm text-slate-600">
            {motivoVacio ||
              "No hay artículos disponibles para esa fecha (revisá cargo vigente, rol en cargo o requisitos del artículo)."}
          </p>
        ) : null}

        {articulos.length > 1 ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Tipo de licencia</span>
            <select
              value={String(articuloSel?.articulo_id || "")}
              onChange={(e) => {
                const art = articulos.find((a) => a.articulo_id === e.target.value);
                setArticuloSel(art || null);
              }}
              className="min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base"
            >
              <option value="">Elegí con goce o sin goce</option>
              {articulos.map((a) => (
                <option key={String(a.articulo_id)} value={String(a.articulo_id)}>
                  {etiquetaArticulo(a)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {articuloSel ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">{etiquetaArticulo(articuloSel)}</span>
          </p>
        ) : null}

        {articuloSel ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Fecha hasta (definida por el artículo)</span>
            <input
              type="date"
              readOnly
              value={fechaHasta}
              className="min-h-[44px] w-full cursor-not-allowed touch-manipulation rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700"
              aria-readonly="true"
            />
          </label>
        ) : null}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {articuloSel ? (
          <PatronBPreviewInfo preview={preview} error={previewError} cargando={previewCargando} />
        ) : null}

        {articuloSel && onPrevisualizar ? (
          <button
            type="button"
            disabled={!puedePrevisualizar}
            onClick={onPrevisualizar}
            className="min-h-[44px] w-full touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {previewCargando ? "Previsualizando…" : "Previsualizar"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={!puedeEnviar}
          onClick={onEnviar}
          className="min-h-[44px] w-full touch-manipulation rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando
            ? "Enviando…"
            : puedeEnviarTrasPreview
              ? `Enviar solicitud (${diasSolicitados} ${diasSolicitados === 1 ? "día" : "días"})`
              : "Enviar (previsualizá antes)"}
        </button>
      </Card>
    </>
  );
}
