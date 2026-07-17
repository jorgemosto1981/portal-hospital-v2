import { useCallback } from "react";

import RechazoAcuseModal from "./RechazoAcuseModal.jsx";
import { useRechazosPendientesAcuse } from "./useRechazosPendientesAcuse.js";

/**
 * Gate bloqueante post-login: cola de novedades sin acuse del titular
 * (rechazo / observación / autorización Art. 64 sin goce).
 * @param {{ personaId: string }} props
 */
export default function RechazoAcuseGate({ personaId }) {
  const { actual, ready, restantes, marcarAcusadoLocal } = useRechazosPendientesAcuse(personaId);

  const onAcusado = useCallback(
    (solId) => {
      marcarAcusadoLocal(solId);
    },
    [marcarAcusadoLocal],
  );

  if (!ready || !actual) return null;

  return (
    <RechazoAcuseModal
      key={String(actual.id)}
      sol={actual}
      restantes={restantes}
      onAcusado={onAcusado}
    />
  );
}
