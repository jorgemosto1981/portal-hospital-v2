import { useCallback, useMemo, useState } from "react";

import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";
import { useLaoWizardGrupoAncla } from "../lao/useLaoWizardGrupoAncla.js";
import { subirCertificadoAvisoMedico } from "../../services/avisosMedicoStorage.js";
import { crearAvisoMedicoCajaNegra } from "../../services/solicitudesArticuloV2Service.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Alta aviso médico Caja Negra — sin motor ni previsualización.
 * @param {{ personaId: string, authUid: string }} params
 */
export function useAvisoMedicoAlta({ personaId, authUid }) {
  const [tipoIngresoId, setTipoIngresoId] = useState(TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA);
  const [fechaInicioReposo, setFechaInicioReposo] = useState(ymdHoyBa());
  const [comentarioAgente, setComentarioAgente] = useState("");
  const [archivo, setArchivo] = useState(/** @type {File | null} */ (null));
  const [adjuntoSubido, setAdjuntoSubido] = useState(
    /** @type {{ storage_path: string, content_type?: string, nombre_archivo?: string } | null} */ (null),
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(/** @type {{ solicitud_id: string } | null} */ (null));

  const fechaRef = RX_YMD.test(fechaInicioReposo) ? fechaInicioReposo : ymdHoyBa();

  const {
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    requiereSeleccionGrupo,
    grupoAnclaOk,
    isLoading: gruposCargando,
    error: gruposError,
  } = useLaoWizardGrupoAncla({
    personaId,
    fechaRefYmd: fechaRef,
    enabled: /^per_/i.test(personaId),
  });

  const tieneAdjunto = Boolean(adjuntoSubido?.storage_path) || Boolean(archivo);

  const puedeEnviar = useMemo(() => {
    if (!/^per_/i.test(personaId)) return false;
    if (!grupoAnclaOk) return false;
    if (!tieneAdjunto) return false;
    if (
      tipoIngresoId !== TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA &&
      tipoIngresoId !== TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR
    ) {
      return false;
    }
    return true;
  }, [grupoAnclaOk, personaId, tieneAdjunto, tipoIngresoId]);

  const onSeleccionarArchivo = useCallback((file) => {
    setArchivo(file || null);
    setAdjuntoSubido(null);
    setError("");
  }, []);

  const enviarAviso = useCallback(async () => {
    if (!puedeEnviar || enviando) return;
    setEnviando(true);
    setError("");
    try {
      let adjunto = adjuntoSubido;
      if (!adjunto?.storage_path) {
        if (!archivo) {
          throw new Error("Adjuntá el certificado médico.");
        }
        adjunto = await subirCertificadoAvisoMedico(archivo, {
          authUid,
          year: Number(fechaRef.slice(0, 4)),
        });
        setAdjuntoSubido(adjunto);
      }

      const res = await crearAvisoMedicoCajaNegra({
        personaId,
        tipoIngresoId,
        grupoTrabajoIdAncla: grupoAnclaId,
        adjuntos: [adjunto],
        fechaInicioReposoEstimada: RX_YMD.test(fechaInicioReposo) ? fechaInicioReposo : undefined,
        comentarioAgente: comentarioAgente.trim() || undefined,
      });

      setExito({ solicitud_id: res.solicitud_id });
    } catch (e) {
      setError(e?.message || "No se pudo enviar el aviso. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }, [
    adjuntoSubido,
    archivo,
    authUid,
    comentarioAgente,
    enviando,
    fechaInicioReposo,
    fechaRef,
    grupoAnclaId,
    personaId,
    puedeEnviar,
    tipoIngresoId,
    archivo,
    adjuntoSubido,
  ]);

  const reiniciar = useCallback(() => {
    setExito(null);
    setError("");
    setArchivo(null);
    setAdjuntoSubido(null);
    setComentarioAgente("");
  }, []);

  return {
    tipoIngresoId,
    setTipoIngresoId,
    fechaInicioReposo,
    setFechaInicioReposo,
    comentarioAgente,
    setComentarioAgente,
    archivo,
    onSeleccionarArchivo,
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    requiereSeleccionGrupo,
    gruposCargando,
    gruposError,
    puedeEnviar,
    enviando,
    error,
    exito,
    enviarAviso,
    reiniciar,
  };
}
