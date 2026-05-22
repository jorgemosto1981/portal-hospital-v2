"use strict";

const { parseYmd } = require("../shared/laoPreviewMotor");
const { PATRON_SALDO_B } = require("../shared/resolvePatronSaldo");
const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
  mensajeParaCodigo,
  CODIGO_ELEG_SIN_HLC,
  CODIGO_CIRCUITO_ROL,
  CODIGO_FECHA_RANGO,
} = require("../shared/solicitudElegibilidadLaboral");
const {
  loadHlcArray,
  patronFromVersion,
} = require("../shared/solicitudPatronBAltaMotor");
const { resolverGrupoTrabajoIdAnclaParaSolicitud } = require("../shared/solicitudGrupoTrabajoAncla");
const {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronB,
} = require("../shared/patronBFechasSolicitud");
const { evaluarGrillaTurnoEntorno } = require("./grillaTurnoEntornoGate");
const { tokenHasRrhhLaborAccess } = require("../shared/laborProfile");
const { validarFechasArticuloEnMotor } = require("../shared/validarFechasArticuloRuntime");

const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

/**
 * @param {Partial<Record<string, boolean | null>>} partial
 */
function buildChecks(partial = {}) {
  return {
    hlc_vigente: partial.hlc_vigente === true,
    elegibilidad_articulo: partial.elegibilidad_articulo === true,
    circuito_ingreso: partial.circuito_ingreso === true,
    grupo_trabajo_vigente: partial.grupo_trabajo_vigente === true,
    grupo_ancla_resuelto: partial.grupo_ancla_resuelto === true,
    grilla_rda: partial.grilla_rda === true,
    turno: partial.turno === undefined ? null : partial.turno,
  };
}

/**
 * @param {{
 *   ok: boolean,
 *   personaId: string,
 *   articuloId: string,
 *   versionId: string,
 *   fechaDesde: string,
 *   fechaHasta: string,
 *   diasSolicitados: number,
 *   checks: ReturnType<typeof buildChecks>,
 *   codigos: string[],
 *   mensajes: string[],
 *   hlcId?: string | null,
 *   grupoAnclaId?: string | null,
 *   gruposVigentes?: Array<Record<string, unknown>>,
 *   requiereSeleccionGrupo?: boolean,
 * }} p
 */
function buildResponse(p) {
  const codigos = [...new Set((p.codigos || []).filter(Boolean))];
  const mensajes = [...new Set((p.mensajes || []).filter(Boolean))];
  const ok = p.ok === true;
  return {
    ok,
    puede_previsualizar: ok,
    persona_id: p.personaId,
    articulo_id: p.articuloId,
    version_id: p.versionId,
    fecha_desde: p.fechaDesde,
    fecha_hasta: p.fechaHasta,
    dias_solicitados: p.diasSolicitados,
    hlc_id: p.hlcId ?? null,
    grupo_trabajo_id_ancla: p.grupoAnclaId ?? null,
    grupos_trabajo_vigentes: Array.isArray(p.gruposVigentes) ? p.gruposVigentes : [],
    requiere_seleccion_grupo: p.requiereSeleccionGrupo === true,
    checks: p.checks,
    codigos,
    mensajes,
    calendario_resumen: p.calendarioResumen ?? null,
    usa_calendario_institucional: p.usaCalendarioInstitucional === true,
  };
}

function failBase(ctx, codigos, mensajes, extra = {}) {
  return buildResponse({
    ok: false,
    personaId: ctx.personaId,
    articuloId: ctx.articuloId,
    versionId: ctx.versionId,
    fechaDesde: ctx.fechaDesde,
    fechaHasta: ctx.fechaHasta,
    diasSolicitados: ctx.diasSolicitados,
    checks: extra.checks || buildChecks(),
    codigos,
    mensajes,
    hlcId: extra.hlcId ?? null,
    grupoAnclaId: extra.grupoAnclaId ?? null,
    gruposVigentes: extra.gruposVigentes ?? [],
    requiereSeleccionGrupo: extra.requiereSeleccionGrupo === true,
  });
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   personaId: string,
 *   articuloId: string,
 *   versionId: string,
 *   fechaDesde: string,
 *   diasSolicitados?: number,
 *   grupoTrabajoIdAncla?: string | null,
 *   authToken?: unknown,
 * }} params
 */
