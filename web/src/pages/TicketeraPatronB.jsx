import toast from "react-hot-toast";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SolicitudPatronBForm from "../features/solicitudes/SolicitudPatronBForm.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { useSolicitud64AAlta } from "../features/solicitudes/useSolicitud64AAlta.js";
import { ymdHoyBa } from "../features/solicitudes/ticketeraUtils.js";

function fechaDesdeQuery(searchParams) {
  const f = String(searchParams.get("fecha") || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : ymdHoyBa();
}

export default function TicketeraPatronB() {
  const [searchParams] = useSearchParams();
  const fechaInicial = useMemo(() => fechaDesdeQuery(searchParams), [searchParams]);

  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();

  const form = useSolicitud64AAlta({ personaId, fechaDesdeInicial: fechaInicial });

  async function onEnviar() {
    const solId = await form.enviar();
    if (solId) {
      toast.success(`Solicitud aceptada (${solId}). Estado: en revisión por jefe.`);
      await form.recargar();
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        Paso 2 · Patrón B ·{" "}
        <Link to="/portal/solicitudes" className="font-medium text-blue-700 hover:underline">
          cambiar fecha o carril
        </Link>
      </p>
      <SolicitudPatronBForm
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
        showFechaDesde
      />
    </div>
  );
}
