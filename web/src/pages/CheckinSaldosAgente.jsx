import Card from "../components/ui/Card.jsx";
import { CheckinAnioCorteField } from "../features/checkinSaldos/CheckinAnioCorteField.jsx";
import { CheckinCategoriaTabs } from "../features/checkinSaldos/CheckinCategoriaTabs.jsx";
import { CheckinGlobalCierreModal } from "../features/checkinSaldos/CheckinGlobalCierreModal.jsx";
import { CheckinHlcConfirmField } from "../features/checkinSaldos/CheckinHlcConfirmField.jsx";
import { CheckinLaoFilasEditor } from "../features/checkinSaldos/CheckinLaoFilasEditor.jsx";
import { CheckinModoSelector } from "../features/checkinSaldos/CheckinModoSelector.jsx";
import { CheckinPatronBTab } from "../features/checkinSaldos/CheckinPatronBTab.jsx";
import { CheckinPatronCTab } from "../features/checkinSaldos/CheckinPatronCTab.jsx";
import { CheckinPersonaEstadoBanner } from "../features/checkinSaldos/CheckinPersonaEstadoBanner.jsx";
import { CheckinPersonaField } from "../features/checkinSaldos/CheckinPersonaField.jsx";
import { CheckinRectificacionAviso } from "../features/checkinSaldos/CheckinRectificacionAviso.jsx";
import { useCheckinSaldosPage } from "../features/checkinSaldos/useCheckinSaldosPage.js";

