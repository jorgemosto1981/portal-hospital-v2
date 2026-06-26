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
      setFechaInicioReposoCompletar={alta.setFechaInicioReposoCompletar}
      setFechaFinReposoCompletar={alta.setFechaFinReposoCompletar}
      fechaMinimaYmd={alta.fechaMinimaYmd}
      emailUsaPerfil={alta.emailUsaPerfil}
      onToggleEmailUsaPerfil={alta.onToggleEmailUsaPerfil}
      contactoEmail={alta.contactoEmail}
      setContactoEmail={alta.setContactoEmail}
      sintomas={alta.sintomas}
      setSintomas={alta.setSintomas}
      enfermedad={alta.enfermedad}
      setEnfermedad={alta.setEnfermedad}
      codigoCie={alta.codigoCie}
      setCodigoCie={alta.setCodigoCie}
      detalleClinico={alta.detalleClinico}
      setDetalleClinico={alta.setDetalleClinico}
      comentarioAgente={alta.comentarioAgente}
      setComentarioAgente={alta.setComentarioAgente}
      esLicenciaIncompleta={alta.esLicenciaIncompleta}
      onToggleLicenciaIncompleta={alta.onToggleLicenciaIncompleta}
      plazoHorasCertificado={alta.plazoHorasCertificado}
      bloqueadoPorIncompleta={alta.bloqueadoPorIncompleta}
      avisoIncompletoVigente={alta.avisoIncompletoVigente}
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
