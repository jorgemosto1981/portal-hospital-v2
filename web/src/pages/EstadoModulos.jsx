import Card from "../components/ui/Card.jsx";
import { ESTADOS_MODULO, MODULOS_V2_ESTADO } from "../constants/modulosEstado.js";

const LABEL_ESTADO = {
  [ESTADOS_MODULO.ACTIVO]: "Activo",
  [ESTADOS_MODULO.MVP]: "MVP",
  [ESTADOS_MODULO.BORRADOR]: "Borrador",
  [ESTADOS_MODULO.LEGACY]: "Legacy",
};

const CLASE_ESTADO = {
  [ESTADOS_MODULO.ACTIVO]: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  [ESTADOS_MODULO.MVP]: "bg-blue-50 text-blue-700 ring-blue-200",
  [ESTADOS_MODULO.BORRADOR]: "bg-amber-50 text-amber-700 ring-amber-200",
  [ESTADOS_MODULO.LEGACY]: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function EstadoModulos() {
  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Estado de módulos V2</h1>
          <p className="mt-2 text-sm text-slate-600">
            Estado explícito para navegación y alcance funcional de cada módulo del portal.
          </p>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {MODULOS_V2_ESTADO.map((row) => (
                <tr key={row.modulo}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.modulo}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${CLASE_ESTADO[row.estado]}`}
                    >
                      {LABEL_ESTADO[row.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

