/**
 * Pruebas rápidas de validaciones estrictas ABM (personales/laborales).
 *
 * Requisitos:
 * - Emulador de functions corriendo en 127.0.0.1:5002
 * - Proyecto emulado: portal-hospital-v2
 * - OPEN_ACCESS_TEMP=true
 *
 * Ejecutar:
 *   node tests/abm-validaciones-estrictas.mjs
 */

const BASE = "http://127.0.0.1:5002/portal-hospital-v2/southamerica-east1";

async function callCallable(name, data) {
  const res = await fetch(`${BASE}/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
  const json = await res.json().catch(() => ({}));
  return { okHttp: res.ok, status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function getFirstId(collectionName) {
  const r = await callCallable("listarColeccionPublicaTemporal", { collectionName, limit: 5 });
  assert(r.okHttp, `No se pudo listar ${collectionName} (HTTP ${r.status})`);
  const items = Array.isArray(r.json?.result?.items) ? r.json.result.items : [];
  assert(items.length > 0, `No hay datos en ${collectionName} para test.`);
  const id = String(items[0].id || "");
  assert(id, `No se encontró id válido en ${collectionName}.`);
  return id;
}

async function main() {
  const dayMs = 24 * 60 * 60 * 1000;
  const randomOffsetDays = 30 + Math.floor(Math.random() * 3650);
  const base = Date.now() + randomOffsetDays * dayMs;
  const fechaA = new Date(base + dayMs).toISOString().slice(0, 10);
  const fechaB = new Date(base + dayMs * 2).toISOString().slice(0, 10);

  console.log("== Preparando ids de catálogos ==");
  const personaId = await getFirstId("personas");
  const localidadId = await getFirstId("cfg_localidad");
  const sexoGeneroId = await getFirstId("cfg_sexo_genero");
  const estadoCivilId = await getFirstId("cfg_estado_civil");
  const nacionalidadId = await getFirstId("cfg_nacionalidad");
  const provinciaId = await getFirstId("cfg_provincia");
  const paisId = await getFirstId("cfg_pais");
  const efectorDesignacionId = await getFirstId("cfg_efectores");
  const efectorCumplimientoId = await getFirstId("cfg_efectores");
  const estadoAsignacionId = await getFirstId("cfg_estado_asignacion_laboral");
  const escalafonId = await getFirstId("cfg_escalafon");
  const agrupamientoId = await getFirstId("cfg_agrupamiento");
  const categoriaId = await getFirstId("cfg_categorias");
  const cargoFuncionalId = await getFirstId("cfg_cargo_funcional");
  const tipoVinculoId = await getFirstId("cfg_tipo_vinculo_laboral");
  const modalidadJornadaId = await getFirstId("cfg_modalidad_jornada");
  const tipoActoId = await getFirstId("cfg_tipo_acto_designacion");
  const grupoTrabajoId = await getFirstId("grupos_de_trabajo");
  const rolId = await getFirstId("cfg_rol");
  const funcionRealId = await getFirstId("cfg_cargo_funcional");
  const diaSemanaId = await getFirstId("cfg_dia_semana");
  const nivelEstudiosId = await getFirstId("cfg_nivel_estudios");
  const parentescoId = await getFirstId("cfg_parentesco");
  void nivelEstudiosId;

  const dniPersonaTest = String(30000000 + Math.floor(Math.random() * 50000000));
  console.log("== Preparando persona dedicada para pruebas laborales ==");
  const rPersonaOk = await callCallable("guardarRegistroPersonalTemporal", {
    collectionName: "personas",
    datos: {
      dni: dniPersonaTest,
      nombre: "TEST",
      apellido: "LABORAL",
      fecha_nacimiento: "1990-01-01",
      lugar_nacimiento_id: localidadId,
      sexo_genero_id: sexoGeneroId,
      estado_civil_id: estadoCivilId,
      nacionalidad_id: nacionalidadId,
      contacto: {
        telefono_celular: "1144445555",
        email_personal: `test-${dniPersonaTest}@example.com`,
      },
      domicilio: {
        calle: "SIEMPREVIVA",
        numero: "742",
        provincia_id: provinciaId,
        pais_id: paisId,
        localidad_id: localidadId,
        codigo_postal: "1000",
      },
    },
  });
  assert(rPersonaOk.okHttp, `No se pudo crear persona de pruebas: ${JSON.stringify(rPersonaOk.json)}`);
  const personaLaboralId = String(rPersonaOk.json?.result?.id || "");
  assert(personaLaboralId, "No se obtuvo persona_id de pruebas laborales.");

  console.log("== Caso 1: personas inválido (faltan obligatorios) ==");
  {
    const r = await callCallable("guardarRegistroPersonalTemporal", {
      collectionName: "personas",
      datos: { dni: "12345678", nombre: "A", apellido: "B" },
    });
    const msg = String(r.json?.error?.message || "");
    assert(!r.okHttp, "Se esperaba error en personas incompleta.");
    assert(msg.includes("[VAL-PER-005]"), `Error inesperado: ${msg}`);
  }

  console.log("== Caso 2: formación inválida (sin nivel_estudios_id) ==");
  {
    const r = await callCallable("guardarRegistroPersonalTemporal", {
      collectionName: "formacion_agente",
      datos: { persona_id: personaId },
    });
    const msg = String(r.json?.error?.message || "");
    assert(!r.okHttp, "Se esperaba error en formacion sin nivel_estudios_id.");
    assert(msg.includes("[VAL-FOR-002]"), `Error inesperado: ${msg}`);
  }

  console.log("== Caso 3: DDJJ inválida (familiar incompleto) ==");
  {
    const r = await callCallable("guardarRegistroPersonalTemporal", {
      collectionName: "declaraciones_grupo_familiar",
      datos: {
        titular_persona_id: personaId,
        familiares: [{ parentesco_id: parentescoId, nombre: "X", apellido: "Y" }],
      },
    });
    const msg = String(r.json?.error?.message || "");
    assert(!r.okHttp, "Se esperaba error en DDJJ incompleta.");
    assert(msg.includes("[VAL-DDJJ-003]"), `Error inesperado: ${msg}`);
  }

  console.log("== Caso 4: HLc inválido (faltan obligatorios) ==");
  {
    const r = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_cargos",
      datos: {
        persona_id: personaLaboralId,
        efector_designacion_id: efectorDesignacionId,
        efector_cumplimiento_id: efectorCumplimientoId,
        fecha_desde: fechaA,
        referencias_normativa_designacion: [
          { tipo_acto_id: tipoActoId, numero: "1", fecha: fechaA },
        ],
      },
    });
    const msg = String(r.json?.error?.message || "");
    assert(!r.okHttp, "Se esperaba error en HLc incompleto.");
    assert(msg.includes("[VAL-HLC-002]"), `Error inesperado: ${msg}`);
  }

  console.log("== Caso 5: HLc válido mínimo estricto ==");
  let cargoId = "";
  {
    const r = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_cargos",
      datos: {
        persona_id: personaLaboralId,
        grupo_de_trabajo_id: grupoTrabajoId,
        efector_designacion_id: efectorDesignacionId,
        efector_cumplimiento_id: efectorCumplimientoId,
        estado_asignacion_id: estadoAsignacionId,
        escalafon_id: escalafonId,
        agrupamiento_id: agrupamientoId,
        categoria_id: categoriaId,
        cargo_funcional_id: cargoFuncionalId,
        tipo_vinculo_id: tipoVinculoId,
        modalidad_jornada_id: modalidadJornadaId,
        carga_horaria_total: 24,
        fecha_desde: fechaA,
        referencias_normativa_designacion: [
          { tipo_acto_id: tipoActoId, numero: "123", fecha: fechaA },
        ],
      },
    });
    assert(
      r.okHttp,
      `Se esperaba HLc válido. HTTP ${r.status}. Detalle: ${JSON.stringify(r.json)}`,
    );
    cargoId = String(r.json?.result?.id || "");
    assert(cargoId, "No devolvió id de HLc.");
  }

  console.log("== Caso 6: HLg inválido (sin carga_por_dia_semana) ==");
  {
    const rHld = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_datos",
      datos: {
        persona_id: personaLaboralId,
        cargo_id: cargoId,
        rol_id: rolId,
        funcion_real_id: funcionRealId,
        nivel_jerarquico: 10,
        fecha_inicio: fechaB,
      },
    });
    assert(rHld.okHttp, `No se pudo crear HLd para test HLG inválido. HTTP ${rHld.status}`);
    const datoLaboralId = String(rHld.json?.result?.id || "");
    const rHlg = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_grupos",
      datos: {
        persona_id: personaLaboralId,
        dato_laboral_id: datoLaboralId,
        grupo_de_trabajo_id: grupoTrabajoId,
        nivel_jerarquico: 10,
        fecha_inicio: fechaB,
        carga_por_dia_semana: [],
      },
    });
    const msg = String(rHlg.json?.error?.message || "");
    assert(!rHlg.okHttp, "Se esperaba error HLG sin carga.");
    assert(msg.includes("[VAL-HLG-013]"), `Error inesperado: ${msg}`);
  }

  console.log("== Caso 7: HLg válido mínimo estricto ==");
  {
    const rHld = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_datos",
      datos: {
        persona_id: personaLaboralId,
        cargo_id: cargoId,
        rol_id: rolId,
        funcion_real_id: funcionRealId,
        nivel_jerarquico: 20,
        fecha_inicio: fechaB,
      },
    });
    assert(rHld.okHttp, `No se pudo crear HLd válido para HLG válido. HTTP ${rHld.status}`);
    const datoLaboralId = String(rHld.json?.result?.id || "");
    const rHlg = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_grupos",
      datos: {
        persona_id: personaLaboralId,
        dato_laboral_id: datoLaboralId,
        grupo_de_trabajo_id: grupoTrabajoId,
        rol_id: rolId,
        funcion_real_id: funcionRealId,
        nivel_jerarquico: 20,
        fecha_inicio: fechaB,
        carga_por_dia_semana: [{ dia_semana_id: diaSemanaId, horas: 8 }],
      },
    });
    assert(
      rHlg.okHttp,
      `Se esperaba HLG válido. HTTP ${rHlg.status}. Detalle: ${JSON.stringify(rHlg.json)}`,
    );
  }

  console.log("== Caso 8: HLc paralelo permitido (solape con warning) ==");
  {
    const r = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_cargos",
      datos: {
        persona_id: personaLaboralId,
        grupo_de_trabajo_id: grupoTrabajoId,
        efector_designacion_id: efectorDesignacionId,
        efector_cumplimiento_id: efectorCumplimientoId,
        estado_asignacion_id: estadoAsignacionId,
        escalafon_id: escalafonId,
        agrupamiento_id: agrupamientoId,
        categoria_id: categoriaId,
        cargo_funcional_id: cargoFuncionalId,
        tipo_vinculo_id: tipoVinculoId,
        modalidad_jornada_id: modalidadJornadaId,
        carga_horaria_total: 12,
        fecha_desde: fechaA,
        referencias_normativa_designacion: [
          { tipo_acto_id: tipoActoId, numero: "124", fecha: fechaA },
        ],
      },
    });
    assert(
      r.okHttp,
      `Se esperaba HLc paralelo permitido. HTTP ${r.status}. Detalle: ${JSON.stringify(r.json)}`,
    );
  }

  console.log("== Caso 9: HLg paralelo mismo grupo permitido (solape con warning) ==");
  {
    const rHld = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_datos",
      datos: {
        persona_id: personaLaboralId,
        cargo_id: cargoId,
        rol_id: rolId,
        funcion_real_id: funcionRealId,
        nivel_jerarquico: 30,
        fecha_inicio: fechaB,
      },
    });
    assert(rHld.okHttp, `No se pudo crear HLd para test HLG paralelo. HTTP ${rHld.status}`);
    const datoLaboralId = String(rHld.json?.result?.id || "");
    const rHlg = await callCallable("guardarRegistroLaboralTemporal", {
      collectionName: "historial_laboral_grupos",
      datos: {
        persona_id: personaLaboralId,
        dato_laboral_id: datoLaboralId,
        grupo_de_trabajo_id: grupoTrabajoId,
        rol_id: rolId,
        funcion_real_id: funcionRealId,
        nivel_jerarquico: 30,
        fecha_inicio: fechaB,
        carga_por_dia_semana: [{ dia_semana_id: diaSemanaId, horas: 4 }],
      },
    });
    assert(
      rHlg.okHttp,
      `Se esperaba HLG paralelo permitido. HTTP ${rHlg.status}. Detalle: ${JSON.stringify(rHlg.json)}`,
    );
  }

  console.log("OK: validaciones estrictas ABM verificadas.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exitCode = 1;
});

