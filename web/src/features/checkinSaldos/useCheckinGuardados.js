import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import {
  callPersistirCheckinLaoBolsas,
  callPersistirCheckinSaldoEstandarLote,
} from "../../services/callables.js";
import { collectPendientesPatronB, collectPendientesPatronC } from "./collectPendientesPatronBC.js";
import { validateCheckinFilas } from "./checkinFilasUtils.js";
import { checkinCallableMessage } from "./checkinCallableMessage.js";

/**
 * @param {object} ctx — estado y helpers del check-in
 */
export function useCheckinGuardados(ctx) {
  const [enviando, setEnviando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  const resetGuardados = useCallback(() => {
    setUltimoResultado(null);
    setEnviando(false);
  }, []);

  const onGuardarParcialA = useCallback(async () => {
    const per = ctx.assertBase();
    if (!per) return;
    const rectificarLao =
      ctx.esRectificacion || ctx.confirmarRecargaGlobal || ctx.confirmarRecargaLao;
    if (ctx.bloqueoGlobalSinRecarga && !rectificarLao) {
      toast.error("Check-in global cerrado. Elegí «Rectificación» o autorizá recarga global.");
      return;
    }
    if ((ctx.yaCheckinGlobal || ctx.yaCheckinLao) && !rectificarLao) {
      toast.error(
        "Este agente ya tiene check-in. Elegí «Rectificación» o marcá la autorización de recarga antes de guardar LAO.",
      );
      return;
    }
    if (!ctx.laoArticulo) {
      toast.error("No se encontró el artículo LAO en configuración.");
      return;
    }
    const { ok, errors, payloadFilas } = validateCheckinFilas(ctx.filas, ctx.anioA);
    if (!ok) {
      toast.error(errors[0] || "Revisá las filas LAO.");
      return;
    }
    setEnviando(true);
    try {
      const resp = await callPersistirCheckinLaoBolsas({
        persona_id: per,
        articulo_id: ctx.laoArticulo.id,
        anio_corte_a: ctx.anioA,
        hlc_confirmadas_completas: rectificarLao ? false : true,
        filas: payloadFilas,
        ...(rectificarLao ? { forzar_recarga_global: true } : {}),
        ...(rectificarLao ? { rectificacion_saldo: true } : {}),
      });
      setUltimoResultado(resp?.data);
      toast.success(
        rectificarLao
          ? `LAO rectificado: ${payloadFilas.length} bolsa(s) actualizada(s).`
          : `LAO: ${payloadFilas.length} bolsa(s) guardada(s).`,
      );
      await ctx.refreshPersona(per);
      ctx.setConfirmarRecargaLao(false);
    } catch (e) {
      toast.error(checkinCallableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [ctx]);

  const onGuardarParcialB = useCallback(async () => {
    const per = ctx.assertBase();
    if (!per || ctx.anioA == null) return;

    const collected = collectPendientesPatronB({
      articulosB: ctx.articulosB,
      articulos: ctx.articulos,
      diasPorArticuloB: ctx.diasPorArticuloB,
      anioA: ctx.anioA,
    });
    if (!collected.ok) {
      toast.error(collected.message);
      return;
    }

    setEnviando(true);
    try {
      const resp = await callPersistirCheckinSaldoEstandarLote({
        persona_id: per,
        patron: "B",
        anio_corte_a: ctx.anioA,
        items: collected.items,
        ...(ctx.forzarRecarga ? { forzar_recarga_global: true } : {}),
        ...(ctx.esRectificacion ? { rectificacion_saldo: true } : {}),
      });
      const n = Number(resp?.data?.count) || collected.items.length;
      toast.success(
        ctx.esRectificacion
          ? `Rectificación B: ${n} artículo(s) en un solo guardado.`
          : `Patrón B: ${n} artículo(s) guardado(s) (atómico).`,
      );
      await ctx.refreshPersona(per);
    } catch (e) {
      toast.error(checkinCallableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [ctx]);

  const onGuardarParcialC = useCallback(async () => {
    const per = ctx.assertBase();
    if (!per || ctx.anioA == null) return;

    const collected = collectPendientesPatronC({
      articulosC: ctx.articulosC,
      articulos: ctx.articulos,
      saldosPorArticuloC: ctx.saldosPorArticuloC,
    });
    if (!collected.ok) {
      toast.error(collected.message);
      return;
    }

    setEnviando(true);
    try {
      const resp = await callPersistirCheckinSaldoEstandarLote({
        persona_id: per,
        patron: "C",
        anio_corte_a: ctx.anioA,
        items: collected.items,
        ...(ctx.forzarRecarga ? { forzar_recarga_global: true } : {}),
        ...(ctx.esRectificacion ? { rectificacion_saldo: true } : {}),
      });
      const n = Number(resp?.data?.count) || collected.items.length;
      toast.success(
        ctx.esRectificacion
          ? `Rectificación C: ${n} artículo(s) en un solo guardado.`
          : `Patrón C: ${n} artículo(s) guardado(s) (atómico).`,
      );
      await ctx.refreshPersona(per);
    } catch (e) {
      toast.error(checkinCallableMessage(e));
    } finally {
      setEnviando(false);
    }
  }, [ctx]);

  return {
    enviando,
    setEnviando,
    ultimoResultado,
    onGuardarParcialA,
    onGuardarParcialB,
    onGuardarParcialC,
    resetGuardados,
  };
}
