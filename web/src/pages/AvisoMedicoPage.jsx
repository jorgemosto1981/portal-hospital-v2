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
      comentarioAgente={alta.comentarioAgente}
      setComentarioAgente={alta.setComentarioAgente}
      archivo={alta.archivo}
      onSeleccionarArchivo={alta.onSeleccionarArchivo}
      gruposVigentes={alta.gruposVigentes}
      grupoAnclaId={alta.grupoAnclaId}
      setGrupoAnclaId={alta.setGrupoAnclaId}
      requiereSeleccionGrupo={alta.requiereSeleccionGrupo}
      gruposCargando={alta.gruposCargando}
      gruposError={alta.gruposError}
      puedeEnviar={alta.puedeEnviar}
      enviando={alta.enviando}
      error={alta.error}
      exito={alta.exito}
      onEnviar={() => void alta.enviarAviso()}
      onReiniciar={alta.reiniciar}
    />
  );
}
