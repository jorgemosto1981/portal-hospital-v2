import { useCallback, useEffect, useMemo, useState } from "react";

import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";
import { useLaoWizardGrupoAncla } from "../lao/useLaoWizardGrupoAncla.js";
import { subirCertificadoAvisoMedico } from "../../services/avisosMedicoStorage.js";
import {
  callActualizarAvisoMedicoIncompleto,
  callBuscarAvisoIncompletaVigente,
} from "../../services/callables.js";
import { leerPlazoHorasLicenciaIncompleta } from "../../services/cfgParametrosSistemaService.js";
import { crearAvisoMedicoCajaNegra } from "../../services/solicitudesArticuloV2Service.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Alta / completar aviso médico Caja Negra — sin motor ni previsualización.
 * @param {{ personaId: string, authUid: string }} params
 */
export function useAvisoMedicoAlta({ personaId, authUid }) {
  const [tipoIngresoId, setTipoIngresoId] = useState(TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA);
  const [fechaInicioReposo, setFechaInicioReposo] = useState(ymdHoyBa());
  const [comentarioAgente, setComentarioAgente] = useState("");
  const [esLicenciaIncompleta, setEsLicenciaIncompleta] = useState(false);
  const [plazoHorasCertificado, setPlazoHorasCertificado] = useState(/** @type {number | null} */ (null));
  const [avisoIncompletoVigente, setAvisoIncompletoVigente] = useState(
    /** @type {{ solicitud_id: string } | null} */ (null),
  );
  const [buscandoAvisoPendiente, setBuscandoAvisoPendiente] = useState(false);
  const [archivo, setArchivo] = useState(/** @type {File | null} */ (null));
  const [adjuntoSubido, setAdjuntoSubido] = useState(
    /** @type {{ storage_path: string, content_type?: string, nombre_archivo?: string } | null} */ (null),
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(/** @type {{ solicitud_id: string, provisorio?: boolean } | null} */ (null));

  const modoCompletar = Boolean(avisoIncompletoVigente?.solicitud_id);
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
    enabled: /^per_/i.test(personaId) && !modoCompletar,
  });

  useEffect(() => {
    if (!/^per_/i.test(personaId)) return;
    let cancelled = false;
    (async () => {
      try {
        const horas = await leerPlazoHorasLicenciaIncompleta({ fallbackDevOnly: 24 });
        if (!cancelled) setPlazoHorasCertificado(horas);
      } catch {
        if (!cancelled) setPlazoHorasCertificado(24);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  useEffect(() => {
    if (!/^per_/i.test(personaId)) {
      setAvisoIncompletoVigente(null);
      return;
    }
    let cancelled = false;
    setBuscandoAvisoPendiente(true);
    (async () => {
      try {
        const res = await callBuscarAvisoIncompletaVigente();
        const data = res?.data;
        if (cancelled) return;
        if (data?.ok && data.solicitud_id) {
          setAvisoIncompletoVigente({ solicitud_id: String(data.solicitud_id) });
        } else {
          setAvisoIncompletoVigente(null);
        }
      } catch {
        if (!cancelled) setAvisoIncompletoVigente(null);
      } finally {
        if (!cancelled) setBuscandoAvisoPendiente(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  const tieneAdjunto = Boolean(adjuntoSubido?.storage_path) || Boolean(archivo);

  const puedeEnviar = useMemo(() => {
    if (!/^per_/i.test(personaId)) return false;
    if (modoCompletar) {
      return tieneAdjunto;
    }
    if (!grupoAnclaOk) return false;
    if (esLicenciaIncompleta) {
      // aviso provisorio sin certificado
    } else if (!tieneAdjunto) {
      return false;
    }
    if (
      tipoIngresoId !== TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA &&
      tipoIngresoId !== TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR
    ) {
      return false;
    }
    return true;
  }, [
    esLicenciaIncompleta,
    grupoAnclaOk,
    modoCompletar,
    personaId,
    tieneAdjunto,
    tipoIngresoId,
  ]);

  const onSeleccionarArchivo = useCallback((file) => {
    setArchivo(file || null);
    setAdjuntoSubido(null);
    setError("");
  }, []);

  const onToggleLicenciaIncompleta = useCallback((checked) => {
    setEsLicenciaIncompleta(checked);
    if (checked) {
      setArchivo(null);
      setAdjuntoSubido(null);
    }
    setError("");
  }, []);

  const enviarAviso = useCallback(async () => {
    if (!puedeEnviar || enviando) return;
    setEnviando(true);
    setError("");
    try {
      if (modoCompletar && avisoIncompletoVigente?.solicitud_id) {
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

        const res = await callActualizarAvisoMedicoIncompleto({
          solicitud_id: avisoIncompletoVigente.solicitud_id,
          adjuntos: [adjunto],
          fecha_inicio_reposo_estimada: RX_YMD.test(fechaInicioReposo) ? fechaInicioReposo : undefined,
        });
        const data = res?.data;
        if (!data?.ok) {
          throw new Error(data?.mensaje || "No se pudo completar el aviso.");
        }
        setExito({ solicitud_id: avisoIncompletoVigente.solicitud_id });
        setAvisoIncompletoVigente(null);
        return;
      }

      if (esLicenciaIncompleta) {
        const res = await crearAvisoMedicoCajaNegra({
          personaId,
          tipoIngresoId,
          grupoTrabajoIdAncla: grupoAnclaId,
          adjuntos: [],
          fechaInicioReposoEstimada: RX_YMD.test(fechaInicioReposo) ? fechaInicioReposo : undefined,
          comentarioAgente: comentarioAgente.trim() || undefined,
          esLicenciaIncompleta: true,
        });
        setExito({ solicitud_id: res.solicitud_id, provisorio: true });
        return;
      }

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
        esLicenciaIncompleta: false,
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
    avisoIncompletoVigente,
    comentarioAgente,
    enviando,
    esLicenciaIncompleta,
    fechaInicioReposo,
    fechaRef,
    grupoAnclaId,
    modoCompletar,
    personaId,
    puedeEnviar,
    tipoIngresoId,
  ]);

  const reiniciar = useCallback(() => {
    setExito(null);
    setError("");
    setArchivo(null);
    setAdjuntoSubido(null);
    setComentarioAgente("");
    setEsLicenciaIncompleta(false);
  }, []);

  return {
    tipoIngresoId,
    setTipoIngresoId,
    fechaInicioReposo,
    setFechaInicioReposo,
    comentarioAgente,
    setComentarioAgente,
    esLicenciaIncompleta,
    onToggleLicenciaIncompleta,
    plazoHorasCertificado,
    modoCompletar,
    avisoIncompletoVigente,
    buscandoAvisoPendiente,
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
