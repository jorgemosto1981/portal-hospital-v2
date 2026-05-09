# Sesión — Orquestador `ArticuloFormConfig` y contrato de actualización (V2)

**Fecha de registro:** 9 de mayo de 2026.  
**Estado:** decisiones de diseño vigentes. **Implementación base ya avanzada** — ver cierre y checklist en [`PAUSA_TRABAJO_ARTICULOS_V2_2026-05-10.md`](./PAUSA_TRABAJO_ARTICULOS_V2_2026-05-10.md).

---

## 1. Contexto previo ya cerrado

- **Motor de plazos:** `web/src/utils/licencias/plazos.js` con tests en `plazos.test.js` (Vitest), casos: laborables, feriados globales/efector, multi-efector OR, robustez con `null`/arrays vacíos.
- **Validación de documento:** `web/src/schemas/articulo.schema.js` — `cfgArticuloBorradorSchema`, `cfgArticuloPublicableSchema` (incluye ≥1 variante SARH con `activo: true` para publicar).
- **MVP persistencia:** escritura **Firestore directa** con validación Zod previa; Callable reservado para lógica futura compleja.
- **Simulador de plazos:** en **Documentación** como ayuda visual (fecha → vencimiento); no sustituye datos reales de feriados sin dejar claro el alcance en UI.

---

## 2. Duplicación (“Duplicación limpia”)

- Cargar JSON del artículo origen en estado del formulario de **artículo nuevo** (sin `id` hasta guardar; nuevo `art_<ULID>` al persistir).
- **Identidad:** eliminar `id`; **`titulo`** con prefijo `[COPIA]` vía **`getNormalizedTitle(title)`** (idempotente: no duplicar prefijo si ya existe).
- **Vigencia:** `vigente_desde`, `vigente_hasta` → `null`.
- **`activo`:** forzar `false` en el clon.
- **Auditoría / timestamps:** cliente **no** envía `creado_en` / `actualizado_en` al crear duplicado; **servicio de persistencia** con `serverTimestamp()` en create/update.
- **`actualizado_por_persona_id`** (y afines): reemplazar por usuario actual al primer estado del duplicado según contrato de datos.
- **`version`:** reset al valor inicial acordado para documento nuevo.
- **Publicación / flags:** cualquier flag de “publicado” o snapshot vuelve a estado **borrador** según campos que existan en schema.
- **`metadata`:** clon **total** por ahora; lista de claves de sistema **futura** para excluir al duplicar.

---

## 3. Estado inicial del formulario (“Zod-ready”)

- **No** iniciar con `{}` vacío.
- Estado inicial = **esqueleto mínimo** que cumple restricciones del borrador (p. ej. `variantes_sarh` con ≥1 elemento).
- **Semillas** en campos con `.min(1)` en Zod: usar textos placeholder que **pasen** validación (ej. “Nuevo Artículo”, etiquetas SARH), **no** `''`, para formulario “vivo” y errores visibles sin crash.
- Ajustar semillas a reglas numéricas/porcentajes del schema (ej. SARH 0–100).

---

## 4. Contrato de actualización (`update`) — versión final acordada

- **`update.field(key, value)`:** todas las claves de **primer nivel** que sean primitivas o **arrays de IDs simples** (reemplazo inmutable del array completo). **Excluye** explícitamente `variantes_sarh`, `filtros_elegibilidad`, `metadata` del uso incorrecto (no pasar `variantes_sarh` por aquí).
- **`update.section(key, patch)`:** **solo** fusión para objetos que requieren merge: **`filtros_elegibilidad`**, **`metadata`**.
- **`update.variante(index, patch)`:** exclusivo para **`variantes_sarh`** (motor 1:N).
- **Arrays de IDs** (ej. `articulos_incompatibles_ids`): convención **reemplazo total** vía `field`; la tab gestiona el borrador local del array y despacha el array entero al orquestador.

Tipado: union literal de claves permitidas alineada a `cfgArticuloBorradorSchema`; rutas string libres evitadas donde había riesgo de typo.

---

## 5. Validación dual y UX (“semáforo” / readiness)

- **Inputs / borrador:** errores en rojo según **`cfgArticuloBorradorSchema`** (formato, tipos, coherencia de borrador).
- **Readiness normativo:** badge de diagnóstico basado en **`cfgArticuloPublicableSchema`** (completitud para “salir a la calle”), p. ej. gris “Pendiente de completar” vs verde “Listo para publicar” al cumplir solo el criterio publicable.
- **Popover / panel** al interactuar con el badge: lista de issues del publicable (ej. falta tipo de artículo, sin variante SARH activa).
- **Botón “Publicar” habilitado solo si:**  
  `publicableSchema.safeParse(data).success === true` **Y** `borradorSchema.safeParse(data).success === true`.  
  El badge puede estar verde en readiness mientras el botón siga deshabilitado si el borrador falla; mitigar con **copy** explícito junto al botón para no parecer bug.

---

## 6. Estructura de UI prevista

- **Carpeta:** `web/src/components/configuracion/tabs/`.
- **Stubs:** `GeneralTab`, `ElegibilidadTab`, `PlazosTab` (parámetros normativos/plazos), `WorkflowTab`, `DocumentacionTab` (incluye **simulador** de plazos documentales).
- **Orquestador:** `ArticuloFormConfig.jsx` — layout Bento (fondo `slate-50`, tarjeta blanca `rounded-3xl` `shadow-xl`), header con título dinámico y botonera (Guardar, Publicar, Duplicar, Deshabilitar según producto), tabs superiores.
- **Props hacia tabs (contrato):** `data` (documento completo), `update` (objeto con `field`, `section`, `variante`), `errors` derivados del **borrador** para inputs.

---

## 7. Fuentes de verdad

- Schema y colección: `docs/v2/MODULO_CONFIGURACION_ARTICULOS_V2.md`, `DICCIONARIO_CFG_ARTICULOS_V2.md`, `web/src/schemas/articulo.schema.js`, `web/SCHEMA.md` cuando aplique.
- Reglas Firestore y rol RRHH deben alinearse con el mismo shape que valida Zod antes del write.

---

## 8. Pendientes / seguimiento (actualizado)

- ~~Servicio de persistencia~~ y ~~rules `cfg_articulos`~~: **hecho** (ver pausa).
- Textos finales de accesibilidad (badge, popover, teclado).
- Lista futura de claves `metadata` a excluir en duplicación.
- Tabs restantes, SARH en UI, simulador documentación, lista de artículos — ver [`PAUSA_TRABAJO_ARTICULOS_V2_2026-05-10.md`](./PAUSA_TRABAJO_ARTICULOS_V2_2026-05-10.md).
