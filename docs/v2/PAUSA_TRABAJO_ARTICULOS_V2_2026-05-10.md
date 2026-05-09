# Pausa de trabajo — Módulo Artículos / configuración V2

**Registro:** 9 de mayo de 2026 (fin de jornada). **Continuar:** 10 de mayo de 2026 o siguiente ventana.  
**Rama Git:** `feature/articulos-motor-plazos` (tracking `origin/feature/articulos-motor-plazos`).

---

## 1. Resumen ejecutivo

Quedó implementado el **núcleo del ABM de artículos** en la app web (`ArticuloFormConfig`), **helpers y validación** centralizados, **persistencia Firestore** para `cfg_articulos`, **reglas de seguridad** desplegadas, **allowlist de callables** ampliada para catálogos del formulario General, **menú portal** con entrada “Artículos”, **ESLint** limpio en `web/`, y **despliegue** a Firebase (Functions + Firestore rules en intento exitoso posterior).

---

## 2. Despliegues Firebase (ejecutados en esta sesión)

| Comando | Resultado |
|---------|-----------|
| `npm run firebase:deploy:functions` | OK — incluye `listarColeccion` con constantes actualizadas. |
| `npm run firebase:deploy:firestore` | 1.er intento falló (API transitoria); **2.º intento OK** — rules + índices publicados. |

**Proyecto:** `portal-hospital-v2`. Consola: https://console.firebase.google.com/project/portal-hospital-v2/overview

---

## 3. Reglas Firestore (`firebase-v2/firestore.rules`)

- Función **`isRrhhOrAdmin()`:** `request.auth.token.portal_role == 'rrhh' || 'admin'` (minúsculas).
- **`match /cfg_articulos/{articuloId}`:** `read`, `create`, `update` si `isRrhhOrAdmin()`; **`delete: false`** (baja lógica con `activo`).
- Ubicación: **antes** de `match /{document=**}` (catch-all deny).

---

## 4. Cloud Functions — allowlist RRHH (`functions/modules/shared/constants.js`)

Añadidas a **`CFG_COLECCIONES_RRHH`** para `listarColeccion` desde el orquestador:

- `cfg_tipo_articulo`
- `cfg_unidad_medida_articulo`

(`cfg_tipo_acto_designacion` ya estaba; se usa como catálogo **provisional** para `norma_principal_tipo_id` en UI hasta colección dedicada.)

**Requisito post-pausa:** si se agregan más colecciones para otras pestañas, repetir patrón: constantes + redeploy Functions.

---

## 5. Web — rutas y navegación

| Archivo | Cambio |
|---------|--------|
| `web/src/App.jsx` | Ruta `RoleGuard`: `/portal/rrhh/configuracion-articulos/:articuloId?` → `ArticuloFormConfig`. |
| `web/src/constants/modulosEstado.js` | Módulo `articulos-cfg` (“Artículos”), path `/portal/rrhh/configuracion-articulos`; `resolverTabPorPath` prioriza esta ruta antes del prefijo genérico `/portal/rrhh`. |
| `web/src/components/layout/BottomNavigationBar.jsx` | Icono `articulos-cfg`; visibilidad **solo** con `canManagement` (mismo criterio que ítem “RRHH”). |

---

## 6. Web — persistencia y utilidades

| Ruta | Rol |
|------|-----|
| `web/src/services/articulosCfgService.js` | `CFG_ARTICULOS_COLLECTION`, `crearArticuloCfg`, `actualizarArticuloCfg`, `obtenerArticuloCfgPorId`, `stripUndefinedDeep`, timestamps `serverTimestamp()`. |
| `web/src/utils/generarId.js` | `generarArticuloId()` (`art_` + `ulid`). |
| `web/package.json` | Dependencia `ulid` en `web/`. |
| `web/src/utils/articulos/` | Ver §7. |
| `web/src/utils/licencias/plazos.js` + `plazos.test.js` | Motor de plazos + Vitest (`web/vite.config.js` bloque `test`). |

---

## 7. Web — paquete `web/src/utils/articulos/`

