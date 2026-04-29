import Card from "../../components/ui/Card.jsx";
import Configuracion from "../../pages/Configuracion.jsx";
import DatosLaborales from "../../pages/DatosLaborales.jsx";
import DatosPersonales from "../../pages/DatosPersonales.jsx";
import EstadoModulos from "../../pages/EstadoModulos.jsx";
import PantallasCatalogo from "../../pages/PantallasCatalogo.jsx";
import AltaAgenteRRHH from "../rrhh/AltaAgenteRRHH.jsx";
import PortalHome from "../home/PortalHome.jsx";

/**
 * Muestra la pantalla activa según navegación unificada por módulos V2.
 * (barra inferior en móvil; sidebar a partir de `md`).
 */
export default function TabContentHost({ activeTab }) {
  if (activeTab === "inicio") {
    return <PortalHome />;
  }
  if (activeTab === "laboral") {
    return <DatosLaborales />;
  }
  if (activeTab === "rrhh") {
    return <AltaAgenteRRHH />;
  }
  if (activeTab === "configuracion") {
    return <Configuracion />;
  }
  if (activeTab === "modulos") {
    return <EstadoModulos />;
  }
  if (activeTab === "pantallas") {
    return <PantallasCatalogo />;
  }
  if (activeTab === "perfil") {
    return <DatosPersonales />;
  }
  return (
    <div className="min-h-full px-4 py-8 md:px-6 md:py-10 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        <Card className="px-5 py-7 text-center md:col-span-2 md:text-left lg:col-span-3">
          <p className="text-slate-900">Mi perfil</p>
          <p className="mt-2 text-sm text-slate-500">Pantalla en construcción (layout preparado en cuadrícula).</p>
        </Card>
      </div>
    </div>
  );
}
