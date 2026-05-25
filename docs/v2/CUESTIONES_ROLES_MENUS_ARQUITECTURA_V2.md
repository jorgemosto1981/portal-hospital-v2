# Cuestiones abiertas — roles, menús, arquitectura y UX (V2)

**Estado:** registro de **preguntas pendientes** y **orientación** alineada al resto de `docs/v2/`. No sustituye [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) ni [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md); sirve para cerrar decisiones antes de codificar a gran escala.

**Fecha:** 22 de abril de 2026.

> **Actualización 2026-05-19:** decisiones de **roles HLC, menú RRHH y claims JWT** cerradas e implementadas en backend — ver **[`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md)**. Este documento sigue siendo útil para pendientes de **cfg_item_menu**, claim `tiene_subordinados` y oleada menú web.

---

## 0. Decisiones cerradas (2026-05-19) — resumen

| Tema | Decisión |
|------|----------|
| Rol canónico | `historial_laboral_cargos.rol_id` (`cfg_rol`), no `usuarios_cuenta.role_ids` como driver principal |
| JWT | `roles_hlc_vigentes[]`; deprecar escritura `portal_role` |
| Menú RRHH | `CFG_RRHH` en array → todos los bloques de menú (sin bypass artículos) |
| Menú jefe | `tiene_subordinados` (sin `CFG_JEFE` por ahora); RRHH ve jefe sin subordinados |
| Multi-HLC | Unión de roles en cadenas vigentes simultáneas |

Detalle: [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md) · handoff [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md).

---

## 1. Roles (RRHH, AUDITOR MÉDICO, USUARIO, VISUALIZADOR, …)

### ¿Dónde se registran?

**No** en datos laborales. Los roles de **aplicación** (quién puede administrar fichas, auditar, solo leer, etc.) son atributos de **identidad / acceso**, no del vínculo laboral al organigrama.

- **Persistencia canónica (acceso agente / circuitos):** **`rol_id` en HLC** + claim **`roles_hlc_vigentes`** en sesión ([`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md)). **`usuarios_cuenta.role_ids`** queda como legado / administración futura; no sustituye HLc en ticketera ni menú objetivo.
- **Datos laborales** (`hlc_*`, `gdt_*`, `efe_*`, …) describen **cargo, grupo de trabajo, efector**; pueden condicionar **reglas de negocio** (p. ej. qué solicitudes ve un agente), pero **no** sustituyen la lista de roles de cuenta.

### Alta “pre login” (paso A RRHH) y modificación posterior

- **En el alta inicial** (creación de `per_*` + `usr_*` sin `auth_uid` o antes del paso B): debe poder fijarse **`role_ids`** por defecto (p. ej. `USUARIO` / agente estándar), vía **Callable** de RRHH o regla de seed por tipo de alta.
- **Después del login:** la **modificación de roles** debe ser operación **acotada** (administración / RRHH superior), con **auditoría** (`evt_*`) y preferentemente **solo servidor** (Callable + validación), no edición libre desde el cliente.

### Pendiente de cerrar en implementación

- [ ] Semilla concreta de documentos en **`cfg_rol`** para: `RRHH`, `AUDITOR_MEDICO`, `USUARIO`, `VISUALIZADOR` (y los que falten: superadmin técnico, etc.), con **`vigente_desde` / `vigente_hasta`** y **`activo`** según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2.
- [ ] Política de **varios roles** en la misma cuenta (`role_ids[]` multi) vs **un solo rol**; impacto en claims JWT / Rules.

---

## 2. ¿Módulo de menús? Reglas por rol y menú “Jefe”

### Menú por rol

- **Buena práctica V2:** tratar la navegación como **datos configurables** donde tenga sentido: p. ej. colección **`cfg_item_menu`** (o equivalente) con id estable, `orden`, `ruta` / `codigo_modulo`, **ids de roles permitidos** (referencia a `cfg_rol`), vigencia `vigente_desde` / `vigente_hasta`, `activo`. El shell del portal **arma el menú** leyendo cfg + intersección con `role_ids` de la sesión.
- **Alternativa más liviana:** menú **versionado en código** (array de rutas) pero **visibilidad** por rol desde `cfg_rol` flags (`puede_ver_ticket`, …). Menos flexible para el hospital sin deploy.

### Menú “Jefe” (subordinados por burbujeo / nivel)

