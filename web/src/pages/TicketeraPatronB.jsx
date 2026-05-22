import toast from "react-hot-toast";
import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import SolicitudPatronBForm from "../features/solicitudes/SolicitudPatronBForm.jsx";
import { TICKETERA } from "../features/solicitudes/ticketeraUi.js";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { useSolicitud64AAlta } from "../features/solicitudes/useSolicitud64AAlta.js";
import { ymdHoyBa } from "../features/solicitudes/ticketeraUtils.js";

function fechaDesdeQuery(searchParams) {
  const f = String(searchParams.get("fecha") || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : ymdHoyBa();
}

function articuloIdQuery(searchParams) {
  const id = String(searchParams.get("articulo") || searchParams.get("articulo_id") || "").trim();
  return /^art_/i.test(id) ? id : "";
}

export default function TicketeraPatronB() {
  const [searchParams] = useSearchParams();
  const articuloIdInicial = useMemo(() => articuloIdQuery(searchParams), [searchParams]);
  const fechaInicial = useMemo(() => fechaDesdeQuery(searchParams), [searchParams]);
  const [wizardSeed, setWizardSeed] = useState(0);
  const [confirmacion, setConfirmacion] = useState(
    /** @type {{ solicitud_id: string, huerfana: boolean } | null} */ (null),
  );

  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();

  const form = useSolicitud64AAlta({ personaId, fechaDesdeInicial: fechaInicial, articuloIdInicial });

  if (!articuloIdInicial) {
    return <Navigate to="/portal/solicitudes" replace />;
  }

  async function onEnviar() {
    const result = await form.enviar();
    const solId =
      typeof result === "string" ? result : String(result?.solicitud_id || "").trim();
    if (!solId) return;

    const huerfana =
      typeof result === "object" && result != null && result.autorizacion_rrhh_sustituta === true;

    setConfirmacion({ solicitud_id: solId, huerfana });
    toast.success("Tu solicitud quedó registrada correctamente.");
    await form.recargar();
    setWizardSeed((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      {confirmacion ? (
        <div className={TICKETERA.confirmCard} role="status">
          <p className="text-base font-semibold text-emerald-950">Solicitud registrada</p>
          <p className="mt-2 font-mono text-sm text-emerald-900">{confirmacion.solicitud_id}</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            {confirmacion.huerfana
              ? "No requiere jefatura: es huérfana. Podés cerrarla desde Bandeja RRHH (cierre sustituto), también si sos el titular con rol RRHH."
              : "Quedó pendiente de jefatura; el cierre del trámite lo hace el autorizador jerárquico."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirmacion(null)}
              className={TICKETERA.btnSecondary}
            >
              Cargar otra solicitud
            </button>
            <Link
              to="/portal/solicitudes"
              className={`${TICKETERA.btnSuccess} inline-flex items-center justify-center`}
            >
              Volver a solicitudes
            </Link>
          </div>
        </div>
      ) : null}

      <SolicitudPatronBForm
        wizardSeed={wizardSeed}
        omitirPasoArticulo
        personaId={personaId}
        claimsLoading={claimsLoading}
        fechaDesde={form.fechaDesde}
        setFechaDesde={form.setFechaDesde}
        fechaHasta={form.fechaHasta}
        diasSolicitados={form.diasSolicitados}
        articulos={form.articulos}
        articuloSel={form.articuloSel}
        setArticuloSel={form.setArticuloSel}
        cargando={form.cargando}
        error={form.error}
        motivoVacio={form.motivoVacio}
        enviando={form.enviando}
        onEnviar={onEnviar}
        onPrevisualizar={form.previsualizar}
        preview={form.preview}
        previewCargando={form.previewCargando}
        previewError={form.previewError}
        puedeEnviarTrasPreview={form.puedeEnviarTrasPreview}
        gruposVigentes={form.gruposVigentes}
        grupoAnclaId={form.grupoAnclaId}
        setGrupoAnclaId={form.setGrupoAnclaId}
        gruposCargando={form.gruposCargando}
        requiereSeleccionGrupo={form.requiereSeleccionGrupo}
        grupoAnclaOk={form.grupoAnclaOk}
        onValidarEntornoPaso2={form.validarEntornoPaso2}
        validandoEntorno={form.validandoEntorno}
        entornoMensajes={form.entornoMensajes}
        entornoOk={form.entornoOk}
        reiniciarValidacionYPreview={form.reiniciarValidacionYPreview}
        titulo=""
        descripcion=""
      />
    </div>
  );
}
