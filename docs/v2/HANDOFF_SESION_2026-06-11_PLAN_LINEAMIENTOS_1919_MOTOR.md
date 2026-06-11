# Handoff — Sesión 2026-06-11 · CIERRE plan lineamientos Decreto 1919/89 y motor de solicitudes

**Estado:** **sesión de planificación CERRADA** (`master` documental sincronizado). **Épica abierta:** Fase 0 = redactar `LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`; sin código de motor en esta sesión.  
**Commit cierre:** `0cfb889` · push `origin/master` (continuidad multi-PC).  
**Índice RETOMAR AQUÍ:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) (bloque épica 1919 / motor licencias).  
**Plan maestro:** [`PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md`](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md).

**Contexto previo misma fecha:** [`HANDOFF_SESION_2026-06-11_CIERRE_CAMINO_B_PERIFERICO.md`](./HANDOFF_SESION_2026-06-11_CIERRE_CAMINO_B_PERIFERICO.md) (capabilities GSO — independiente de esta épica).

---

## 1. Resumen ejecutivo

| Tema | Decisión |
|------|----------|
| **Objetivo** | Mapear cada artículo del Decreto 1919/89 relevante para licencias/franquicias/justificaciones al configurador (`cfg_articulos` + versión 7 bloques) y a los motores A/B/C, para validar solicitudes y proyectar grilla operativa. |
| **Entrega inmediata** | Plan en repo (este handoff + plan); **no** se redactó aún `LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md` artículo por artículo. |
| **Formato normativo en MD** | Resumen operativo por artículo + enlace SIN provincial (no pegar PDF completo). |
| **Motores hoy** | LAO (A), 64-A/B (B), 68-B (C); resto normativa = configuración y/o RFC futuro. |
| **Próximo paso código** | Tras completar Fase 0 doc: motor B administrativo (justificaciones Art. 63, etc.) + impacto `vistas_grilla_mes_agente`. |

---

## 2. Documentos de referencia (no duplicar)

| Documento | Uso |
|-----------|-----|
| [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) | Contrato 7 bloques y triple capa saldos/vista |
| [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md) | Precedencia decreto / SARH / 8525 |
| [`DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md`](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md) | LAO Art. 40–46 (ya motorizado) |
| [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) | `art_*` piloto LAO, 64-A/B, 68-B |
| [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) | Enrutamiento Patrón A/B/C |
| [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) | Escenarios operativos vs parámetros |

---

## 3. Brechas de schema priorizadas (para RFC)

1. **Art. 14** — tramos 35+35+resto con distinto % haberes (tres `art_*` o `topes[]` + variantes SARH).
2. **`cfg_ambito_consumo`** — carrera administrativa y por episodio/enfermedad (Arts. 17, 23).
3. **Plazos procesales en horas** (comunicación 2 h, 72 h) — SLA/eventos, no cupo de saldo.
4. **Grilla horaria** — Arts. 65–69 ter (lactancia, compensación franja, 70 bis).
5. **Ayuda al solicitante** — campos `texto_ayuda_*` o módulos JS por familia normativa.

---

## 4. Backlog sugerido altas RRHH (orden)

1. Art. **63** (justificaciones frecuentes: duelo, donación sangre, concursos, día preventivo).
2. Art. **52** matrimonio, **54** exámenes.
3. Arts. **34–39** maternidad / guarda.
4. Bloque médico **14–23** (caja negra + workflow).
5. Franquicias horarias **65–70 bis**.

Plantilla operativa: [`GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md`](./GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md).

---

## 5. Cómo retomar en otra PC

```text
git pull origin master
```

1. Leer este handoff y [`PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md`](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md).
2. Ejecutar checklist **md-lineamientos** (redactar `LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`).
3. No iniciar cambios de motor hasta cerrar Fase 0 documental o RFC explícito para extensiones §3.

**Rama sugerida próxima implementación:** `feat/lineamientos-1919-motor-solicitudes` (crear al empezar código o doc masivo).

---

## 6. Cierre de sesión (checklist)

| Ítem | Estado |
|------|--------|
| Análisis normativo vs schema / motores A·B·C | ✅ registrado en plan |
| Brechas schema priorizadas (RFC) | ✅ §3 |
| Backlog altas RRHH ordenado | ✅ §4 |
| Plan + handoff en `docs/v2/` | ✅ |
| `git push origin master` | ✅ |
| Fichas por artículo (`LINEAMIENTOS_…md`) | ⏳ próxima sesión |
| Código motor / grilla | ⏳ tras Fase 0 doc |

**Nada pendiente de commit local** al cerrar esta sesión salvo el bloque documental de cierre (este §6).

---

## 7. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-11 | Planificación decreto 1919 vs motores; plan + handoff en repo; push `0cfb889`. |
| 2026-06-11 | Cierre sesión planificación; épica Fase 0 doc queda como RETOMAR en índice. |