async function validarEntornoOperativoSolicitud(params) {
  const {
    db,
    personaId,
    articuloId,
    versionId,
    fechaDesde,
    diasSolicitados: diasIn,
    grupoTrabajoIdAncla,
    authToken,
  } = params;

  const ctx = {
    personaId: String(personaId || "").trim(),
    articuloId: String(articuloId || "").trim(),
    versionId: String(versionId || "").trim(),
    fechaDesde: String(fechaDesde || "").slice(0, 10),
    fechaHasta: "",
    diasSolicitados: 1,
  };

  const pDesde = parseYmd(ctx.fechaDesde);
  if (!pDesde) {
    return failBase(ctx, [CODIGO_FECHA_RANGO], [mensajeParaCodigo(CODIGO_FECHA_RANGO)], {
      checks: buildChecks(),
    });
  }

  if (!/^art_/i.test(ctx.articuloId) || !/^ver_/i.test(ctx.versionId) || !/^per_/i.test(ctx.personaId)) {
    return failBase(ctx, ["INVALID_ARGUMENT"], ["Parámetros de artículo, versión o persona inválidos."], {
      checks: buildChecks(),
    });
  }

  const [personaSnap, versionSnap] = await Promise.all([
    db.collection("personas").doc(ctx.personaId).get(),
    db.collection("cfg_articulos").doc(ctx.articuloId).collection("versiones").doc(ctx.versionId).get(),
  ]);

  if (!personaSnap.exists || !versionSnap.exists) {
    return failBase(ctx, ["NOT_FOUND"], ["Artículo o persona no encontrados."], { checks: buildChecks() });
  }

  const versionData = versionSnap.data() || {};
  if (String(versionData.estado_version_id || "").trim() !== CFG_EST_VER_PUBLICADA) {
    return failBase(ctx, ["VERSION_NO_PUBLICADA"], ["La versión del artículo no está publicada."], {
      checks: buildChecks(),
    });
  }

  if (patronFromVersion(versionData) !== PATRON_SALDO_B) {
    return failBase(ctx, ["PATRON_INVALIDO"], ["El artículo no es Patrón B."], { checks: buildChecks() });
  }

  const diasVersion = diasSolicitadosDesdeVersion(versionData);
  ctx.diasSolicitados =
    Number.isFinite(Number(diasIn)) && Number(diasIn) > 0 ? Math.floor(Number(diasIn)) : diasVersion;
  ctx.fechaHasta = fechaHastaDesdeVersionPatronB(ctx.fechaDesde, ctx.diasSolicitados);

  const fechasVal = await validarFechasArticuloEnMotor(db, {
    versionData,
    fechaDesde: ctx.fechaDesde,
    fechaHasta: ctx.fechaHasta,
    diasSolicitados: ctx.diasSolicitados,
    omitirHorizonte: tokenHasRrhhLaborAccess(authToken),
  });
  if (!fechasVal.ok) {
    return failBase(ctx, fechasVal.codigos, fechasVal.mensajes, {
      checks: buildChecks({ hlc_vigente: true }),
    });
  }
  ctx.fechaHasta = fechasVal.fecha_hasta || ctx.fechaHasta;
  const calendarioResumen = fechasVal.calendario_resumen || null;

  const hlcArray = await loadHlcArray(db, ctx.personaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, ctx.fechaDesde);

  if (hlcVigentes.length === 0) {
    return failBase(
      ctx,
      [CODIGO_ELEG_SIN_HLC],
      [mensajeParaCodigo(CODIGO_ELEG_SIN_HLC)],
      { checks: buildChecks({ hlc_vigente: false }) },
    );
  }

  const persona = personaSnap.data() || {};
  const diasExt = Number(persona.antiguedad_reconocida_dias);
  const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;

  const eleg = resolverElegibilidadSolicitud({
    versionData,
    hlcVigentes,
    personaId: ctx.personaId,
    fechaDesde: ctx.fechaDesde,
    diasExternos: externos,
    authToken,
    skipPortalRoleCheck: authToken == null,
  });

  if (!eleg.ok) {
    const codigos = Array.isArray(eleg.codigos) ? eleg.codigos : [];
    const tieneCircuito = !codigos.includes(CODIGO_CIRCUITO_ROL) && codigos.length > 0;
    return failBase(ctx, codigos, eleg.mensajes || [], {
      checks: buildChecks({
        hlc_vigente: true,
        elegibilidad_articulo: tieneCircuito,
        circuito_ingreso: !codigos.includes(CODIGO_CIRCUITO_ROL),
      }),
      hlcId: null,
    });
  }

  const grupoAncla = await resolverGrupoTrabajoIdAnclaParaSolicitud(db, {
    persona_id: ctx.personaId,
    fecha_desde: ctx.fechaDesde,
    grupo_trabajo_id_ancla: String(grupoTrabajoIdAncla || "").trim() || null,
  });

  const gruposVigentes = grupoAncla.grupos_vigentes || [];

  if (!grupoAncla.ok) {
    return failBase(ctx, [grupoAncla.codigo || "GRUPO_ANCLA_REQUERIDO"], [grupoAncla.mensaje || ""], {
      checks: buildChecks({
        hlc_vigente: true,
        elegibilidad_articulo: true,
        circuito_ingreso: true,
        grupo_trabajo_vigente: gruposVigentes.length > 0,
        grupo_ancla_resuelto: false,
      }),
      hlcId: eleg.hlc_id,
      gruposVigentes,
      requiereSeleccionGrupo: grupoAncla.requiere_seleccion === true,
    });
  }

  const topes = versionData.bloque_topes_plazos_computo || {};
  const grillaTurno = await evaluarGrillaTurnoEntorno(db, {
    depende_rda: topes.depende_rda === true,
    persona_id: ctx.personaId,
    fecha_desde: ctx.fechaDesde,
    fecha_hasta: ctx.fechaHasta,
    grupo_trabajo_id: grupoAncla.grupo_trabajo_id_ancla || undefined,
  });

  if (!grillaTurno.ok) {
    return failBase(ctx, [grillaTurno.codigo || "GRILLA_NO_AUTORIZADA"], [grillaTurno.mensaje || ""], {
      checks: buildChecks({
        hlc_vigente: true,
        elegibilidad_articulo: true,
        circuito_ingreso: true,
        grupo_trabajo_vigente: true,
        grupo_ancla_resuelto: true,
        grilla_rda: grillaTurno.checks?.grilla_rda === true,
        turno: grillaTurno.checks?.turno ?? false,
      }),
      hlcId: eleg.hlc_id,
      grupoAnclaId: grupoAncla.grupo_trabajo_id_ancla,
      gruposVigentes,
    });
  }

  return buildResponse({
    ok: true,
    personaId: ctx.personaId,
    articuloId: ctx.articuloId,
    versionId: ctx.versionId,
    fechaDesde: ctx.fechaDesde,
    fechaHasta: ctx.fechaHasta,
    diasSolicitados: ctx.diasSolicitados,
    calendarioResumen,
    usaCalendarioInstitucional: fechasVal.usa_calendario_institucional === true,
    checks: buildChecks({
      hlc_vigente: true,
      elegibilidad_articulo: true,
      circuito_ingreso: true,
      grupo_trabajo_vigente: true,
      grupo_ancla_resuelto: true,
      grilla_rda: grillaTurno.checks?.grilla_rda === true,
      turno: grillaTurno.checks?.turno ?? null,
    }),
    codigos: [],
    mensajes: [],
    hlcId: eleg.hlc_id,
    grupoAnclaId: grupoAncla.grupo_trabajo_id_ancla,
    gruposVigentes,
    requiereSeleccionGrupo: false,
  });
}

module.exports = {
  validarEntornoOperativoSolicitud,
  buildChecks,
  buildResponse,
  CFG_EST_VER_PUBLICADA,
};
