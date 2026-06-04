# Epic — Caché local frontend + envío consolidado

**Estado:** **F-UX.3 cerrado** en rama (2026-06-04) — outbox UI + `aplicarBatchAsistencia` A/B/C v2 desplegado. Ver [`RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`](./RELEASE_NOTES_FUX_GESTION_TURNO_V3.md).  
**Prerequisito:** F3 cerrada (`v2.3.0-f3-turnos-compuestos`). Callable legacy `enviarAccionesAsistencia` sigue fuera de alcance F-UX.3.

---

## Resumen

- Outbox local + botón **Enviar** → callable `enviarAccionesAsistencia`.
- Escrituras **append** (`arrayUnion`); prohibido `set` completo de `asi_*`.
- Materializar solo días afectados; `recalcularVeredicto` solo backend.
- Tipos de acción incluyen `override_cobertura_parcial` (dos personas).
- Validar `estado_periodo_liquidacion_id` antes de aplicar batch.

Detalle operativo: plan de auditoría en `.cursor/plans/auditoría_caché_frontend_1695d3d5.plan.md` (referencia interna equipo).

**Entregable doc:** [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) (contrato outbox + idempotencia `temp_id`).
