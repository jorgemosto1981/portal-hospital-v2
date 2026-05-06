# Decreto 1919/89 — Antigüedad y LAO (V2)

Documento de referencia funcional para futuras implementaciones de Ticket/Solicitudes (Art. 40 LAO) en V2.

## 1) Fuente normativa base

- Decreto 1919/89 (Régimen de Licencias, Justificaciones y Franquicias).
- Art. 40: LAO determinada por antigüedad al 31/12 y escala de días.
- Art. 46: para proporcional, se considera mes completo la fracción mayor de 15 días.

## 2) Reglas de antigüedad base (motor V2)

- Ancla por `persona_id`.
- Antigüedad laboral por HLC:
  - Se toman tramos (`fecha_inicio`/`fecha_desde` a `fecha_fin`/`fecha_hasta`).
  - Se topa cada tramo por fecha de corte.
  - Se fusionan superposiciones para evitar doble conteo.
  - Resultado base en días reales.
- Antigüedad reconocida externa:
  - Se guarda por persona como reconocimiento con normativa y `fecha_impacto`.
  - Solo aplica si `fecha_impacto <= fecha_corte`.
  - No hay retroactividad si la fecha de impacto es posterior al corte.

## 3) LAO Art. 40 (criterio de aplicación acordado)

### 3.1 Determinación de escala anual

- Para LAO del año `N`, se determina antigüedad al corte del año que corresponda al cálculo operativo definido por RRHH.
- La escala de días anuales se toma del Art. 40.
- Ejemplo operativo consensuado en chat:
  - Si para el año de cálculo corresponde escala de 20 días/año, el proporcional parte de ese valor.

### 3.2 Restricción operativa hospitalaria (acuerdo interno)

- Para solicitudes LAO del año en curso, el hospital permite tomar proporcional solo desde 01/07 en adelante.

### 3.3 Fórmula proporcional (acuerdo)

- `dias_mes = dias_anuales_escala / 12`
- `proporcional = dias_mes * meses_computables`
- Meses computables según Art. 46:
  - fracción de mes mayor a 15 días => suma 1 mes
  - fracción de mes de 15 o menos => no suma mes

Ejemplos acordados:

- Pedido 14/07: computa 6 meses.
- Pedido 16/07: computa 7 meses (por fracción > 15 días).

> Nota: este documento registra criterio funcional acordado para V2. Antes de implementación final de Ticket/Solicitudes, validar con RRHH si la base temporal del proporcional se computa desde enero o desde la ventana habilitada por política interna.

## 4) Principio de cálculo y auditoría

- Decisión de elegibilidad: siempre sobre días calculados (sin redondeos implícitos fuera de norma).
- Vista de usuario: se puede mostrar desglose en años/meses/días, pero la verdad de negocio es el total en días.
- Toda respuesta de cálculo debe detallar:
  - HLC consideradas (con fechas y conteo),
  - intervalos fusionados,
  - externos aplicados/excluidos y motivo.

## 5) Estado actual V2

- Existe pantalla RRHH `Antigüedad` para:
  - calcular por persona y fecha de corte,
  - guardar antigüedad reconocida externa,
  - visualizar desglose detallado.
- Este documento queda como referencia para incorporar luego la lógica de Ticket/Solicitudes Art. 40.
