import { Navigate } from "react-router-dom";

import { useEtapa1RuntimeOptional } from "../etapa1/Etapa1RuntimeProvider.jsx";

/**
 * Bloquea rutas LAO / médico / GSO-jefe según cfg_etapa1/runtime.
 * @param {{ flag: "lao"|"medico"|"gso_jefe"; children: import("react").ReactNode }} props
 */
export default function Etapa1SurfaceGuard({ flag, children }) {
  const etapa1 = useEtapa1RuntimeOptional();
  const allowed =
    flag === "lao"
      ? etapa1?.laoHabilitada === true
      : flag === "medico"
        ? etapa1?.licenciasMedicasHabilitadas === true
        : flag === "gso_jefe"
          ? etapa1?.jefeGsoHabilitado === true
          : true;

  if (!allowed) {
    return <Navigate to="/portal/home" replace />;
  }
  return children;
}