- **No** es solo un rol estático: depende del **resultado dinámico** de jerarquía (Ticket / organigrama `gdt_*`). Convención recomendada:
  - **Entrada de menú “Espacio jefe”** visible si `tieneSubordinadosEnAlgunGrupo(persona_id)` (o claim materializado que se **refresca** en login o en background) **o** si un rol explícito `JEFE_GRUPO` existe en `cfg_rol` y está asignado — la decisión es **producto**: jerarquía pura vs rol nominal.
  - La **lógica de burbujeo** permanece en el **módulo Ticket / jerarquía** (como ya indica el plan laboral); el módulo “menú” solo **consulta** un booleano o un permiso derivado.

### Pendiente

- [ ] Nombre de colección(es) y forma exacta del doc `cfg_item_menu` (si se adopta).
- [ ] Si el menú “Jefe” se muestra por **rol**, por **consulta dinámica**, o **ambos** (AND/OR).

---

## 3. ¿Pensar todo en módulos? ¿Facilita el código?

**Sí, con matices.** Módulos por **dominio** (Login, datos personales, laborales, Ticket, configuración) ayudan a:

- Contratos claros (`persona_id`, `cfg_*`, sin mezclar Firestore de gente con reglas de avisos).
- **Carga perezosa** en frontend (rutas por módulo) y equipos trabajando en paralelo.

**No** obliga a microservicios desde el día uno: puede ser **monorepo** con carpetas por módulo y límites explícitos. Lo importante es **dependencias unidireccionales** documentadas (p. ej. Ticket consume laborales; laborales no importa UI de Ticket).

---

## 4. Evitar código extenso (lección V1) y “reglas útiles”

- **Objetivo:** archivos cortos, **una responsabilidad**; extraer **hooks**, **servicios de dominio**, **selectores** y **validadores** reutilizables (como en la refactorización V1).
- **V2:** conviene escribir desde el inicio **funciones puras** para reglas que hoy están repartidas (p. ej. “¿puede ver menú principal?”, “¿catálogo vigente para alta?”) y **reutilizarlas** en cliente, Callables y tests.
- **Reglas V1 que vale la pena portar como idea** (no copiar código legacy): validación centralizada, menos ramas por strings mágicos, uso de **ids** hacia `cfg_*` ([`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1).

### Pendiente

- [ ] Límites de convención en repo (tamaño máximo sugerido por archivo, estructura de `features/`); puede vivir en `.cursorrules` o guía de contribución cuando exista.

---

## 5. ¿Usuario “master” con usuario y contraseña en código?

**No recomendado** guardar credenciales reales en el repositorio (riesgo de filtración, clones públicos, historial git).

**Alternativas seguras:**

1. **Primer administrador** creado por **script de seed** en entorno **no productivo**, con secretos en **variables de entorno** / Secret Manager (no en git).
2. **Bootstrap único** en producción: flujo documentado “primer usuario” con token de un solo uso o consola Firebase **fuera** del código versionado.
3. **Custom claims** de superadmin asignados manualmente en consola para el `auth_uid` del director técnico.

Si el hospital exige un “break-glass”, documentar **procedimiento operativo** (quién, cómo rota PIN), no el secreto en el repo.

---

## 6. Gráfica / mobile (mejorar respecto a V1) y carga a BD

- **Prioridad mobile:** mantener diseño responsive y **rutas ligeras**; evitar que la home cargue todo el árbol de datos del hospital.
- **Módulos en la UI:** alinear con **code splitting por ruta** (React `lazy` / imports dinámicos): cada pantalla pide **solo** las lecturas Firestore necesarias para esa vista.
- **No** disparar en el layout principal consultas pesadas a colecciones que el usuario aún no visitó; usar **suspense + loaders** y caché por pantalla.

Esto complementa la independencia de datos por módulo en [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md).

---

## 7. Relación con otros documentos

| Tema | Ver |
|------|-----|
| Flujo alta RRHH y menú | [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §4, [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) |
| Acceso Firestore / Callables | [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) |
| **Roles HLC, menú, claims (implementado)** | [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md) |
| Fusión con Ticket / otra PC | [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md) |
| Alta delegada jefe → subordinado (licencias) | [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) |
| Estados laboral / baja / deshabilitado (menú RRHH) | [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md) |

---

## 8. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: roles en `usuarios_cuenta` + `cfg_rol`; menús configurables y “Jefe”; módulos; código breve; no master en código; UX/BD por rutas. |
| 2026-04-22 | §7: enlace a doc **Ticket** alta delegada por jefe ([`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md)). |
| 2026-04-22 | §7: enlace estados laborales / RRHH ([`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md)). |
| 2026-05-19 | §0 + §1: alineación con RFC roles HLC; `role_ids` no driver principal de acceso agente. |
