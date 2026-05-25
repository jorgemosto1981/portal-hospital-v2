# Roadmap — Motor LAO V2 (post-checkpoint 2026-05-12)

Documento de **plan técnico** tras el cierre de sesión que consolidó **Paso 0 LAO**, **contrato §7 en MODULO PF**, **guardián de persistencia** y **matriz en UI con barandas** (orden + duplicados). Sirve para retomar en otra máquina o con otro agente sin perder el hilo.

---

## Estado al cierre (checkpoint)

### Hecho (no repetir salvo regresiones)

1. **Núcleo `cfg_articulos`:** sin `es_lao_anual` en raíz; fuente de verdad LAO en versión (`bloque_identidad_naturaleza.es_lao_anual`).
2. **Schema y versión:** `articulo.schema.js` — Bloque 4 LAO (`correspondencia_anio`, `fecha_corte_antiguedad`, `matriz_antiguedad_reglas`), bump de versión de contrato según el repo.
3. **Servicio:** `cfgArticuloVersionService.js` — `applyLaoBloque4Guardian`: si no es LAO, fuerza `null` en campos LAO del Bloque 4 antes de expandir nulls y escribir.
4. **Migración Admin SDK:** `scripts/seed-v2/migrate-step0-lao-identity.mjs` (fases raíz + versiones; `--apply` vs dry-run). Scripts npm en `package.json`: `db:migrate-step0-lao-identity:dry-run` / `db:migrate-step0-lao-identity`.
5. **UI matriz (`ArticuloConfigTabs.jsx`):**
   - `sortMatrizAntiguedadReglas` + orden en cada edición y en `buildVersionPayloadForZod`.
   - `analyzeMatrizAntiguedadReglas`: error si duplicado `(valor_anos, operador_id)`; advertencia si mismo umbral con distintos operadores.
   - Guardado bloqueado con duplicados; ayuda textual del motor “último escalón que cumple”.
   - Select de operadores con labels del catálogo (`cfg_operador_comparacion` vía `useCatalogosArticulos`).
6. **Documentación:** `MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md` — §2.1 núcleo, Bloque 4 + §4.1 LAO (invariante bolsa↔versión, TZ Buenos Aires, tabla Stock/Proporcional/Error).

### Calidad de ingeniería registrada

- Script de migración: sin uso de APIs internas del batch (`_writes`); estable ante upgrades del SDK.
- `npm run build:web` y lints relevantes en verde al cerrar.

---

## Orden de prioridad acordado (próximas fases)

| Orden | Fase | Objetivo | Notas |
|-------|------|----------|--------|
| **1** | **3b — UI** | **DatePicker** (día/mes, año dinámico según diseño) para `fecha_corte_antiguedad` en lugar de solo string ISO; helper claro: vacío → `null` → motor usa default (ej. 31/12 según `obtenerFechaCorteLao` / MODULO). | Archivo principal: `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx`. Reutilizar patrón de componentes existentes si hay date UI en el repo. |
| **2** | **4 — Temporal** | Endurecer **`antiguedadCalculator`** (u homólogo en `shared/`) para **forzar zona `America/Argentina/Buenos_Aires`** en extracción de fechas relevantes, antes de que el motor/callables dependan de UTC del servidor. | Localizar implementación actual en `shared/` o `web/` y alinear con §7 del MODULO. |
| **3** | **5 — Motor** | **Cloud Functions:** bifurcación **Stock** vs **Proporcional** según año de solicitud (BA) vs `anio_origen` de bolsa; proporcional con guardas **01/07**, **TSE ≥ 6 meses**, **floor** de cupo; **FIFO**; sin mezcla incorrecta de bolsas. | Callable preview opcional después de tener datos reales de matriz; triggers desde `solicitudes_articulo` según arquitectura ya descrita en MODULO / DECRETO LAO. |

---

## Instrucción explícita para la próxima sesión

**Continuar por la Fase 3b:** implementar selector de fecha amigable para `fecha_corte_antiguedad` y textos de ayuda alineados al motor. Luego Fase 4 (TZ), luego Fase 5 (Functions).

---

## Referencias de código y docs

| Recurso | Ruta |
|---------|------|
| Panel versión artículo | `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx` |
| Payload + orden matriz | `buildVersionPayloadForZod`, `sortMatrizAntiguedadReglas`, `analyzeMatrizAntiguedadReglas` (mismo archivo) |
| Schema versión | `web/src/schemas/articulo.schema.js` |
| Guardián + save | `web/src/services/cfgArticuloVersionService.js` |
| Catálogo operadores | `cfg_operador_comparacion`; hook `web/src/hooks/useCatalogosArticulos.js` |
| Migración Paso 0 | `scripts/seed-v2/migrate-step0-lao-identity.mjs` |
| Contrato producto | `docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md` |
| Antigüedad / LAO normativo | `docs/v2/DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md` |
| Handoff sesión | `docs/v2/HANDOFF_SESION_2026-05-12.md` |

---

## Otra PC (recordatorio)

```bash
git fetch origin
git checkout feature/articulos-v2-triple-layer
git pull origin feature/articulos-v2-triple-layer
npm install
npm install --prefix web
npm install --prefix functions
```

Variables locales (`.env.v2.local`, credenciales) no van en git; ver handoffs previos y `UNIFICACION_OTRA_PC_Y_TICKET.md`.
