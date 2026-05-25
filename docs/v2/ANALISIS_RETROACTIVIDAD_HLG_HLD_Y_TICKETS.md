# Analisis futuro: retroactividad laboral (HLG/HLD) y tickets

Fecha: 2026-05-06  
Estado: borrador de analisis (pendiente cierre funcional)

## Contexto de trabajo

Se analiza la unidad minima de informacion laboral operativa en V2 y su impacto en cambios retroactivos sobre:

- `historial_laboral_grupos` (`hlg_*`)
- `historial_laboral_datos` (`hld_*`)
- Consumo por Ticket y auditoria (`eventos_ticket`)

## Hipotesis de base (a validar)

- Unidad operativa efectiva: fila `hlg_*` vigente en fecha (anclada en cadena `hlc -> hld -> hlg`).
- Unidad contractual/legal: `hlc_*`.
- Unidad tecnica intermedia: `hld_*`.

## Caso principal: modificar un HLG vigente

Cambios tipo:

- `fecha_fin`
- `carga_por_dia_semana` (o carga total derivada)
- funcion/rol operativo aplicable
- `nivel_jerarquico`

### Criterio propuesto

No pisar historico. Aplicar patron por fecha efectiva:

1. Cerrar tramo anterior (`fecha_fin`).
2. Crear nuevo tramo con `fecha_inicio` de aplicacion.
3. Registrar evento de auditoria (`evt_*`) con actor, fecha, motivo.

## Pregunta abierta clave: impacto en tickets ya procesados

Escenario ejemplo: hoy se corrige un grupo con efecto retroactivo a 5 dias atras.

Pendiente definir politica:

- Reproceso nulo (solo metadatos).
- Reproceso parcial por ventana y entidad afectada.
- Reproceso total excepcional (solo cambios estructurales).

### Riesgos identificados

- Alterar estados ya comunicados/cerrados.
- Coste operativo alto por recalculo global.
- Inconsistencias si no hay idempotencia y bitacora de reconciliacion.

### Linea sugerida

- Reconciliacion incremental acotada (persona/grupo/rango de fechas).
- Congelar tickets cerrados definitivos y generar ajustes explicitos.
- Trazabilidad obligatoria de reproceso (que cambio, por que, quien, cuando).

## Deshabilitar sin borrar (auditoria)

Analizar comportamiento para:

- `hlg_*` vigente
- `hlc_*` vigente
- registros cerrados/historicos

Preguntas a cerrar:

1. Si se deshabilita un vigente, ¿es obligatorio habilitar uno nuevo para continuidad?
2. Si se deshabilita un historico, ¿se reemplaza o solo se anula logicamente con evento?
3. ¿Que validaciones bloquean superposiciones ambiguas por mismo periodo?

## Proximo paso propuesto

Armar matriz de decision formal:

- Accion
- Obligatorios
- Bloqueantes
- Impacto Ticket
- Politica de reproceso
- Auditoria requerida

Objetivo: anexar al contrato V2 para implementar Callables sin ambiguedad.