export default function CheckinSaldosAgente() {
  const p = useCheckinSaldosPage();

  const guardarParcial =
    p.categoriaTab === "A"
      ? p.onGuardarParcialA
      : p.categoriaTab === "B"
        ? p.onGuardarParcialB
        : p.onGuardarParcialC;

  const labelParcial = p.esRectificacion
    ? p.categoriaTab === "A"
      ? "Aplicar rectificación LAO"
      : p.categoriaTab === "B"
        ? "Aplicar rectificación (ciclos informados)"
        : "Aplicar rectificación (patrón C)"
    : p.categoriaTab === "A"
      ? "Guardar LAO disponibles"
      : p.categoriaTab === "B"
        ? "Guardar ciclos informados"
        : "Guardar saldos patrón C";

  const intro = p.esRectificacion
    ? "Rectificación: corregí solo las bolsas que guardés; el resto no se toca."
    : "Check-in nuevo: agente → año A → HLC → cargá por categoría → cierre global.";

  const mostrarCierreGlobal = p.personaId && !p.yaCheckinGlobal && p.esNuevoCheckin;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 md:max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900">Check-in de saldos (RRHH)</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{intro}</p>

      <Card className="mt-6 space-y-5 p-4 md:p-5">
        <CheckinPersonaField
          personaWrapRef={p.personaWrapRef}
          loadPersonas={p.loadPersonas}
          personaOpen={p.personaOpen}
          setPersonaOpen={p.setPersonaOpen}
          personaQuery={p.personaQuery}
          setPersonaQuery={p.setPersonaQuery}
          personaId={p.personaId}
          setPersonaId={p.setPersonaId}
          personaSeleccionadaLabel={p.personaSeleccionadaLabel}
          personaOptionsFiltradas={p.personaOptionsFiltradas}
        />

        <CheckinAnioCorteField
          anioCorteA={p.anioCorteA}
          setAnioCorteA={p.setAnioCorteA}
          anioAValido={p.anioAValido}
          readOnly={p.anioALectura != null}
        />
        {p.anioALectura != null ? (
          <p className="text-xs text-violet-800">Año A del check-in original: {p.anioALectura} (no editable en rectificación).</p>
        ) : (
          <p className="text-xs text-slate-500">{p.copyAnioA}</p>
        )}

        {p.loadingPrecarga ? (
          <p className="text-xs text-slate-500">Leyendo bolsas del agente en Firestore…</p>
        ) : null}

        {p.necesitaElegirModo ? (
          <CheckinModoSelector modo={p.modoCheckin} onSelect={p.setModoCheckin} />
        ) : null}

        {p.esNuevoCheckin ? (
          <CheckinHlcConfirmField
            checked={p.hlcConfirmadas}
            onChange={p.setHlcConfirmadas}
            disabled={!p.personaId || !p.anioAValido || p.necesitaElegirModo}
          />
        ) : null}

        {p.esRectificacion ? <CheckinRectificacionAviso /> : null}

        <CheckinPersonaEstadoBanner
          personaId={p.personaId}
          loading={p.loadingPersonaData}
          personaData={p.personaData}
          confirmarRecargaGlobal={p.confirmarRecargaGlobal}
          setConfirmarRecargaGlobal={p.setConfirmarRecargaGlobal}
          confirmarRecargaLao={p.confirmarRecargaLao}
          setConfirmarRecargaLao={p.setConfirmarRecargaLao}
          showLaoRecarga={p.esNuevoCheckin && p.categoriaTab === "A"}
        />

        {p.necesitaElegirModo ? (
          <p className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-3 text-sm text-violet-950">
            Elegí arriba si es check-in nuevo o rectificación para continuar.
          </p>
        ) : null}

        {!p.prerequisitosOk && !p.necesitaElegirModo ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            {p.esNuevoCheckin
              ? "Completá agente, año A y confirmación HLC."
              : "Completá agente y año A."}
          </p>
        ) : null}

        <CheckinCategoriaTabs
          active={p.categoriaTab}
          onChange={p.setCategoriaTab}
          disabled={p.formularioBloqueado && !p.necesitaElegirModo}
        />

        <div className={p.formularioBloqueado ? "pointer-events-none opacity-50" : ""}>
          {p.categoriaTab === "A" ? (
            <div className="space-y-3">
              <CheckinLaoFilasEditor
                anioA={p.anioA ?? null}
                filas={p.filas}
                onAgregarFila={p.onAgregarFila}
                onQuitarFila={p.onQuitarFila}
                onCambiarFila={p.onCambiarFila}
              />
            </div>
          ) : null}

          {p.categoriaTab === "B" ? (
            <CheckinPatronBTab
              articulosPatron={p.articulosB}
              loading={p.loadingB}
              anioA={p.anioA ?? 0}
              diasPorArticulo={p.diasPorArticuloB}
              onDiasChange={p.onDiasBChange}
              disabled={p.formularioBloqueado}
            />
          ) : null}

          {p.categoriaTab === "C" ? (
            <CheckinPatronCTab
              articulosPatron={p.articulosC}
              loading={p.loadingC}
              saldosPorArticulo={p.saldosPorArticuloC}
              onSaldoChange={p.onSaldoCChange}
              disabled={p.formularioBloqueado}
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={guardarParcial}
          disabled={p.enviando || p.formularioBloqueado}
          className="min-h-11 w-full touch-manipulation rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {p.enviando ? "Guardando…" : labelParcial}
        </button>

        {mostrarCierreGlobal ? (
          <button
            type="button"
            onClick={p.onAbrirCierreGlobal}
            disabled={p.enviando || !p.prerequisitosOk}
            className="min-h-11 w-full touch-manipulation rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            Finalizar check-in global
          </button>
        ) : null}
      </Card>

      {p.ultimoResultado?.bolsas_escritas?.length ? (
        <Card className="mt-4 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Último guardado LAO</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {p.ultimoResultado.bolsas_escritas.map((b) => (
              <li key={`${b.anio_origen}-${b.bolsa_id}`}>
                {b.anio_origen}: {b.bolsa_id}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <CheckinGlobalCierreModal
        open={p.modalGlobal.open}
        step={p.modalGlobal.step}
        lineas={p.lineasResumen}
        enviando={p.enviando}
        onCerrar={p.onCerrarModal}
        onContinuar={p.onModalContinuar}
        onConfirmarFinal={p.onConfirmarCierreGlobal}
      />
    </div>
  );
}