import {
  formatDateDdMmAaaa,
  formatVigenciaHldPantalla,
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  hldHlgFechaFinYmd,
  hldHlgFechaInicioYmd,
  hlgVisibleEnPantalla,
  isHlcHistoricoVisible,
  isHlcOperativo,
  isHlgAsignacionDeshabilitada,
  isHlgOHldVigenteEnHoy,
  labelDesdeIndice,
  sumarHorasSemana,
} from "./utils.js";

function formatFechaVisible(value, fallback = "—") {
  return formatDateDdMmAaaa(value, fallback);
}

export function buildLaboralSnapshotActual({
  personaId,
  hlcRows,
  hldRows,
  hlgRowsVisibles,
  idxHld,
  idxFunciones,
  idxEfectores,
  idxGrupos,
  idxRoles,
  idxTipoVinculo,
  idxEscalafon,
  idxAgrupamiento,
  idxCategorias,
}) {
  const pid = String(personaId || "").trim();
  if (!pid) {
    return {
      bloquesVigentes: [],
      totalHlcPersona: 0,
      tieneHistorico: false,
      lastUpdate: null,
      alertas: [],
    };
  }
  const hlcPersona = hlcRows.filter((r) => String(r.persona_id || "") === pid);
  const hlgPersona = hlgRowsVisibles.filter((r) => String(r.persona_id || "") === pid);
  const hldPersona = hldRows.filter((r) => String(r.persona_id || "") === pid);
  const hlcVigentes = hlcPersona.filter(isHlcOperativo);
  const hlgVigentes = hlgPersona.filter(isHlgOHldVigenteEnHoy);
  const hldVigentes = hldPersona.filter(isHlgOHldVigenteEnHoy);
  const hlcCerrados = hlcPersona.filter(isHlcHistoricoVisible);
  const merged = [...hlcPersona, ...hlgPersona, ...hldPersona];
  const lastUpdate =
    merged
      .map((r) => r.actualizado_en || r.creado_en || null)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0] || null;
  const alertas = [];
  if (hlcVigentes.length > 1) alertas.push("Más de un HLC vigente");
  if (hlcVigentes.length === 0 && hlgVigentes.length > 0) alertas.push("HLG vigente sin HLC vigente");
  if (hldVigentes.length === 0 && hlgVigentes.length > 0) alertas.push("HLG vigente sin HLD vigente");

  const hldByCargo = hldPersona.reduce((acc, hld) => {
    const cargoId = String(hld.cargo_id || "").trim();
    if (!cargoId) return acc;
    if (!acc.has(cargoId)) acc.set(cargoId, []);
    acc.get(cargoId).push(hld);
    return acc;
  }, new Map());

  const bloquesVigentes = hlcVigentes
    .slice()
    .sort((a, b) => hlcFechaDesdeYmd(b).localeCompare(hlcFechaDesdeYmd(a)))
    .map((hlc) => {
      const hldAsociados = hldByCargo.get(String(hlc.id || "")) || [];
      const hldAsociadosIds = new Set(hldAsociados.map((row) => String(row.id || "")));
      const hlgAsociados = hlgPersona.filter((r) => hldAsociadosIds.has(String(r.dato_laboral_id || "")));
      const hlgVigDelHlc = hlgAsociados.filter(isHlgOHldVigenteEnHoy);
      const hlgHistDelHlc = hlgAsociados.filter(
        (r) => hlgVisibleEnPantalla(r) && !isHlgOHldVigenteEnHoy(r),
      );
      const hldRelacionado =
        hlgVigDelHlc
          .map((r) => idxHld.get(String(r.dato_laboral_id || "")))
          .find(Boolean) || null;
      const tituloHlc = `${labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id)} · ${labelDesdeIndice(
        idxEfectores,
        hlc.efector_cumplimiento_id,
      )}`;
      const mapHlg = (r) => {
        const hldRef = idxHld.get(String(r.dato_laboral_id || "")) || null;
        const cargaHorariaGrupo = sumarHorasSemana(r.carga_por_dia_semana);
        const warningHlg = [];
        if (cargaHorariaGrupo <= 0) warningHlg.push("Sin carga horaria asignada al grupo.");
        if (!hldRef || !hldRef.funcion_real_id) warningHlg.push("Sin función real asociada.");
        const deshabilitado = isHlgAsignacionDeshabilitada(r);
        const finYmd = hldHlgFechaFinYmd(r);
        const periodo = deshabilitado
          ? `Deshabilitado · corte ${finYmd ? formatFechaVisible(finYmd) : "—"}`
          : `Desde ${formatFechaVisible(hldHlgFechaInicioYmd(r))} · ${finYmd ? formatFechaVisible(finYmd) : "Vigente"}`;
        return {
          id: String(r.id || ""),
          grupo: labelDesdeIndice(idxGrupos, r.grupo_de_trabajo_id),
          funcion: labelDesdeIndice(idxFunciones, hldRef && hldRef.funcion_real_id),
          periodo,
          deshabilitado,
          cargaHorariaGrupo: cargaHorariaGrupo > 0 ? cargaHorariaGrupo : 0,
          warningHlg,
        };
      };
      const vigenciaHlc = `Desde ${formatFechaVisible(hlcFechaDesdeYmd(hlc))} · ${
        hlcFechaHastaYmd(hlc) ? formatFechaVisible(hlcFechaHastaYmd(hlc)) : "Vigente"
      }`;
      const hldVigenciaPantalla = formatVigenciaHldPantalla(hldRelacionado);
      const hldId = hldRelacionado ? String(hldRelacionado.id || "") : "";
      const totalCargaHlg = hlgVigDelHlc.reduce((acc, row) => acc + sumarHorasSemana(row.carga_por_dia_semana), 0);
      const warningsHlc = [];
      const cargaHlcNum = Number(hlc.carga_horaria_total);
      if (hlgVigDelHlc.length === 0) warningsHlc.push("Cargo vigente sin asignación vigente a grupo de trabajo.");
      if (Number.isFinite(cargaHlcNum) && hlgVigDelHlc.length > 0 && Math.abs(totalCargaHlg - cargaHlcNum) > 0.01) {
        warningsHlc.push(`Carga horaria inconsistente: HLC ${cargaHlcNum} hs vs HLG ${totalCargaHlg} hs.`);
      }
      return {
        id: String(hlc.id || ""),
        hlcId: String(hlc.id || ""),
        tipoVinculo: labelDesdeIndice(idxTipoVinculo, hlc.tipo_vinculo_id),
        rolHlc: labelDesdeIndice(idxRoles, hlc.rol_id),
        escalafon: labelDesdeIndice(idxEscalafon, hlc.escalafon_id),
        agrupamiento: labelDesdeIndice(idxAgrupamiento, hlc.agrupamiento_id),
        categoria: labelDesdeIndice(idxCategorias, hlc.categoria_id),
        funcion: labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id),
        cargaHoraria: String(hlc.carga_horaria_total || "—"),
        tituloHlc,
        vigenciaHlc,
        hlgVigentes: hlgVigDelHlc.map(mapHlg),
        hlgHistoricos: hlgHistDelHlc.map(mapHlg),
        hldVigenciaPantalla,
        hldId,
        warningsHlc,
      };
    });

  return {
    bloquesVigentes,
    totalHlcPersona: hlcPersona.length,
    tieneHistorico: hlcCerrados.length > 0,
    lastUpdate,
    alertas,
  };
}

