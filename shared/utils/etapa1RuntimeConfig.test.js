/**
 * Unit tests — etapa1RuntimeConfig (pure).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  articuloFilaPermitidaEtapa1,
  articuloPermitidoEtapa1,
  debeFiltrarCatalogoEtapa1,
  gdtIdsDesdeHlcVigentes,
  normalizeEtapa1Runtime,
  personaPermitidaCircuitoEtapa1,
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_LAO_ID,
} from "../utils/etapa1RuntimeConfig.js";

describe("etapa1RuntimeConfig", () => {
  it("defaults: piloto off, superficies cerradas, sin forzar catálogo", () => {
    const cfg = normalizeEtapa1Runtime(null);
    assert.equal(cfg.etapa1_habilitada, false);
    assert.equal(cfg.forzar_catalogo_etapa1, false);
    assert.equal(cfg.jefe_gso_habilitado, false);
    assert.equal(cfg.lao_habilitada, false);
    assert.equal(debeFiltrarCatalogoEtapa1(cfg), false);
    assert.equal(articuloPermitidoEtapa1(cfg, "art_cualquiera"), true);
  });

  it("con etapa1_habilitada filtra catálogo; circuito por GDT activo (no allowlist)", () => {
    const cfg = normalizeEtapa1Runtime({
      etapa1_habilitada: true,
      gdt_ids_etapa1: ["gdt_legacy_ignorado"],
      articulo_ids_etapa1: [ARTICULO_64A_ETAPA1_ID],
    });
    assert.equal(debeFiltrarCatalogoEtapa1(cfg), true);
    assert.equal(articuloPermitidoEtapa1(cfg, ARTICULO_64A_ETAPA1_ID), true);
    assert.equal(articuloPermitidoEtapa1(cfg, "art_otro"), false);
    assert.equal(articuloPermitidoEtapa1(cfg, ARTICULO_LAO_ID), false);
    assert.equal(
      personaPermitidaCircuitoEtapa1(cfg, "per_a", [{ grupo_de_trabajo_id: "gdt_nuevo" }], {
        gdtIdsActivos: new Set(["gdt_otro"]),
      }),
      false,
    );
    assert.equal(
      personaPermitidaCircuitoEtapa1(cfg, "per_a", [{ grupo_de_trabajo_id: "gdt_nuevo" }], {
        gdtIdsActivos: ["gdt_nuevo"],
      }),
      true,
    );
    // Allowlist legacy no habilita por sí sola
    assert.equal(
      personaPermitidaCircuitoEtapa1(cfg, "per_a", [{ grupo_de_trabajo_id: "gdt_legacy_ignorado" }], {
        gdtIdsActivos: new Set(["gdt_nuevo"]),
      }),
      false,
    );
  });

  it("sin gdtIdsActivos (o vacío) deniega con piloto on", () => {
    const cfg = normalizeEtapa1Runtime({ etapa1_habilitada: true });
    assert.equal(
      personaPermitidaCircuitoEtapa1(cfg, "per_a", [{ grupo_de_trabajo_id: "gdt_x" }]),
      false,
    );
    assert.equal(
      personaPermitidaCircuitoEtapa1(cfg, "per_a", [{ grupo_de_trabajo_id: "gdt_x" }], {
        gdtIdsActivos: [],
      }),
      false,
    );
  });

  it("gdtIdsDesdeHlcVigentes dedupe y filtra ids inválidos", () => {
    assert.deepEqual(
      gdtIdsDesdeHlcVigentes([
        { grupo_de_trabajo_id: "gdt_a" },
        { grupo_de_trabajo_id: "gdt_a" },
        { grupo_de_trabajo_id: "nope" },
        {},
      ]),
      ["gdt_a"],
    );
  });

  it("bypass ops y RRHH saltan chequeo de GDT activo", () => {
    const cfg = normalizeEtapa1Runtime({
      etapa1_habilitada: true,
      persona_ids_ops_bypass: ["per_rrhh"],
    });
    assert.equal(personaPermitidaCircuitoEtapa1(cfg, "per_rrhh", []), true);
    assert.equal(personaPermitidaCircuitoEtapa1(cfg, "per_x", [], { esRrhh: true }), true);
  });

  it("oculta filas licencia médica si flag off", () => {
    const cfg = normalizeEtapa1Runtime({
      forzar_catalogo_etapa1: true,
      articulo_ids_etapa1: ["art_med"],
      licencias_medicas_habilitadas: false,
    });
    assert.equal(
      articuloFilaPermitidaEtapa1(cfg, {
        articulo_id: "art_med",
        modo_licencia_medica_id: "cfg_mlm_corta",
      }),
      false,
    );
  });
});
