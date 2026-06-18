import { memo } from "react";



import {
  badgesDisciplinaDesdeFilaPresentacion,
  claseVisualPisoCompuesto,
  copyFichadaOperativaPiso,
  esPisoPresentacionAusente,
  marcasCompactasDesdeFila,
  textoMarcasPisoCelda,
  titleFilaPresentacionCompuesto,
  titlePisoCompuestoCelda,
} from "./grillaPresentacionCompuestoUi.js";



/**

 * Matriz N pisos por segmento — lectura de `presentacion_compuesto.filas[]` o turno simple.

 * Celda/modal: M/T/N + fichada real + badge. Sin teoría visible (plan en title extendido).

 *

 * @param {{

 *   filas: Array<Record<string, unknown>>;

 *   mostrarBadges?: boolean;

 *   className?: string;

 *   tamano?: "celda" | "modal";

 *   pisoGrande?: boolean;

 * }} props

 */

function GrillaPresentacionCompuestoFilas({

  filas,

  mostrarBadges = true,

  className = "",

  tamano = "celda",

  pisoGrande = false,

}) {

  if (!Array.isArray(filas) || filas.length < 1) return null;



  const esModal = tamano === "modal";

  const textoPiso = pisoGrande ? "text-[10px]" : "text-[9px]";



  if (esModal) {

    return (

      <div className={["w-full space-y-2", className].filter(Boolean).join(" ")}>

        {filas.map((fila, i) => {

          const key = String(fila.segmento_id || fila.orden || i);

          const seg = String(fila.segmento_id || "").trim();

          const vis = claseVisualPisoCompuesto(fila);

          const title = titleFilaPresentacionCompuesto(fila);

          const marcas = marcasCompactasDesdeFila(fila);

          const lineaOperativa = copyFichadaOperativaPiso(fila, filas.length);



          return (

            <div

              key={key}

              className={`rounded-md border border-slate-200 px-2 py-1.5 ${vis.piso}`}

              title={title || undefined}

            >

              {seg ? (

                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">

                  Tramo {seg}

                </p>

              ) : null}

              <div className="mt-1 font-mono text-xs font-semibold">

                {marcas.length >= 2 ? (

                  <span className={`flex flex-col gap-0.5 ${vis.dato}`}>

                    {marcas.map((m) => (

                      <span key={m} className="tabular-nums">

                        {m}

                      </span>

                    ))}

                  </span>

                ) : (

                  <span className={vis.dato}>{lineaOperativa || "—"}</span>

                )}

              </div>

            </div>

          );

        })}

      </div>

    );

  }



  return (

    <span

      className={[

        "flex h-full w-full flex-col overflow-visible rounded-md leading-none",

        pisoGrande ? "min-h-[5.5rem]" : "min-h-[3.25rem]",

        className,

      ]

        .filter(Boolean)

        .join(" ")}

    >

      {filas.map((fila, i) => {
        const key = String(fila.segmento_id || fila.orden || i);
        const seg = String(fila.segmento_id || "").trim() || "·";
        const badges = badgesDisciplinaDesdeFilaPresentacion(fila);
        const vis = claseVisualPisoCompuesto(fila);
        const title = titlePisoCompuestoCelda(fila, filas.length);
        const esAusente = esPisoPresentacionAusente(fila);
        const marcas = marcasCompactasDesdeFila(fila);
        const textoMarcas = textoMarcasPisoCelda(fila);

        return (
          <span
            key={key}
            className={[
              "flex min-h-0 w-full flex-1 items-center gap-1 border-b border-slate-900/10 px-1.5 py-0.5 last:border-b-0",
              textoPiso,
              vis.piso,
            ].join(" ")}
            title={title || undefined}
          >
            <span className={`w-4 shrink-0 text-left font-semibold ${vis.seg}`}>{seg}</span>
            {esAusente ? (
              <span className={`min-w-0 flex-1 font-bold uppercase tracking-tight ${vis.badge}`}>
                {textoMarcas}
              </span>
            ) : (
              <>
                <span className={`min-w-0 flex-1 text-center tabular-nums leading-tight ${vis.dato}`}>
                  {marcas.length >= 2 ? (
                    <span className="flex flex-col items-center gap-px">
                      {marcas.map((m) => (
                        <span key={m} className="leading-none">
                          {m}
                        </span>
                      ))}
                    </span>
                  ) : (
                    textoMarcas
                  )}
                </span>
                {mostrarBadges && badges.length > 0 ? (
                  <span className={`flex max-w-[52%] shrink-0 flex-col items-end gap-px text-right text-[9px] font-semibold ${vis.badge}`}>
                    {badges.map((b) => (
                      <span key={`${b.tipo}-${b.label}`} className="truncate leading-tight">
                        {b.label}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="w-0 shrink-0" aria-hidden />
                )}
              </>
            )}
          </span>
        );
      })}

    </span>

  );

}



export default memo(GrillaPresentacionCompuestoFilas);


