# Anexo normativo — Artículos (Decreto 1919/89, SARH, Ley 8525) — V2

**Propósito:** fijar **jerarquía de fuentes**, **rol de cada norma** en el producto y **reglas de trazabilidad** para el módulo de configuración de artículos y solicitudes. No sustituye el texto legal; los PDF oficiales y la práctica SARH son la referencia de RRHH.

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador**.

---

## 1. Orden de precedencia para interpretación de reglas

1. **Decreto 1919/89** — núcleo del régimen de licencias y franquicias objeto del portal.
2. **SARH** — tabla/listado operativo de **códigos** y práctica de carga (puente hacia sistemas y RRHH).
3. **Ley 8525/79** — marco del agente público provincial; complemento para **disciplina**, **procedimientos** y coherencia institucional donde el decreto no detalle un punto.

Si hay conflicto aparente entre normas del mismo nivel, se documenta **decisión institucional explícita** con vigencia (campo de política / documento de acuerdo), no “solución” en código sin registro.

---

## 2. Rol del SARH frente al decreto

- Un **mismo** artículo o inciso del decreto puede corresponder a **varias** variantes operativas SARH (relación **1:N**).
- La configuración debe permitir:
  - **`variantes_sarh[]`** embebidas en `cfg_articulos` cuando las reglas base son compartidas y solo cambian datos como **código** o **afectación de sueldo** (`afecta_sueldo_porcentaje`).
  - **Varios documentos `art_<ULID>`** cuando cambian workflow, impacto sustantivo o reglas no representables como variante.

---

## 3. Rol de la Ley 8525

- Uso típico: **inasistencias**, **sanciones**, **deberes** y **derechos** generales que contextualizan la gestión de ausencias.
- No reemplaza la definición por decreto/SARH del **tipo de licencia** o **franquicia** concreta.

---

## 4. Trazabilidad obligatoria en datos de configuración

Para cada artículo en `cfg_articulos`, la especificación operativa debería poder indicar:

- **Fuente primaria** (decreto / SARH / ley / política institucional).
- **Referencia** (artículo, inciso, código SARH).
- **Vigencia** de la definición (`vigente_desde`, `vigente_hasta`, `activo`).

---

## 5. Documentos V2 relacionados

| Documento | Uso |
|-----------|-----|
| [`LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`](./LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md) | Índice y fichas por artículo (Fase 0 configurador / motor) |
| [`DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md`](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md) | Antigüedad, LAO, contexto ticket |
| [`LEY_8525_1979_EGAP_SANTA_FE_V2.md`](./LEY_8525_1979_EGAP_SANTA_FE_V2.md) | Marco EGAP (referencia consulta) |
| [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) | Contrato funcional del módulo |
| [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) | Escenarios → parámetros |

---

## 6. Pendiente de inventario

Cuando RRHH disponga del **listado SARH vigente** y del **mapeo** a artículos del decreto, completar una tabla de trazabilidad **código SARH ↔ fragmento normativo** en una revisión de este anexo (sin semillas automáticas contra producción salvo proceso acordado).
