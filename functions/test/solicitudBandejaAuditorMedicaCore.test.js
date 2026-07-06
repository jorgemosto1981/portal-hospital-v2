"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  itemPasaFiltroIncompleta,
  esIncompletaMedica,
  etiquetaBandejaAuditor,
  formatVencPlazoCertificadoBa,
  mapearAdjuntosBandejaAuditor,
  mapearFichaIngresoAgenteBandejaAuditor,
  FILTRO_COMPLETAS,
  FILTRO_PROVISORIAS,
  FILTRO_TODAS,
} = require("../modules/shared/solicitudBandejaAuditorMedicaCore");

const {
  resolverCie10DesdeSolBandeja,
  resolverCausalLargaIdDesdeSol,
} = require("../modules/shared/solicitudBandejaAuditorMedicaLargaMeta");

const {
  resolverRangoYmdEfectivoAvisoMedico,
} = require("../modules/shared/avisoMedicoGrillaMdcPayload");

describe("solicitudBandejaAuditorMedicaCore", () => {
  it("esIncompletaMedica lee ingreso_medico", () => {
    assert.equal(esIncompletaMedica({ ingreso_medico: { es_licencia_incompleta: true } }), true);
    assert.equal(esIncompletaMedica({ ingreso_medico: { es_licencia_incompleta: false } }), false);
  });

  it("itemPasaFiltroIncompleta separa completas y provisorias", () => {
    const completa = { es_licencia_incompleta: false };
    const prov = { es_licencia_incompleta: true };
    assert.equal(itemPasaFiltroIncompleta(completa, FILTRO_COMPLETAS), true);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_COMPLETAS), false);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_PROVISORIAS), true);
    assert.equal(itemPasaFiltroIncompleta(completa, FILTRO_PROVISORIAS), false);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_TODAS), true);
  });

  it("etiquetaBandejaAuditor formatea vencimiento Timestamp sin [object Object]", () => {
    const vencMs = Date.parse("2026-09-01T02:59:59.999Z");
    const ts = { _seconds: Math.floor(vencMs / 1000), _nanoseconds: 999000000 };
    assert.equal(formatVencPlazoCertificadoBa(ts), "31/08/2026");
    assert.equal(
      etiquetaBandejaAuditor({ vencimiento_plazo_certificado: ts }, true),
      "Provisoria — plazo certificado 31/08/2026",
    );
  });

  it("resolverCie10DesdeSolBandeja lee mapa inmutable", () => {
    const r = resolverCie10DesdeSolBandeja({
      cie10: { codigo: "B01", descripcion: "Varicela" },
    });
    assert.equal(r.codigo, "B01");
    assert.equal(r.descripcion, "Varicela");
  });

  it("resolverRangoYmdEfectivo incluye aviso con solo fechas estimadas (bandeja auditor)", () => {
    const r = resolverRangoYmdEfectivoAvisoMedico({
      fecha_inicio_reposo_estimada: "2026-08-02",
      fecha_fin_reposo_estimada: "2026-08-18",
    });
    assert.ok(r);
    assert.equal(r.fecha_desde, "2026-08-02");
    assert.equal(r.fecha_hasta, "2026-08-18");
  });

  it("resolverCausalLargaIdDesdeSol prioriza sol_", () => {
    assert.equal(
      resolverCausalLargaIdDesdeSol({ causal_larga_duracion_id: "cfg_cld_abc" }),
      "cfg_cld_abc",
    );
  });

  it("mapearAdjuntosBandejaAuditor expone storage_path para visor", () => {
    const rows = mapearAdjuntosBandejaAuditor({
      ingreso_medico: {
        adjuntos: [
          {
            storage_path: "avisos-med/2026/uid/cert.pdf",
            nombre_archivo: "cert.pdf",
            content_type: "application/pdf",
          },
        ],
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].storage_path, "avisos-med/2026/uid/cert.pdf");
    assert.equal(rows[0].es_pdf, true);
  });

  it("mapearAdjuntosBandejaAuditor ignora filas sin path", () => {
    assert.deepEqual(
      mapearAdjuntosBandejaAuditor({
        ingreso_medico: { adjuntos: [{ nombre_archivo: "x" }] },
      }),
      [],
    );
  });

  it("mapearFichaIngresoAgenteBandejaAuditor expone DTO plano de ingreso_medico", () => {
    const ficha = mapearFichaIngresoAgenteBandejaAuditor({
      fecha_inicio_reposo_estimada: "2026-08-02",
      fecha_fin_reposo_estimada: "2026-08-18",
      ingreso_medico: {
        modo: "caja_negra",
        tipo_ingreso_id: "cfg_tig_enfermedad_propia",
        comentario_agente: "Dolor abdominal desde ayer",
        declaracion_contacto: {
          telefono_celular: "1122334455",
          telefono_fijo: "1144556677",
          email: "agente@ejemplo.com",
          domicilio_declarado: "Calle Falsa 123",
          permanece_en_domicilio: true,
          usar_datos_perfil: false,
        },
        declaracion_clinica: {
          sintomas: "Fiebre y malestar",
          enfermedad: "Gastroenteritis",
          codigo_cie: "A09",
          detalle: "Sin antecedentes relevantes",
        },
      },
    });

    assert.equal(ficha.tipo_ingreso_id, "cfg_tig_enfermedad_propia");
    assert.equal(ficha.comentario_agente, "Dolor abdominal desde ayer");
    assert.equal(ficha.telefono_celular, "1122334455");
    assert.equal(ficha.telefono_fijo, "1144556677");
    assert.equal(ficha.email, "agente@ejemplo.com");
    assert.equal(ficha.domicilio_declarado, "Calle Falsa 123");
    assert.equal(ficha.permanece_en_domicilio, true);
    assert.equal(ficha.sintomas, "Fiebre y malestar");
    assert.equal(ficha.enfermedad, "Gastroenteritis");
    assert.equal(ficha.codigo_cie_clinica, "A09");
    assert.equal(ficha.detalle_clinico, "Sin antecedentes relevantes");
    assert.equal(ficha.fecha_estimada_desde, "2026-08-02");
    assert.equal(ficha.fecha_estimada_hasta, "2026-08-18");
    assert.equal(ficha.familiar_nombre, null);
  });

  it("mapearFichaIngresoAgenteBandejaAuditor incluye familiar atendido", () => {
    const ficha = mapearFichaIngresoAgenteBandejaAuditor({
      fecha_inicio_reposo_estimada: "2026-09-01",
      fecha_fin_reposo_estimada: "2026-09-03",
      ingreso_medico: {
        tipo_ingreso_id: "cfg_tig_atencion_familiar",
        declaracion_contacto: { telefono_celular: "1199887766", email: "a@b.com", domicilio_declarado: "X" },
        familiar_atendido: {
          nombre: "Ana",
          apellido: "García",
          dni: "30123456",
          parentesco_id: "cfg_par_hijo",
        },
      },
    });

    assert.equal(ficha.tipo_ingreso_id, "cfg_tig_atencion_familiar");
    assert.equal(ficha.familiar_nombre, "Ana");
    assert.equal(ficha.familiar_apellido, "García");
    assert.equal(ficha.familiar_dni, "30123456");
    assert.equal(ficha.familiar_parentesco_id, "cfg_par_hijo");
  });
});
