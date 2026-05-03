# Piloto: parámetros de UX, filtros y ABM — **Datos personales** (`/portal/perfil`)

**Estado:** referencia de producto / implementación por fases.  
**Alcance:** **solo esta pantalla** como laboratorio; lo acordado aquí se replica después en Laboral, Grilla, RRHH, etc.

---

## 1. Objetivo del piloto

Fijar **reglas únicas** sobre:

- Qué significa **ABM** en cada **sub-módulo** (colección o tipo de ficha).
- **Filtros** obligatorios y opcionales (incl. ventana temporal donde aplique).
- **Estado en URL** para recuperar contexto al volver atrás.
- **Listados** (paginación, carga progresiva) frente al modelo actual de “traer todo”.
- **Roles** alineados al plan **HLc-only** + **RRHH** explícito en esta pantalla (`portal_role` / `perfil_rol_id` como hoy).

---

## 2. Inventario funcional actual (resumen)

| Ámbito | Comportamiento hoy (código) |
|--------|-----------------------------|
| **Ruta** | `/portal/perfil` — solo legajo propio salvo RRHH elija `persona_id`. |
| **Carga** | Paralela de **todas** las colecciones base + cfg al montar (`listarColeccionPersonal` por colección). |
| **Tipos** | Selector `tipo`: personas, formacion_agente, declaraciones_grupo_familiar, consentimientos, eventos_ticket (+ datos de catálogo en memoria). |
| **Usuario no RRHH** | Campos sensibles de `personas` bloqueados; flujos “informar cambio domicilio / teléfonos”; posible **notificación** a RRHH en lugar de ABM directo. |
| **RRHH** | Puede editar campos que el agente no; elige `persona_id` entre filas cargadas. |

---

## 3. Matriz ABM por sub-módulo (reglas de negocio a validar)

Convención:

- **A** = Alta (crear registro nuevo en la colección).
- **M** = Modificación (editar existente).
- **B** = Baja — especificar siempre **tipo**: física, **lógica** (activo=false, vigencia cerrada), o **no permitida**.

| Sub-módulo / colección | Agente (usuario) | RRHH | Notas |
|------------------------|------------------|------|--------|
| **personas** | M parcial (según acción habilitada); A/B según política (normalmente **sin alta** desde portal; **baja lógica** solo RRHH) | A/M/B según callable | Alto impacto legal; B casi siempre **lógica** o estado `activo`. |
| **formacion_agente** | A/M de **sus** registros si producto lo permite | A/M/B ampliado | B: preferir desactivar o vigencia. |
| **declaraciones_grupo_familiar** | A/M con versión incrementada | Igual + otros titulares | Convivencia de versiones DDJJ. |
| **consentimientos** | A/M (firma / renovación) | Revisión / corrección | Baja rara; nuevas versiones de texto legal. |
| **eventos_ticket** | Lectura / disparo de **evento** según flujo | Gestión | Aquí sí tiene sentido **filtro temporal** (fecha del evento). |

**Parámetro piloto:** ninguna pantalla muestra botón **Eliminar** hasta definir **tipo de baja** y callable en Functions; por defecto **sustituir por “Dar de baja / Anular”** con confirmación y auditoría.

---

## 4. Parámetros de filtros (Datos personales)

### 4.1 Siempre presentes

| Parámetro | Descripción | Persistencia sugerida |
|-----------|-------------|------------------------|
| **`persona_id`** | Titular del legajo que se edita/consulta | Query `?persona_id=` cuando RRHH elija otra persona que la del token; si coincide con claim, puede omitirse. |
| **`tipo`** | Colección / pestaña activa (equivalente al selector actual) | Query `?tipo=formacion_agente` etc. |

### 4.2 Condicionales

| Parámetro | Cuándo | Notas |
|-----------|--------|--------|
| **Ventana de fechas** | Solo en vistas donde exista campo fecha relevante listado (p. ej. **eventos_ticket**, eventualmente histórico de consentimientos) | Default: **mes en curso**; máximo retrospective según rol (agente vs RRHH) definido en servidor. |
| **Texto libre** | Búsqueda por id parcial o descripción | Solo si el listado supera umbral (ver §5). |

