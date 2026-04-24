# Plan modular — Versión 2 del portal

**Dónde vive la doc V2:** toda la planificación de la versión 2 está centralizada en la carpeta **`docs/v2/`** — índice en [`README.md`](./README.md). El resto de `docs/` (fuera de `v2/`) es, en general, documentación de la **versión 1** u otros artefactos históricos; no mezclar rutas de implementación.

La V2 se diseña **por módulos**, aprendiendo de la V1: menos acoplamiento, contratos claros entre partes, y una base de datos que se puede fijar cuando cada módulo tenga su **plan consolidado y revisado** (campos, IDs, catálogos, eventos). *No hay cierres finales: todo sigue en desarrollo hasta revisión explícita.*

**Regla básica (acordada):** la **versión 2 es independiente de la versión 1** — **nueva base de datos**, **código nuevo** y **datos nuevos** en **proyecto/instancia distintos** a la V1 en producción. **No** hay migración de datos desde la V1, **no** hay conexión operativa (APIs, Firestore compartido, jobs de sincronización) entre ambas. La V1 es **solo** referencia para **lecciones** (errores a no repetir), documentadas en [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md).

## Principios

1. **Un módulo = un bloque de responsabilidad** con documentación propia (y, más adelante, límites de código y de datos).
2. **Referencias entre módulos** por IDs técnicos (`per_`, `usr_`, `avi_`, `cfg_`, etc.), no por copiar documentos enteros.
3. **Configuración** (`cfg_*`) centraliza valores que hoy suelen estar dispersos; los demás módulos solo referencian.
4. **Auditoría** (`evt_`) puede ser transversal: cada módulo define *qué* dispara eventos; el formato del evento se unifica en el plan global.

## ID de usuario del sistema (referencia fija entre módulos)

Cada **usuario del hospital** (agente / persona que opera en el portal) tiene **un solo identificador técnico, único e inmutable** desde el alta. Ese ID es la **referencia obligatoria** para enlazar información entre módulos:

- **Datos personales** (ficha humana, contacto, consentimientos, grupo familiar).
- **Datos laborales** (cargos, escalafón, `gdt_*` / `efe_*`, historial).
- **Ticket / solicitudes** y cualquier otro módulo que deba saber “de quién es” un registro.

**Qué no es ese ID:** no es el DNI (dato de negocio, puede haber historial), ni el email, ni el `auth_uid` de Firebase (identidad de *login*, puede asociarse o reasociarse a través de la cuenta).

**Nombre en el modelo técnico actual:** el documento canónico del usuario/agente es `personas` con id **`per_<ULID>`**; el campo de referencia en el resto de colecciones es **`persona_id`**. En lenguaje de producto se puede hablar de “**ID de usuario**” o “**ID del agente**”; en contratos de API y de BD debe usarse **siempre el mismo nombre de campo** (`persona_id` u otro que fijen mañana en el Rulebook, pero **una sola clave**).

**Cuenta de acceso:** la colección `usuarios_cuenta` (`usr_<ULID>`) enlaza `auth_uid` ↔ `persona_id`; los módulos de negocio referencian al **usuario del sistema** por `persona_id`, no por el id de la cuenta salvo en flujos de autenticación.

## Módulos previstos (lista viva)

| Módulo | Contenido principal | Estado del plan en repo |
|--------|---------------------|-------------------------|
| **Ticket / Solicitudes** | Estados del aviso, validaciones, asignación, cierre, ítems por grupo, SLA | Contenido funcional en [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) (*PLAN V2 CONSOLIDADO*, cierres *V2-CIERRE* / *V2-REAP*); cuestiones y fusión otra PC en [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md); alinear nombres de entidades con [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md) |
| **Configuración** | Catálogos, textos legales, parámetros del sistema | [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) — **plan doc:** inventario §5 + semilla §6 *(implementar seeds en código cuando toque)* |
| **Datos personales** | Persona, contacto, domicilio, formación, consentimientos, grupo familiar | [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) — doc **avanzada** (contrato + §9); *pend. nueva revisión*; código V2 pendiente |
| **Datos laborales** | Cargos, **`grupos_de_trabajo` (`gdt_*`)**, **`efectores` (`efe_*`)**, `hlc_*` / `hld_*` / `hlg_*`, causales y carga en horas | [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) — **borrador** (unificar con Ticket vía [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md)) |
| **Login y acceso** | Auth, sesión, recuperación, **estado que permite o bloquea inicio de sesión** | [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) — doc **avanzada**; flujo operativo §4–§5; *pend. nueva revisión*; código V2 pendiente |
| **Identidad y acceso** *(recomendado explícito)* | `usuarios_cuenta`, vínculo `auth_uid` ↔ `persona_id` | Ver login + [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) |
| **Notificaciones** *(opcional como módulo)* | Canales, plantillas, preferencias | Pendiente si se desacopla de ticket |

