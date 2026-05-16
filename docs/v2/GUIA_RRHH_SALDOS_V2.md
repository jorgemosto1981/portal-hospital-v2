# Manual operativo: gestión de saldos universales (rol RRHH)

**Estado:** acordado producto 2026-05-16.  
**Audiencia:** operadores de Recursos Humanos del portal V2.

**Relación:** [`REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md`](./REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md) §8, [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md), [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md), modal en [`AyudaPatronesBolsaModal.jsx`](../../web/src/features/configuracion/articulos/AyudaPatronesBolsaModal.jsx) (**D2 implementado**).

Este documento define las directrices que controlan la interfaz del operador de RRHH en el **modal de gestión de legajos** y en el **configurador de artículos** (pestaña Impacto y Saldo).

---

## 1. La pestaña «Resumen contable RRHH»

A diferencia del agente base (que ve un DTO procesado y simplificado vía `obtenerResumenSaldosAgente`), el operador de RRHH tiene acceso a la **auditoría total del marcador**. La vista de administración debe renderizar:

- **Bolsas activas:** desglose por artículo y año de origen (Patrón A) o ciclo (Patrón B) o global (Patrón C), con `disponible`, `consumido` y `estado_bolsa_id`.
- **Bolsas expiradas / agotadas:** visibles por defecto en una sección colapsable inferior, permitiendo entender el historial contable de los últimos **24 meses** del agente sin forzar llamadas a BigQuery.

**Regla:** RRHH puede leer `saldos_articulo_agente` con rol documentado en [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md); el agente base **no**.

---

## 2. Protocolo de ajustes manuales (herramienta de auditoría)

Cuando se detecte una discrepancia en un saldo (ej. mala carga de antigüedad o corrección de saldos heredados del sistema anterior):

1. **No** se modifican los campos numéricos de `saldos_articulo_agente` de forma libre en consola ni en UI.
2. Se selecciona el artículo, el año de origen de la bolsa (o bolsa global Patrón C) y el delta de días/horas (ej. `+3 días` o `-1 día`).
3. Es obligatorio tipear un texto de justificación (**mínimo 15 caracteres**) que persistirá en la colección transaccional y en `eventos_ticket`.
4. El sistema generará el recibo inmutable `sol_ajuste_rrhh_…` (`estado_solicitud_id: cfg_esa_ajuste_rrhh`) que impactará de forma automática en los totales visuales.

**Límites:** no dejar `disponible` negativo sin política explícita; años LAO con consumo cerrado → preferir anulación quirúrgica (Caso 3) o doble autorización.

---

## 3. Retroactivo sobre bolsa expirada (Patrón B)

Si un agente necesita un permiso de ciclo ya cerrado (ej. 64-A diciembre del año anterior enviado en enero):

| Rol | Comportamiento |
|-----|----------------|
| Agente | Bloqueado si la bolsa está `cfg_esb_expirado` |
| RRHH | Callable con `es_retroactivo: true`, motivo y auditoría |

**Precondición:** debe existir remanente en la bolsa expirada. Si `disponible === 0`, ejecutar primero el protocolo de ajuste manual (§2) antes de abrir la solicitud retroactiva.

---

## 4. Exportación desde el configurador (capacitación)

El modal de ayuda en la card *Configuración de la bolsa de días / horas* (**botón ℹ️**, pestaña Impacto y Saldo) incluye:

| Pestaña | Contenido |
|---------|-----------|
| Guía de configuración | Patrones A/B/C (copy RFC §7) |
| **Resumen para RRHH** | Este documento (resumido) |
| Casos borde | Enlace a [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md) |

Botón **Descargar PDF** / **Imprimir** sobre la pestaña visible (`window.print()` con `@media print` o equivalente). Pie de página: título, fecha de versión del doc y pestaña exportada.

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-16 | Versión inicial — resumen RRHH, ajustes, retroactivo, export PDF |
| 2026-05-16 | D2: modal y export implementados en web (REGISTRO §8) |
