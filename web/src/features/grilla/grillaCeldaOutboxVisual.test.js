import { describe, expect, it } from "vitest";

import {
  celdaVisProyectadaOutboxPendiente,
  visualCeldaOutboxPendiente,
} from "./grillaCeldaOutboxVisual.js";

const PID = "per_a";
const F_ORIG = "2026-06-11";
const F_DEST = "2026-06-12";

describe("celdaVisProyectadaOutboxPendiente", () => {
  it("origen reemplazo queda franco sin presentacion ausente", () => {
    const cell = {
      rda_turno_id: "N",
      presentacion_compuesto: {
        filas: [{ segmento_id: "N", estado_tramo: "ausente", badge_label: "AUSENTE" }],
      },
      validacion_fichada_dia: { estado_semaforo: "ROJO" },
    };
    const ops = [
      {
        tipo: "reemplazo",
        personaId: PID,
        fechaOrigenYmd: F_ORIG,
        fechaDestinoYmd: F_DEST,
        segmentosTrasladar: ["N"],
        turnoIdDestino: "T",
      },
    ];
    const next = celdaVisProyectadaOutboxPendiente({
      cell,
      ops,
      personaId: PID,
      fechaYmd: F_ORIG,
    });
    expect(next.es_franco).toBe(true);
    expect(next.presentacion_compuesto?.filas).toEqual([]);
    expect(next.validacion_fichada_dia).toBeUndefined();
    expect(next.analitica_cumplimiento).toBeUndefined();
  });

  it("visual reemplazo usa resultado final sin diff", () => {
    const vis = visualCeldaOutboxPendiente({
      cell: { rda_turno_id: "N" },
      ops: [
        {
          tipo: "reemplazo",
          personaId: PID,
          fechaOrigenYmd: F_ORIG,
          fechaDestinoYmd: F_DEST,
          segmentosTrasladar: ["N"],
          turnoIdDestino: "T",
        },
      ],
      personaId: PID,
      fechaYmd: F_ORIG,
    });
    expect(vis?.mostrarResultadoFinal).toBe(true);
    expect(vis?.diffOut).toBe("");
    expect(vis?.diffIn).toBe("");
    expect(vis?.turnoText).toBe("F");
  });
});
