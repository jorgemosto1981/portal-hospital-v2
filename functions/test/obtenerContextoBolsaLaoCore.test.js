"use strict";

/**
 * node --test functions/test/obtenerContextoBolsaLaoCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildResumenDisponibilidadLao,
  pickVersionComputoForWizard,
} = require("../modules/shared/obtenerContextoBolsaLaoCore");

const ART = "art_01JTEST00000000000000001";

describe("obtenerContextoBolsaLaoCore", () => {
  it("sugiere FIFO y marca bolsa posterior como requiere_fifo_antes", () => {
    const saldoDocsData = [
      {
        bolsas: {
          bol_2024: {
            bolsa_id: `bol_${ART}_2024`,
            articulo_id: ART,
            anio_origen: 2024,
            disponible: 5,
            consumido: 0,
            cantidad_inicial: 5,
            es_arrastre: true,
          },
          bol_2026: {
            bolsa_id: `bol_${ART}_2026`,
            articulo_id: ART,
            anio_origen: 2026,
            disponible: 10,
            consumido: 0,
            cantidad_inicial: 10,
            es_arrastre: false,
          },
        },
      },
    ];

    const versionPick = {
      versionId: "ver_01JTEST00000000000000002",
      versionData: {
        bloque_identidad_naturaleza: {
          es_lao_anual: true,
          visualizacion: { titulo_agente: "LAO" },
        },
        bloque_topes_plazos_computo: { correspondencia_anio: 2026 },
      },
      correspondencia_anio: 2026,
    };

    const r = buildResumenDisponibilidadLao({
      personaId: "per_01JTEST00000000000000003",
      articuloId: ART,
      articuloMeta: { nombre: "Licencia anual", codigo: "LAO" },
      saldoDocsData,
      anioOrigenBolsaInput: 2026,
      versionPick,
    });

    assert.equal(r.anio_origen_bolsa_sugerido, 2024);
    assert.equal(r.anio_origen_bolsa_activo, 2026);
    assert.equal(r.bolsa_seleccionada.disponible, 10);
    assert.equal(r.fifo.debe_respetar_fifo, true);
    assert.ok(r.mensajes.some((m) => m.includes("FIFO")));
    const row2026 = r.bolsas_resumen.find((b) => b.anio_origen === 2026);
    assert.equal(row2026.requiere_fifo_antes, true);
  });

  it("sin input usa año sugerido para bolsa activa", () => {
    const saldoDocsData = [
      {
        bolsas: {
          bol_2025: {
            bolsa_id: `bol_${ART}_2025`,
            articulo_id: ART,
            anio_origen: 2025,
            disponible: 3,
            consumido: 0,
            cantidad_inicial: 3,
          },
        },
      },
    ];
    const r = buildResumenDisponibilidadLao({
      personaId: "per_x",
      articuloId: ART,
      saldoDocsData,
      versionPick: {
        versionId: "ver_x",
        versionData: {
          bloque_topes_plazos_computo: { correspondencia_anio: 2025 },
        },
        correspondencia_anio: 2025,
      },
    });
    assert.equal(r.anio_origen_bolsa_activo, 2025);
    assert.equal(r.bolsa_seleccionada.anio_origen, 2025);
  });

  it("expone version_computo con bloque_topes_plazos_computo para el wizard", () => {
    const topes = {
      correspondencia_anio: 2026,
      regla_computo_dias_id: "cfg_rcd_habiles_simple",
      tope_dias_por_evento: 30,
    };
    const versionPick = {
      versionId: "ver_01JTEST00000000000000002",
      versionData: {
        bloque_topes_plazos_computo: topes,
      },
      correspondencia_anio: 2026,
    };
    const slice = pickVersionComputoForWizard(versionPick.versionData);
    assert.deepEqual(slice, { bloque_topes_plazos_computo: topes });

    const r = buildResumenDisponibilidadLao({
      personaId: "per_x",
      articuloId: ART,
      saldoDocsData: [
        {
          bolsas: {
            bol_2026: {
              bolsa_id: `bol_${ART}_2026`,
              articulo_id: ART,
              anio_origen: 2026,
              disponible: 5,
              consumido: 0,
              cantidad_inicial: 5,
            },
          },
        },
      ],
      versionPick,
    });
    assert.equal(r.version_aplicada_id, versionPick.versionId);
    assert.deepEqual(r.version_computo, slice);
  });
});