El orden de **implementación** puede ser distinto al de **documentación**; lo importante es que cada módulo tenga su plan antes de modelar la BD definitiva.

## Orden sugerido para armar la BD (solo orientativo)

1. **Configuración** y **Identidad** (mínimo para referencias y login).  
2. **Datos personales** y **Datos laborales** (ficha del agente).  
3. **Ticket / Solicitudes** (consume el **ID de usuario del sistema** — hoy modelado como `persona_id` —, catálogos y reglas).

## Unificación

Cuando existan borradores de todos los módulos, se arma **un esquema único** (entidades, nombres de colecciones, enums compartidos) y el **Rulebook v2** canónico. **Borrador actual:** [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) (v0). **Guía operativa para alinear esta PC con la otra (Ticket, git, criterios):** [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md). **Roles, menús, anti-código extenso, master y UX:** [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md). **Ticket — solicitud iniciada por jefe para subordinado:** [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md). **Estados agente (laboral / baja / deshabilitado, RRHH):** [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md). [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) puede seguir enlazando hitos operativos.

**Flujo implementable Login + datos personales (onboarding y gating):** [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) — lectura recomendada antes de codificar autenticación y primera carga del portal.

**Acceso Firestore / Functions / Rules (V2):** [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md).

**Lecciones desde V1 (solo documentación; sin datos ni runtime compartidos):** [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) (tabla comparativa, **Criterios de alineación (guía)** módulo Login + datos personales).

**Implementación del código (cuando toque):** [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) (evaluación + frase de encargo) y [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) (fases 0–6).

### Avance del plan documental — bloque Login + datos personales *(23/04/2026)*

El bloque **Login + datos personales + configuración mínima `cfg_*` asociada** está **más adelantado** en documentación que Ticket u otros módulos, pero **no** constituye un cierre ni una aprobación final: conviene **nueva revisión** módulo a módulo y alineación con el maestro [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md). Criterios de referencia: [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) sección *Criterios de alineación (guía)*.

**En curso (otros módulos / fases):** módulo Ticket (contenido funcional en `PLAN_DESARROLLO_VERSION2` + cuestiones en `docs/v2/`, conciliación en `REVISION_ALINEACION_PLAN_V2.md`), consolidación del borrador de **datos laborales** tras unificación, Rulebook coherente, primer código sobre **BD V2** (seeds, Callables, Rules) cuando toque. La **V2 no incluye** migración ni enlace de datos desde la V1.

**Objetivo de transición (propuesta):** consolidar y revisar el plan documental del **núcleo inicial** (Login + datos personales + datos laborales + `cfg_*` mínimos) para, cuando el equipo lo valide, **abrir código y BD nueva** en proyecto **independiente de la V1**; el **resto de módulos** (Ticket completo, menús, etc.) en fases. Detalle: [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md) (*Objetivos tras la unificación*).

---

*Creado: 22 de abril de 2026 — alineado con la decisión de trabajar el plan por módulos antes de crear la base e iniciar código.*
*Actualizado: 22/04/2026 — avance doc Login + datos personales; tabla de estados.*  
*Actualizado: 22/04/2026 — **V2 greenfield:** independiente de V1 (nueva BD, código y datos); V1 solo lecciones.*  
*Actualizado: 22/04/2026 — **Regla estricta:** sin conexión ni migración de datos V1→V2.*  
*Actualizado: 22/04/2026 — **Doc V2** bajo `docs/v2/` + enlace a `README.md`.*  
*Actualizado: 22/04/2026 — Enlace a [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) y borrador [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md).*  
*Actualizado: 22/04/2026 — Datos laborales: **borrador ampliado** (colecciones + cfg).*  
*Actualizado: 22/04/2026 — Enlace a **unificación otra PC / Ticket**; tabla módulo datos laborales (luego: `gdt_*` + `efe_*` — 23/04/2026).*  
*Actualizado: 23/04/2026 — Módulo laboral: criterio **`grupos_de_trabajo` y `efectores`** (plan maestro §B, decisiones A2).*
*Actualizado: 22/04/2026 — Doc Ticket: **solicitud por delegación de jefe** (`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`).*  
*Actualizado: 22/04/2026 — Estados **laboral / baja / deshabilitado** y menú RRHH (`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`).*  
*Actualizado: 22/04/2026 — **Objetivo:** consolidar doc del núcleo (Login + datos personales + datos laborales + cfg) → luego código y BD V2 sin conexión V1; demás módulos después (`UNIFICACION_OTRA_PC_Y_TICKET.md`).*  
*Actualizado: 23/04/2026 — Tabla módulo Ticket: enlace a `PLAN_DESARROLLO_VERSION2`, unificación, `REVISION_ALINEACION_…`; “sigue abierto” alineado.*  
*Actualizado: 23/04/2026 — Política común: sin cierres/“aprobado final” a nivel plan; *pend. revisión* por módulo (alineado a `PLAN_DESARROLLO_VERSION2` maestro).*
