import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import {
  clasesTextoCelda,
  clasesTextoCeldaOutboxPendiente,
} from "./grillaTurnosVisual.js";
import GrillaPresentacionCompuestoFilas from "./GrillaPresentacionCompuestoFilas.jsx";
import GrillaFichadaEstadoJefeBadge from "./GrillaFichadaEstadoJefeBadge.jsx";
import DiaGrillaCelda from "./DiaGrillaCelda.jsx";

export function contenidoCeldaOperativa({
  tieneLicencia,
  licenciaCod,
  tieneTurno,
  esFranco,
  esNoLaborable,
  turnoText,
  mostrarFichadaReal = false,
  fichadaPresencia,
  estadoFichadaJefe,
  outboxVisual,
  esIncompletoPlan,
  desalineacionTeoria,
  desalineacionTooltip,
  imputacionExterna,
  imputacionTooltip,
  postPurgeHlg,
  postPurgeTooltip,
  teoriaPendienteLazy,
  teoriaPendienteTooltip,
  licenciaEnFranco,
  licenciaEnFrancoTooltip,
  soloLecturaGrilla,
  soloLecturaTooltip,
  celdaVis,
  filasPresentacionCompuesto = null,
  matrizPresentacionCompuesta = false,
  usaPresentacionPisos = false,
  pisoCompuestoGrande = false,
  ocultarMicroAnalitica = false,
  modoFichadaRrhh = false,
  omitirBadgeSemaforo = false,
  soloTeoriaFuturo = false,
  celdaFuturaSinFichada = false,
}) {
  const claseTextoPrincipal = outboxVisual?.pending ? clasesTextoCeldaOutboxPendiente : clasesTextoCelda;
  const alertaTitle = desalineacionTooltip || "Teoría modificada post-licencia";
  const badgeAlerta = desalineacionTeoria ? (
    <span
      className="text-[8px] font-bold leading-none text-amber-700"
      title={alertaTitle}
      aria-label={alertaTitle}
    >
      ⚠
    </span>
  ) : null;
  const badgeFanOut = imputacionExterna ? (
    <span
      className="text-[8px] font-bold leading-none text-sky-800"
      title={imputacionTooltip || "Licencia gestionada en otro sector"}
      aria-label={imputacionTooltip || "Licencia gestionada en otro sector"}
    >
      🔗
    </span>
  ) : null;
  const badgePostPurge = postPurgeHlg ? (
    <span
      className="text-[8px] font-bold leading-none text-amber-900"
      title={postPurgeTooltip || "HLg inactiva — historial de licencia preservado"}
      aria-label={postPurgeTooltip || "HLg inactiva — historial de licencia preservado"}
    >
      📅
    </span>
  ) : null;
  const badgeTeoriaPendiente = teoriaPendienteLazy ? (
    <span
      className="text-[8px] font-bold leading-none text-slate-700"
      title={teoriaPendienteTooltip || "Teoría pendiente de cálculo"}
      aria-label={teoriaPendienteTooltip || "Teoría pendiente de cálculo"}
    >
      ⏳
    </span>
  ) : null;
  const badgeLicenciaFranco = licenciaEnFranco ? (
    <span
      className="text-[8px] font-bold leading-none text-slate-600"
      title={licenciaEnFrancoTooltip || "Licencia solapada en franco"}
      aria-label={licenciaEnFrancoTooltip || "Licencia solapada en franco"}
    >
      ℹ️
    </span>
  ) : null;
  const badgeSoloLectura = soloLecturaGrilla ? (
    <span
      className="text-[8px] font-bold leading-none text-slate-700"
      title={soloLecturaTooltip || "Mes cerrado / solo lectura"}
      aria-label={soloLecturaTooltip || "Mes cerrado / solo lectura"}
    >
      🔒
    </span>
  ) : null;
  const filaBadges =
    badgeAlerta ||
    badgeFanOut ||
    badgePostPurge ||
    badgeTeoriaPendiente ||
    badgeLicenciaFranco ||
    badgeSoloLectura ? (
      <span className="flex items-center justify-center gap-px leading-none">
        {badgeAlerta}
        {badgeFanOut}
        {badgePostPurge}
        {badgeTeoriaPendiente}
        {badgeLicenciaFranco}
        {badgeSoloLectura}
      </span>
    ) : null;
  const badgeFichada =
    omitirBadgeSemaforo || !estadoFichadaJefe ? null : (
      <GrillaFichadaEstadoJefeBadge
        estado={estadoFichadaJefe.estado}
        tooltip={estadoFichadaJefe.tooltip}
        className="mt-px"
        compacto
      />
    );
  const badgeAnalitica =
    usaPresentacionPisos || ocultarMicroAnalitica ? null : (
      <DiaGrillaCelda celdaVis={celdaVis} className="mt-px" modoRrhh={modoFichadaRrhh} />
    );
  const filaInferiorCelda =
    celdaFuturaSinFichada
      ? null
      : badgeAnalitica || filaBadges || badgeFichada
        ? (
            <span className="mt-px flex flex-col items-center gap-px leading-none">
              {filaBadges}
              {badgeFichada}
              {badgeAnalitica}
            </span>
          )
        : null;
  const diffBlock =
    outboxVisual?.pending &&
    !outboxVisual?.mostrarResultadoFinal &&
    (outboxVisual.diffOut || outboxVisual.diffIn) ? (
    <span className="mt-px flex flex-col items-center gap-px text-[10px] font-semibold leading-tight">
      {outboxVisual.diffOut ? (
        <span className="text-rose-700">− {outboxVisual.diffOut}</span>
      ) : null}
      {outboxVisual.diffOut && outboxVisual.diffIn ? (
        <span className="text-slate-400"> · </span>
      ) : null}
      {outboxVisual.diffIn ? (
        <span className="text-emerald-800">+ {outboxVisual.diffIn}</span>
      ) : null}
    </span>
  ) : null;

  if (outboxVisual?.lineaExtra) {
    return (
      <span className="flex w-full flex-col items-center justify-center leading-none">
        {outboxVisual.lineaBaseMuted ? (
          <span className={`${clasesTextoCelda(outboxVisual.lineaBaseMuted)} opacity-70`}>
            {outboxVisual.lineaBaseMuted}
          </span>
        ) : null}
        <span className={clasesTextoCelda(outboxVisual.lineaExtra)}>{outboxVisual.lineaExtra}</span>
        <span className="mt-0.5 flex flex-col items-center gap-px">
          {filaInferiorCelda}
          {diffBlock}
        </span>
      </span>
    );
  }

  if (
    usaPresentacionPisos &&
    Array.isArray(filasPresentacionCompuesto) &&
    filasPresentacionCompuesto.length > 0 &&
    !soloTeoriaFuturo
  ) {
    return (
      <span className="flex h-full w-full flex-col leading-none">
        <GrillaPresentacionCompuestoFilas
          filas={filasPresentacionCompuesto}
          mostrarBadges
          pisoGrande={pisoCompuestoGrande}
          className="flex-1"
        />
        {filaInferiorCelda || diffBlock ? (
          <span className="mt-px flex flex-col items-center gap-px">
            {filaInferiorCelda}
            {diffBlock}
          </span>
        ) : null}
      </span>
    );
  }

  const turnoMostrar = mostrarFichadaReal
    ? turnoText
    : outboxVisual?.turnoText ?? turnoText;
  if (soloTeoriaFuturo) {
    const etiqueta =
      turnoMostrar ||
      (esNoLaborable ? "NL" : esFranco ? "F" : tieneLicencia ? licenciaCod.slice(0, 4) : "");
    return (
      <span className="flex flex-col items-center justify-center leading-none">
        <span className={`${claseTextoPrincipal(etiqueta)} font-medium`}>{etiqueta}</span>
      </span>
    );
  }
  if (tieneLicencia && (tieneTurno || esFranco || esNoLaborable)) {
    return (
      <span className="flex w-full flex-col items-center justify-center leading-none">
        <span className={claseTextoPrincipal(turnoMostrar || (esNoLaborable ? "NL" : "F"))}>
          {turnoMostrar || (esNoLaborable ? "NL" : "F")}
        </span>
        <span className="mt-0.5 flex flex-col items-center gap-px">
          {filaInferiorCelda}
          {diffBlock}
          <span className="text-[7px] font-bold text-fuchsia-950">{licenciaCod.slice(0, 4)}</span>
        </span>
      </span>
    );
  }
  if (tieneLicencia) {
    return (
      <span className="flex flex-col items-center">
        {filaInferiorCelda}
        <span className={claseTextoPrincipal(licenciaCod)}>{licenciaCod.slice(0, 4)}</span>
        {esIncompletoPlan ? (
          <span className="text-[6px] font-semibold text-rose-800">Plan incompleto</span>
        ) : null}
      </span>
    );
  }
  if (esIncompletoPlan) {
    return (
      <span className="flex flex-col items-center justify-center leading-none">
        <span className="text-[7px] font-bold leading-tight text-rose-950">Sin turno</span>
        {filaInferiorCelda}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center justify-center leading-none">
      {turnoMostrar.includes("·") ? (
        turnoMostrar.split("·").map((tramo, i) => (
          <span key={i} className={claseTextoPrincipal(tramo.trim())}>
            {tramo.trim()}
          </span>
        ))
      ) : (
        <span className={claseTextoPrincipal(turnoMostrar)}>{turnoMostrar}</span>
      )}
      <span className="mt-0.5 flex flex-col items-center gap-px">
        {filaInferiorCelda}
        {diffBlock}
      </span>
    </span>
  );
}
