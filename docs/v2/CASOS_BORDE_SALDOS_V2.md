# Matriz unificada de casos borde de saldos (V2)

**Estado:** acordado producto/arquitectura 2026-05-16.  
**SSoT** de lógica de producto para la resolución de anomalías temporales y operativas en el Hospital Gral. Alvear.

**Relación:** [`REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md`](./REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md), [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) §10, [`GUIA_RRHH_SALDOS_V2.md`](./GUIA_RRHH_SALDOS_V2.md), [`MODULO_CALENDARIO_FERIADOS_V2.md`](./MODULO_CALENDARIO_FERIADOS_V2.md).

> **Convención V2:** los estados de solicitud usan catálogo `cfg_estado_solicitud_articulo` (`cfg_esa_*`). Donde este documento dice «ingresada» o «validada» en lenguaje institucional, mapear a los `cfg_esa_*` vigentes en implementación (hoy: `cfg_esa_borrador`, `cfg_esa_en_revision_jefe`, etc.).

| ID | Caso borde | Comportamiento institucional mandatorio | Implementación técnica |
|:---:|------------|----------------------------------------|-------------------------|
| **1** | **Cruce de año calendario** | Prohibido de forma absoluta en una misma solicitud. | Validación UI (`año(fecha_desde) !== año(fecha_hasta)`) deshabilita el envío. El agente debe emitir dos tickets separados. Backend replica en Callable/trigger al iniciar trámite. |
| **2** | **Horizonte temporal a futuro** | Agente base limitado a **mes en curso + mes siguiente**. RRHH sin límite pero con advertencia (banner). | DatePicker inhabilita meses avanzados para rol base. Cloud Function replica validación en backend. |
| **3** | **Anulación / FIFO reverso** | Al dar de baja una LAO (Patrón A), los días deben volver exactamente a las bolsas anuales de origen de donde salieron. | Las solicitudes aprobadas guardan el metadato `_debito_origen: [{ bolsa_id, anio_origen, dias }]`. El trigger de anulación/rechazo lee este array y ejecuta incremento reverso atómico en `saldos_articulo_agente`. Si `disponible` vuelve a &gt; 0, reactivar `cfg_esb_agotado` → `cfg_esb_activo`. |
| **4** | **Feriados y asuetos dinámicos** | Las licencias que operan en días hábiles descuentan según el calendario oficial unificado del hospital, sin importar el turno. | El motor cruza el rango de fechas con [`cfg_calendario_feriados_institucional`](./MODULO_CALENDARIO_FERIADOS_V2.md) antes de computar el costo del saldo. |
| **5** | **Pluriempleo / múltiples cargos** | Toda licencia, tope y bolsa contable se imputa a la **persona (legajo central)**, no al cargo. | Se descarta el uso de `cargo_id` en las llaves primarias de Firestore. IDs consolidados por `persona_id` (`sal_YYYY_per_*`, `sal_global_per_*`). |
| **6** | **Trámites pendientes al cierre** | El job de fin de ciclo **no** se frena por solicitudes trabadas en jefatura. Muta la bolsa a expirada. | Las solicitudes vivas completan su flujo. El consumo ya ocurrió al iniciar trámite (RFC §10.1). Si se rechazan post-cierre, el reverso incrementa el saldo de la bolsa ya `cfg_esb_expirado`. |
| **7** | **Ajustes post-check-in** | Prohibida la edición directa sobre los contadores del marcador por interfaz de usuario. | RRHH usa un formulario que crea `solicitudes_articulo` con `estado_solicitud_id: cfg_esa_ajuste_rrhh` (catálogo a seedear), delta `+`/`-`, motivo obligatorio. Un trigger aplica el delta al marcador + `eventos_ticket`. |
| **8** | **Interrupción de LAO por enfermedad** | Proceso semi-automático. El sistema alerta a RRHH ante la colisión; el humano audita y ejecuta el corte. | **Fase 1:** al detectar solapamiento LAO activa + parte/enfermedad → alerta en bandeja RRHH (sin corte automático). **Fase 2:** recorte LAO, reverso Caso 3, habilitación médica. |

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-16 | Versión inicial — casos 1–8 cerrados con RFC §10 |
