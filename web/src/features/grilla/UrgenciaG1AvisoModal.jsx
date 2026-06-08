/** Aviso G1 — plan habilitado, override solo urgencia operativa (US-13). */
export default function UrgenciaG1AvisoModal({ visible = false }) {
  if (!visible) return null;
  return (
    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      Plan del mes <strong>habilitado</strong>: registrá una <strong>urgencia operativa</strong> y justificá el
      motivo. Cambios de diseño del mes van por revisión del plan con RRHH.
    </p>
  );
}