### 4.3 No aplican por naturaleza

- Filtro temporal global sobre **cfg_*** cargados para combos: son catálogos maestros; la política de “mes actual” **no** aplica al mismo criterio que tickets.

---

## 5. Listados, paginación y rendimiento

**Situación actual:** se cargan **todas** las filas por colección para armar combos y tablas.

**Parámetros piloto para evolución:**

1. **Umbral N** (ej. 200 filas): por encima, **paginar** o **buscar server-side** en el callable de listado.
2. **Primera pintura:** cargar solo **`personas`** + **`cfg_*` mínimos** para el `tipo` seleccionado; el resto **lazy** al cambiar pestaña o al expandir sección.
3. **Progreso:** mantener feedback de carga por colección (ya hay patrón de `progressByCol`) como estándar visual reutilizable.

---

## 6. Estado en URL (contrato mínimo)

**Implementado (fase 1):** `?tipo=` y, para **RRHH**, `?persona_id=per_…` se leen y escriben en `/portal/perfil` (sincronizados con el selector de colección y el filtro de persona). El agente no debe usar `persona_id` en URL para saltarse otro legajo: solo RRHH aplica el valor de query al estado.

Ejemplo estable para compartir y refrescar sin perder contexto:

```text
/portal/perfil?tipo=consentimientos&persona_id=per_XXXX
```

Pendiente de otras fases (fechas en listados de eventos, etc.):

```text
/portal/perfil?tipo=eventos_ticket&desde=2026-05-01&hasta=2026-05-31
```

Reglas:

- Parámetros **desconocidos** se ignoran (no rompen la vista).
- Al cambiar `tipo`, resetear filtros que no aplican (p. ej. fechas al salir de `eventos_ticket`) — *pendiente cuando exista `tipo=eventos_ticket` en el selector*.
- **No** persistir PIN ni datos sensibles en query.

---

## 7. Patrones UI (replicables)

| Patrón | Uso en piloto |
|--------|----------------|
| **Barra de contexto** | Muestra `persona_id` activo + rol efectivo (derivado HLc cuando exista). |
| **Acciones ABM** | Barra superior del bloque de lista: **Nuevo**, **Editar** (requiere selección), **Baja lógica** con modal. |
| **Móvil** | Filtros secundarios (fechas, búsqueda) en **drawer**; desktop en línea o panel lateral. |
| **Vacíos** | Estado vacío con CTA “Crear primer registro” solo si **A** está permitido para ese rol. |

---

## 8. Checklist para pasar de piloto al resto de pantallas

Cuando Datos personales cumpla lo acordado arriba, copiar este bloque por pantalla:

- [ ] Matriz ABM por entidad con tipos de baja.
- [ ] Lista de parámetros de URL obligatorios/opcionales.
- [ ] Campo fecha canónico por listado (si existe).
- [ ] Política de paginación / lazy en Functions + índices Firestore.
- [ ] Drawer de filtros en móvil para esa pantalla.
- [ ] Prueba de rol: agente vs RRHH vs (futuro) jefe/visualizador según HLc.

---

## 9. Decisiones pendientes de negocio (fuera de código)

1. ¿El agente puede **eliminar** formación o DDJJ o solo **anular / nueva versión**?
2. ¿`eventos_ticket` en esta pantalla es solo lectura para el agente o puede **crear** eventos?
3. ¿Límite de retrospectiva en días para **eventos** para no-agente?

---

## 10. Referencias en código

- Pantalla: `web/src/pages/DatosPersonales.jsx`
- Constantes y colecciones: `web/src/pages/datos-personales/constants.js`
- Servicio listado/guardado: `web/src/services/datosPersonalesService.js`
- Callable backend: `functions/modules/catalogosPersonales.js` (reglas por rol)
