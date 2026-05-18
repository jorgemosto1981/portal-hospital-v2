import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callCerrarCheckinGlobal } from "../../services/callables.js";
import { buildCheckinResumen } from "./buildCheckinResumen.js";
import { buildCheckinCierreAdvertencias } from "./buildCheckinCierreAdvertencias.js";
import { validateCheckinFilas } from "./checkinFilasUtils.js";
import { validateCheckinEstandar } from "./validateCheckinEstandar.js";
import { validateCheckinPatronC } from "./validateCheckinPatronC.js";
import { checkinCallableMessage } from "./checkinCallableMessage.js";

/**
 * @param {object} ctx
 */
export function useCheckinResumenCierre(ctx) {
  const [modalGlobal, setModalGlobal] = useState({ open: false, step: 1 });
  const [modalCierreAcks, setModalCierreAcks] = useState({});

  const lineasResumen = useMemo(() => {
    const { anioA, filas, diasPorArticuloB, saldosPorArticuloC, articulos, articulosB, articulosC, personaSeleccionadaLabel } =
      ctx;
    const filasLao = [];
    if (anioA != null) {
      const { payloadFilas } = validateCheckinFilas(filas, anioA);
      if (payloadFilas?.length) {
        for (const f of payloadFilas) {
          filasLao.push({ anio_origen: f.anio_origen, dias_disponibles: f.dias_disponibles });
        }
      }
    }

    const filasB = [];
    if (anioA != null) {
      for (const [artId, rawVal] of Object.entries(diasPorArticuloB)) {
        const raw = String(rawVal ?? "").trim();
        if (raw === "") continue;
        const a = articulosB.find((x) => x.id === artId) || articulos.find((x) => x.id === artId);
        if (!a) continue;
        const v = validateCheckinEstandar({
          anioCiclo: String(anioA),
          diasConsumidosPrevios: raw,
          cupoDiasPorCiclo: a.cupoDiasPorCiclo ?? null,
          anioA,
        });
        if (!v.ok) continue;
        const cupo = a.cupoDiasPorCiclo != null ? Number(a.cupoDiasPorCiclo) : null;
        const saldo = cupo != null ? Math.max(0, cupo - v.usados) : (v.disponibleInicial ?? null);
        if (saldo == null) continue;
        filasB.push({ codigo: a.codigo, diasUsados: v.usados, saldo, cupo });
      }
    }

    const filasC = [];
    for (const [artId, rawVal] of Object.entries(saldosPorArticuloC)) {
      const raw = String(rawVal ?? "").trim();
      if (raw === "") continue;
      const a = articulosC.find((x) => x.id === artId) || articulos.find((x) => x.id === artId);
      if (!a) continue;
      const vc = validateCheckinPatronC(raw);
      if (!vc.ok) continue;
      filasC.push({ codigo: a.codigo, saldo: vc.saldo });
    }

    return buildCheckinResumen({
      filasLao,
      filasB,
      filasC,
      anioA: anioA ?? 0,
      personaLabel: personaSeleccionadaLabel,
    });
  }, [ctx]);

  const advertenciasCierre = useMemo(
    () =>
      buildCheckinCierreAdvertencias({
        esNuevoCheckin: ctx.esNuevoCheckin,
        hlcConfirmadas: ctx.hlcConfirmadas,
        lineasResumen,
        tieneBolsasFirestore: ctx.tieneBolsasFirestore,
      }),
    [ctx.esNuevoCheckin, ctx.hlcConfirmadas, lineasResumen, ctx.tieneBolsasFirestore],
  );

  const todosAckCierreMarcados = useMemo(() => {
    if (!advertenciasCierre.length) return true;
    return advertenciasCierre.every((a) => modalCierreAcks[a.id] === true);
  }, [advertenciasCierre, modalCierreAcks]);

  const resetCierre = useCallback(() => {
    setModalGlobal({ open: false, step: 1 });
    setModalCierreAcks({});
  }, []);

  const onAbrirCierreGlobal = useCallback(() => {
    if (ctx.esRectificacion) {
      toast.error("En rectificación no se vuelve a cerrar el check-in global.");
      return;
    }
    const per = ctx.assertBase();
    if (!per) return;
    const adv = buildCheckinCierreAdvertencias({
      esNuevoCheckin: ctx.esNuevoCheckin,
      hlcConfirmadas: ctx.hlcConfirmadas,
      lineasResumen,
      tieneBolsasFirestore: ctx.tieneBolsasFirestore,
    });
    const ackInit = {};
    adv.forEach((a) => {
      ackInit[a.id] = false;
    });
    setModalCierreAcks(ackInit);
    setModalGlobal({ open: true, step: 1 });
  }, [ctx, lineasResumen]);

  const onCerrarModal = useCallback(() => resetCierre(), [resetCierre]);

  const onModalContinuar = useCallback(() => {
    setModalGlobal((m) => {
      if (m.step === 1) return { ...m, step: 2 };
      if (m.step === 2) return { ...m, step: 3 };
      return m;
    });
  }, []);

  const onToggleAckCierre = useCallback((id) => {
    setModalCierreAcks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onConfirmarCierreGlobal = useCallback(async () => {
    const per = ctx.assertBase();
    if (!per || ctx.anioA == null) return;
    ctx.setEnviando(true);
    try {
      await callCerrarCheckinGlobal({ persona_id: per, anio_corte_a: ctx.anioA });
      toast.success("Check-in global cerrado.");
      await ctx.refreshPersona(per);
      ctx.setConfirmarRecargaGlobal(false);
      resetCierre();
    } catch (e) {
      toast.error(checkinCallableMessage(e));
    } finally {
      ctx.setEnviando(false);
    }
  }, [ctx, resetCierre]);

  return {
    modalGlobal,
    advertenciasCierre,
    modalCierreAcks,
    todosAckCierreMarcados,
    lineasResumen,
    onAbrirCierreGlobal,
    onCerrarModal,
    onModalContinuar,
    onToggleAckCierre,
    onConfirmarCierreGlobal,
    resetCierre,
  };
}