| Archivo | Contenido |
|---------|-----------|
| `articuloFormKeys.js` | Claves permitidas `field` / `section` / prohibidas. |
| `articuloFormNormalize.js` | `getNormalizedTitleForDuplicado`, prefijo `[COPIA]`. |
| `articuloFormInitialState.js` | `createInitialArticuloFormState()` (semillas Zod-ready). |
| `articuloFormDuplicate.js` | `applyDuplicacionLimpia`. |
| `articuloFormUpdate.js` | `createArticuloFormUpdate` (`field`, `section`, `variante`). |
| `articuloFormValidation.js` | Doble puerta: `canPublishArticulo`, readiness, flatten borrador, mensajes publicable. |
| `articuloCfgSnapshot.js` | `articuloCfgDocToFormState` (timestamps fuera, fechas Timestamp → ISO). |
| `mapCatalogoRowToOption.js` | `{ value, label }` resiliente desde filas catálogo. |
| `articuloForm.test.js` | Tests Vitest del paquete. |
| `index.js` | Reexports. |

---

## 8. Web — UI configuración artículos

| Ruta | Rol |
|------|-----|
| `web/src/components/configuracion/ArticuloFormConfig.jsx` | Orquestador: estado, tabs, botones, Zod, duplicar, persistencia, hook catálogos → `GeneralTab`. |
| `web/src/components/configuracion/ArticuloFormReadinessBadge.jsx` | Semáforo readiness (solo publicable) + panel. |
| `web/src/components/configuracion/hooks/useArticuloGeneralCatalogos.js` | `Promise.allSettled` sobre 3 colecciones; estados por clave. |
| `web/src/components/configuracion/tabs/GeneralTab.jsx` | Bento: Identidad, Normativa, Clasificación, Vigencia; selects con carga/error/vacío; `update.field`. |
| `web/src/components/configuracion/tabs/*.jsx` (resto) | Stubs (Elegibilidad, Plazos, Workflow, Documentación). |

---

## 9. Limpieza ESLint (fuera del módulo artículos)

Archivos tocados para **`npm run lint`** en verde: `RouteGuards.jsx`, `MvpAccessGate.jsx`, `useAntiguedadPage.js`, `AntiguedadResultadoCard.jsx`, `DatosLaborales.jsx`, `DatosPersonales.jsx`, `NotificacionesEventosDatosPersonalesRRHH.jsx`, `DdjjFields.jsx`.

---

## 10. Documentación de diseño previa

- `docs/v2/SESION_ARTICULO_FORM_CONFIG_ORQUESTADOR_V2.md` — decisiones de producto/contrato (sigue válido; §8 “pendientes” **parcialmente obsoleto**: persistencia y rules **ya** hay MVP).

---

## 11. Cómo retomar mañana (checklist)

1. **Probar en navegador** con rol `rrhh` o `admin`: menú **Artículos** → formulario → **Guardar** / **Publicar** (doble Zod) → **Duplicar**.
2. **Pestañas pendientes de contenido real:** Elegibilidad (`section` + filtros), Plazos (campos raíz), Workflow, **Documentación** (simulador con `web/src/utils/licencias/plazos.js`).
3. **Variantes SARH** en UI (tab o bloque): solo hoy está en estado inicial semilla; edición 1:N con `update.variante`.
4. **Catálogo dedicado** para `norma_principal_tipo_id` (reemplazar provisional `cfg_tipo_acto_designacion`) cuando exista colección en `DICCIONARIO_CFG_ARTICULOS_V2.md` + allowlist.
5. **Lista / buscar artículos** para abrir por `articuloId` y “Duplicar desde otro origen”.
6. **RFC/docs** si se amplía schema o colecciones nuevas.

---

## 12. Comandos útiles (desarrollo)

```bash
npm run dev:web          # raíz del repo
npm run test --prefix web
npm run lint --prefix web
npm run firebase:deploy:firestore   # raíz
npm run firebase:deploy:functions   # raíz
```

**URL formulario:** `https://<host>/portal/rrhh/configuracion-articulos` (o con `:articuloId`).

---

## 13. Git (post-pausa)

Tras este registro se debe ejecutar **commit** con mensaje claro y **push** a `origin/feature/articulos-motor-plazos` (o la rama que el equipo defina).
