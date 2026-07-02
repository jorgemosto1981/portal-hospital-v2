/**
 * node --test functions/test/licenciaMedicaEpisodioCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  TOPE_EPISODIO_DIAS_CONTINUOS,
  proyectarEpisodioContinuo,
  buildLicenciaMedicaPreviewLarga,
  tieneDictamenFavorableLarga,
} = require("../modules/shared/licenciaMedicaEpisodioCore");

describe("licenciaMedicaEpisodioCore", () => {
  it("proyecta episodio dentro del tope", () => {
    const r = proyectarEpisodioContinuo({ consumido_previo_episodio: 100, dias_solicitados: 30 });
    assert.equal(r.total_episodio_post, 130);
    assert.equal(r.excede_tope_continuo, false);
    assert.equal(r.dias_disponibles_tope, TOPE_EPISODIO_DIAS_CONTINUOS - 100);
  });

  it("detecta exceso de tope continuo", () => {
    const r = proyectarEpisodioContinuo({
      consumido_previo_episodio: 700,
      dias_solicitados: 40,
    });
    assert.equal(r.excede_tope_continuo, true);
  });

  it("preview larga advierte dictamen pendiente", () => {
    const p = buildLicenciaMedicaPreviewLarga({
      consumido_previo_episodio: 0,
      dias_solicitados: 20,
      dictamen_favorable: false,
    });
    assert.match(p.mensaje_ui, /dictamen/i);
    assert.equal(p.tramos_haberes, null);
  });

  it("tieneDictamenFavorableLarga lee subdocumento", () => {
    assert.equal(tieneDictamenFavorableLarga({ dictamen: { favorable: true } }), true);
    assert.equal(tieneDictamenFavorableLarga({}, { dictamen_favorable: true }), true);
    assert.equal(tieneDictamenFavorableLarga({}), false);
  });

  it("calcularConsumoPrevioEpisodioContinuo enlaza períodos contiguos", () => {
    const { calcularConsumoPrevioEpisodioContinuo } = require("../modules/shared/licenciaMedicaEpisodioCore");
    const consumo = calcularConsumoPrevioEpisodioContinuo(
      [{ fecha_desde: "2026-01-01", fecha_hasta: "2026-06-30" }],
      "2026-07-01",
    );
    assert.equal(consumo, 181);
    assert.equal(
      calcularConsumoPrevioEpisodioContinuo(
        [{ fecha_desde: "2026-01-01", fecha_hasta: "2026-05-01" }],
        "2026-07-01",
      ),
      0,
    );
  });
});
