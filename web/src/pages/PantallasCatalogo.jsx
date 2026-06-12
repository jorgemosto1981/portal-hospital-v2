import { Link } from "react-router-dom";
import Card from "../components/ui/Card.jsx";
import { PANTALLAS_CATALOGO, pathCatalogoRrhh } from "../constants/pantallasCatalogo.js";

export default function PantallasCatalogo() {
  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Menú de pantallas</h1>
          <p className="mt-2 text-sm text-slate-600">
            Mapa de rutas del código web. Cada tarjeta abre la <strong>ruta real</strong> de la pantalla (salvo el demo de
            legajo por id, que entra por alta RRHH).
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Referencia de estado: <strong>activo</strong> = ruta principal; <strong>activo-soporte</strong> =
            contingencia/recuperación.
          </p>
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PANTALLAS_CATALOGO.map((p) => {
            const destino = pathCatalogoRrhh(p);
            const esRama = destino !== p.path;
            return (
              <Card key={p.id} className="px-4 py-4">
                <p className="text-base font-semibold text-slate-900">{p.titulo}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{p.fuente}</p>
                <p className="mt-1 text-xs text-slate-500">Estado: {p.estado}</p>
                {esRama ? (
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Ruta pantalla: {p.path}</p>
                ) : null}
                <Link
                  to={destino}
                  className="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Abrir {destino}
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

