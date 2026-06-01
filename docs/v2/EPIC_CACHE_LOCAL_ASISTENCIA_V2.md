# Epic — Caché local frontend + envío consolidado

**Estado:** planificado — **ejecutar después** del epic turnos compuestos (Fases A–C cerradas).  
**Prerequisito:** [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md), tag `v2.0.0-rfc-turnos-compuestos`.

---

## Resumen

- Outbox local + botón **Enviar** → callable `enviarAccionesAsistencia`.
- Escrituras **append** (`arrayUnion`); prohibido `set` completo de `asi_*`.
- Materializar solo días afectados; `recalcularVeredicto` solo backend.
- Tipos de acción incluyen `override_cobertura_parcial` (dos personas).
- Validar `estado_periodo_liquidacion_id` antes de aplicar batch.

Detalle operativo: plan de auditoría en `.cursor/plans/auditoría_caché_frontend_1695d3d5.plan.md` (referencia interna equipo).

**Entregable doc pendiente:** `RFC_CACHE_LOCAL_ASISTENCIA_V2.md` (contrato outbox + idempotencia `temp_id`).
