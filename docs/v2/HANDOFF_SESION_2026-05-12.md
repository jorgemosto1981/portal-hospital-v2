# Handoff de sesión — 2026-05-12

## Resumen

Sesión en **rama `feature/articulos-v2-triple-layer`**: estabilizar **panel de configuración de versión de artículos** (`cfg_articulos/{art_*}/versiones/{ver_*}`), **catálogos en BD**, **reglas Firestore**, **persistencia sin `undefined`**, y **UX de ayuda contextual**. Se validó **guardado atómico** (versión + puntero `version_actual_id` en núcleo) y se **desplegaron reglas** al proyecto Firebase `portal-hospital-v2`.

**Nota:** En local quedó un **stash** sobre `feature/articulos-v2-reborn` (pantalla Artículos en menú de esa rama). Esta sesión consolidó el trabajo en **triple-layer**; revisar stash antes de fusionar ramas.

---

## 1) Git y rama

| Item | Valor |
|------|--------|
| Rama activa al cerrar | `feature/articulos-v2-triple-layer` |
| Tracking | `origin/feature/articulos-v2-triple-layer` |
| Base conocida en sesión | commit `804befb` — *feat(articulos-v2): panel cfg versión, seeds catálogos, rules, functions* |
| Stash pendiente | `stash@{0}`: *wip: pantalla articulos local* (rama `feature/articulos-v2-reborn`) |

---

## 2) Cambios de código (web)

### 2.1 `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx`

- Ayuda por pestaña (`TAB_HELP`) y **microayudas** en campos (`helpText`).
- **Selects** enlazados a Firestore vía `useCatalogosArticulos` / `listarColeccion` para IDs de catálogo (no texto libre donde aplica):
  - `estado_version_id` → `cfg_estado_version_articulo`
  - `justifica_sueldo_id` → `cfg_justifica_sueldo`
  - `regla_computo_dias_id`, `ambito_consumo_id`, `regla_computo_horas_id`, `reinicio_ciclo_id`, `accion_saldo_id`, `origen_saldo_id`
  - `caducidad_tipo_id` → `cfg_tipo_acumulacion` (convención del seed vigente; RFC posible a catálogo dedicado de caducidad)
  - `accion_incumplimiento_doc_id`, `nivel_ocupacion_dia_id`
- Ayuda conceptual en checks y números (identidad, impacto, elegibilidad, workflow, documentación).

### 2.2 `web/src/hooks/useCatalogosArticulos.js`

- Ampliación de `DEFAULT_CATALOGOS_ARTICULOS_FORM` con las colecciones necesarias para los nuevos selects.

### 2.3 `web/src/services/cfgArticuloVersionService.js`

- **Política NULL explícito** antes de `setDoc` / `writeBatch.set`:
  - `deepUndefinedToNull` — recursivo; objetos planos; preserva no planos.
  - `expandArticuloVersionExplicitNulls` — recorre `cfgArticuloVersionSchema`: opcionales ausentes → `null`; subobjetos (`normativa_habilitante`, `visualizacion`) con todas las claves; respeta `ZodDefault`.
  - `buildFirestoreArticuloVersionDoc` — expande + limpia + `schema_contract_version` + `actualizado_en` (`serverTimestamp()`).

**Motivo:** Firestore rechaza `undefined`; error observado en `publicada_en` al guardar borrador.

---

## 3) Base de datos (Firestore proyecto `portal-hospital-v2`)

### 3.1 Catálogos artículos (plan `SEED_CATALOGOS_ARTICULOS_V2.json`)

- Verificación de existencia por colección (`npm run verify:catalogos-articulos-v2`).
- Auditoría semántica (`codigo_interno`, `titulo_ui`, `orden`, `activo`) frente al JSON del plan.
- **Limpieza de 35 documentos extra** (IDs legacy tipo `CFG_*` mayúsculas / duplicados semánticos) para alinear doc IDs al estándar minúscula `cfg_*` del seed.

### 3.2 Convención de IDs de documento

- IDs de filas `cfg_*` en **minúsculas con prefijo**; `codigo_interno` en mayúsculas donde defina producto.

---

## 4) Reglas Firestore y permisos

### 4.1 Deploy de reglas

Ejecutado en esta sesión:

```bash
npx firebase deploy --only firestore:rules --project portal-hospital-v2
```

Archivo fuente: `firebase-v2/firestore.rules`.

### 4.2 Criterio de acceso a `cfg_articulos` y `versiones`

Función `portalArticulosMgmt()` — requiere sesión y uno de:

- `request.auth.token.portal_role == 'rrhh'`
- `request.auth.token.portal_role == 'admin'`
- `request.auth.token.perfil_rol_id == 'CFG_RRHH'`

### 4.3 Claims RRHH (desarrollo / operación)

Script Admin SDK (cuenta de servicio vía `.env.v2.local` → `GOOGLE_APPLICATION_CREDENTIALS`):

```bash
node scripts/dev-set-portal-role-rrhh.mjs <email-o-DNI>
```

Tras asignar claims: **cerrar sesión y volver a entrar** (o renovar token) para que el cliente envíe los claims en las escrituras.

---

## 5) Validación funcional

- Mensaje de éxito del panel: *Versión guardada y version_actual_id actualizado en el núcleo (mismo lote atómico).*
- Ejemplo de documento de versión verificado en consola: bloques embebidos, `publicada_en` / `publicada_por_persona_id` en `null` en borrador, `schema_contract_version` = `v2-triple-layer-2026-05`.

---

## 6) Continuidad sugerida

1. **RFC:** separar `caducidad_tipo_id` de `cfg_tipo_acumulacion` si el dominio normativo lo exige (`cfg_tipo_caducidad` dedicado).
2. **Revisión normativa:** campos sensibles (`depende_rda`, impacto económico, topes) contra Decreto / institucional por artículo.
3. **Stash en `reborn`:** aplicar o descartar según si se unifica la entrada de menú “Artículos” en una sola rama.
4. **Subcolecciones §1.7:** filtros, roles, pasos de workflow — UI o herramientas admin cuando corresponda.

---

## 7) Otra PC — comandos mínimos

```bash
git clone https://github.com/jorgemosto1981/portal-hospital-v2.git
cd portal-hospital-v2
git fetch origin
git checkout feature/articulos-v2-triple-layer
git pull origin feature/articulos-v2-triple-layer
npm install
npm install --prefix web
npm install --prefix functions
```

Copiar **`.env.v2.local`** en la raíz del repo (no versionado), misma política que `HANDOFF_CONTINUIDAD_2026-04-25.md`.

Arranque web:

```bash
npm run dev:web
```

---

## 8) Referencias cruzadas

| Documento | Uso |
|-----------|-----|
| [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) | Contrato matriz / bloques §4 |
| [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md) | Colecciones `cfg_*` y prefijos |
| [`SEED_CATALOGOS_ARTICULOS_V2.json`](./SEED_CATALOGOS_ARTICULOS_V2.json) | Semilla canónica de catálogos |
| [`PROTOCOLO_SEGURIDAD_REVERSION_ARTICULOS_V2.md`](./PROTOCOLO_SEGURIDAD_REVERSION_ARTICULOS_V2.md) | Reversiones controladas |