export function buildLaboralSnapshotHistorico({
  personaId,
  hlcRows,
  hldRows,
  hlgRowsVisibles,
  idxHld,
  idxFunciones,
  idxEfectores,
  idxGrupos,
  idxRoles,
  idxTipoVinculo,
  idxEscalafon,
  idxAgrupamiento,
  idxCategorias,
}) {
  const pid = String(personaId || "").trim();
  if (!pid) return [];
  const hlcCerrados = hlcRows
    .filter((r) => String(r.persona_id || "") === pid)
    .filter(isHlcHistoricoVisible)
    .slice()
    .sort((a, b) => hlcFechaHastaYmd(b).localeCompare(hlcFechaHastaYmd(a)));
  return hlcCerrados.map((hlc, idx) => {
    const hldDelPeriodo = hldRows.filter(
      (r) => String(r.persona_id || "") === pid && String(r.cargo_id || "") === String(hlc.id || ""),
    );
    const hldDelPeriodoIds = new Set(hldDelPeriodo.map((row) => String(row.id || "")));
    const hlgDelPeriodo = hlgRowsVisibles.filter(
      (r) => String(r.persona_id || "") === pid && hldDelPeriodoIds.has(String(r.dato_laboral_id || "")),
    );
    const hlgVigDelHlc = hlgDelPeriodo.filter(isHlgOHldVigenteEnHoy);
    const hlgHistDelHlc = hlgDelPeriodo.filter((r) => !isHlgOHldVigenteEnHoy(r));
    const mapHlg = (r) => {
      const hldRef = idxHld.get(String(r.dato_laboral_id || "")) || null;
      const cargaHorariaGrupo = sumarHorasSemana(r.carga_por_dia_semana);
      const deshabilitado = isHlgAsignacionDeshabilitada(r);
      const finYmd = hldHlgFechaFinYmd(r);
      const periodo = deshabilitado
        ? `Deshabilitado · corte ${finYmd ? formatFechaVisible(finYmd) : "—"}`
        : `Desde ${formatFechaVisible(hldHlgFechaInicioYmd(r))} · ${finYmd ? formatFechaVisible(finYmd) : "Vigente"}`;
      return {
        id: String(r.id || ""),
        grupo: labelDesdeIndice(idxGrupos, r.grupo_de_trabajo_id),
        funcion: labelDesdeIndice(idxFunciones, hldRef && hldRef.funcion_real_id),
        periodo,
        deshabilitado,
        cargaHorariaGrupo: cargaHorariaGrupo > 0 ? cargaHorariaGrupo : 0,
      };
    };
    const titulo = `${labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id)} · ${labelDesdeIndice(
      idxEfectores,
      hlc.efector_cumplimiento_id,
    )}`;
    const periodo = `Desde ${formatFechaVisible(hlcFechaDesdeYmd(hlc))} · Hasta ${formatFechaVisible(hlcFechaHastaYmd(hlc))}`;
    return {
      id: String(hlc.id || `hlc-cerrado-${idx}`),
      hlcId: String(hlc.id || ""),
      tipoVinculo: labelDesdeIndice(idxTipoVinculo, hlc.tipo_vinculo_id),
      rolHlc: labelDesdeIndice(idxRoles, hlc.rol_id),
      escalafon: labelDesdeIndice(idxEscalafon, hlc.escalafon_id),
      agrupamiento: labelDesdeIndice(idxAgrupamiento, hlc.agrupamiento_id),
      categoria: labelDesdeIndice(idxCategorias, hlc.categoria_id),
      funcion: labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id),
      cargaHoraria: String(hlc.carga_horaria_total || "—"),
      orden: idx + 1,
      titulo,
      periodo,
      asignaciones: hlgDelPeriodo.length,
      hlgVigentes: hlgVigDelHlc.map(mapHlg),
      hlgHistoricos: hlgHistDelHlc.map(mapHlg),
    };
  });
}
