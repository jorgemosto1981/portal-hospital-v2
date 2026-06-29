import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import AvisoMedicoForm from "../features/solicitudes/AvisoMedicoForm.jsx";
import { useAvisoMedicoAlta } from "../features/solicitudes/useAvisoMedicoAlta.js";

export default function AvisoMedicoPage() {
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();
  const authUid = String(user?.uid || "").trim();

  const alta = useAvisoMedicoAlta({ personaId, authUid });

  return (
    <AvisoMedicoForm
      claimsLoading={claimsLoading}
      personaId={personaId}
      tipoIngresoId={alta.tipoIngresoId}
      setTipoIngresoId={alta.setTipoIngresoId}
      fechaInicioReposo={alta.fechaInicioReposo}
      setFechaInicioReposo={alta.setFechaInicioReposo}
      fechaFinReposo={alta.fechaFinReposo}
      setFechaFinReposo={alta.setFechaFinReposo}
      setFechaFinReposoCompletar={alta.setFechaFinReposoCompletar}
      fechaMinimaYmd={alta.fechaMinimaYmd}
      modoAlta={alta.modoAlta}
      setModoAlta={alta.setModoAlta}
      aceptoPlazoProvisorio={alta.aceptoPlazoProvisorio}
      setAceptoPlazoProvisorio={alta.setAceptoPlazoProvisorio}
      detalleClinicoPrincipal={alta.detalleClinicoPrincipal}
      setDetalleClinicoPrincipal={alta.setDetalleClinicoPrincipal}
      detalleClinico={alta.detalleClinico}
      setDetalleClinico={alta.setDetalleClinico}
      domicilioReposoAlternativo={alta.domicilioReposoAlternativo}
      setDomicilioReposoAlternativo={alta.setDomicilioReposoAlternativo}
      plazoHorasCertificado={alta.plazoHorasCertificado}
      avisosProvisoriosVigentes={alta.avisosProvisoriosVigentes}
      permiteNuevoProvisorio={alta.permiteNuevoProvisorio}
      maxProvisoriosVigentes={alta.maxProvisoriosVigentes}
      tieneProvisoriosPendientes={alta.tieneProvisoriosPendientes}
      avisoCompletarActivo={alta.avisoCompletarActivo}
      buscandoAvisoPendiente={alta.buscandoAvisoPendiente}
      completarModalAbierto={alta.completarModalAbierto}
      onAbrirCompletarModal={alta.abrirCompletarModal}
      onCerrarCompletarModal={alta.cerrarCompletarModal}
      archivoCompletar={alta.archivoCompletar}
      onSeleccionarArchivoCompletar={alta.onSeleccionarArchivoCompletar}
      puedeCompletar={alta.puedeCompletar}
      enviandoCompletar={alta.enviandoCompletar}
      errorCompletar={alta.errorCompletar}
      onCompletarAviso={() => void alta.enviarCompletar()}
      archivo={alta.archivo}
      onSeleccionarArchivo={alta.onSeleccionarArchivo}
      gruposVigentes={alta.gruposVigentes}
      grupoAnclaId={alta.grupoAnclaId}
      setGrupoAnclaId={alta.setGrupoAnclaId}
      requiereSeleccionGrupo={alta.requiereSeleccionGrupo}
      gruposCargando={alta.gruposCargando}
      gruposError={alta.gruposError}
      perfilCargando={alta.perfilCargando}
      perfilContacto={alta.perfilContacto}
      contactoUsaPerfil={alta.contactoUsaPerfil}
      onToggleContactoUsaPerfil={alta.onToggleContactoUsaPerfil}
      contactoEmail={alta.contactoEmail}
      setContactoEmail={alta.setContactoEmail}
      contactoTelCelular={alta.contactoTelCelular}
      setContactoTelCelular={alta.setContactoTelCelular}
      contactoTelFijo={alta.contactoTelFijo}
      setContactoTelFijo={alta.setContactoTelFijo}
      contactoDomicilio={alta.contactoDomicilio}
      setContactoDomicilio={alta.setContactoDomicilio}
      permaneceEnDomicilio={alta.permaneceEnDomicilio}
      setPermaneceEnDomicilio={alta.setPermaneceEnDomicilio}
      ddjjCargando={alta.ddjjCargando}
      ddjjDisponible={alta.ddjjDisponible}
      familiaresOpciones={alta.familiaresOpciones}
      familiarAtendidoId={alta.familiarAtendidoId}
      setFamiliarAtendidoId={alta.setFamiliarAtendidoId}
      puedeEnviar={alta.puedeEnviar}
      enviando={alta.enviando}
      error={alta.error}
      exito={alta.exito}
      onEnviar={() => void alta.enviarAviso()}
      onReiniciar={alta.reiniciar}
    />
  );
}
