import LaoFechasPaso from "./LaoFechasPaso.jsx";
import LaoGrupoAnclaPaso from "./LaoGrupoAnclaPaso.jsx";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Paso 2 LAO — revelación progresiva: grupo → inicio → fin → resumen.
 */
export default function LaoPaso2Tramite({
  gruposVigentes = [],
  grupoAnclaId = "",
  setGrupoAnclaId,
  requiereSeleccionGrupo = false,
  grupoAnclaOk = false,
  gruposLoading = false,
  gruposError = "",
  fechaDesde = "",
  setFechaDesde,
  fechaHasta = "",
  setFechaHasta,
  computoLoading = false,
  modoComputo = "",
  resumenComputo = null,
  computoMensajes = [],
  computoOk = false,
}) {
  const tieneGrupo = grupoAnclaOk;
  const tieneDesde = RX_YMD.test(fechaDesde);
  const tieneHasta = RX_YMD.test(fechaHasta) && fechaHasta >= fechaDesde;
  const mostrarResumen = tieneGrupo && tieneDesde && tieneHasta;

  return (
    <div className="space-y-5">
      <LaoGrupoAnclaPaso
        gruposVigentes={gruposVigentes}
        grupoAnclaId={grupoAnclaId}
        setGrupoAnclaId={setGrupoAnclaId}
        requiereSeleccionGrupo={requiereSeleccionGrupo}
        isLoading={gruposLoading}
        error={gruposError}
      />

      {tieneGrupo ? (
        <LaoFechasPaso
          fechaDesde={fechaDesde}
          setFechaDesde={setFechaDesde}
          fechaHasta={fechaHasta}
          setFechaHasta={setFechaHasta}
          mostrarFechaDesde
          mostrarFechaHasta={tieneDesde}
          mostrarResumen={mostrarResumen}
          isLoading={computoLoading}
          modoComputo={modoComputo}
          resumenComputo={mostrarResumen ? resumenComputo : null}
          mensajes={mostrarResumen ? computoMensajes : []}
          ok={computoOk}
        />
      ) : null}
    </div>
  );
}
