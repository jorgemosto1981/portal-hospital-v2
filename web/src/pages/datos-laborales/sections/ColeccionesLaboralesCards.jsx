import Card from "../../../components/ui/Card.jsx";
import { DATOS_LABORALES_COLECCIONES } from "../../../constants/datosLaboralesSchema.js";
import { formatValue } from "../utils.js";

function BadgeCampo({ campo }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      {campo}
    </span>
  );
}

export default function ColeccionesLaboralesCards({ loadingByCollection, errorByCollection, rowsByCollection }) {
  return (
    <>
      {DATOS_LABORALES_COLECCIONES.map((item) => (
        <Card key={item.id} className="px-4 py-4 md:px-5">
          <div className="flex flex-col gap-2">
            <p className="text-base font-semibold text-slate-900">{item.titulo}</p>
            <p className="text-sm text-slate-600">{item.descripcion}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {item.campos.map((campo) => (
                <BadgeCampo key={campo} campo={campo} />
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Coleccion: {item.collectionName}
              </p>
              {loadingByCollection[item.collectionName] ? (
                <p className="mt-2 text-sm text-slate-600">Cargando registros...</p>
              ) : errorByCollection[item.collectionName] ? (
                <p className="mt-2 text-sm text-rose-700">
                  Error al leer: {errorByCollection[item.collectionName]}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    Registros encontrados:{" "}
                    <span className="font-semibold">
                      {(rowsByCollection[item.collectionName] || []).length}
                    </span>
                  </p>
                  {(rowsByCollection[item.collectionName] || []).length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {(rowsByCollection[item.collectionName] || []).slice(0, 3).map((row, idx) => (
                        <div
                          key={row.id || `${item.collectionName}-row-${idx}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                        >
                          <p className="font-mono text-[11px] text-slate-500">{row.id}</p>
                          <p className="mt-1">
                            {item.campos
                              .slice(1, 4)
                              .map((campo) => `${campo}: ${formatValue(row[campo])}`)
                              .join(" | ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Sin documentos cargados aun.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}
