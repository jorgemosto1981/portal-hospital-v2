# Ticket / solicitudes — alta delegada por jefe de grupo (V2)

**Estado:** **requisito de producto** registrado para cerrar con el documento de Ticket de la otra PC y con el modelo de **artículos / licencias** en configuración. No define nombres finales de colecciones Firestore hasta la unificación.

**Fecha:** 22 de abril de 2026.

---

## 1. Regla general vs excepción operativa

| Situación | Comportamiento |
|-----------|----------------|
| **Por defecto** | Cada usuario **inicia** solicitudes de licencias / artículos **solo para sí mismo** (`titular` = actor del alta, salvo convención explícita del módulo). |
| **Excepción** | Un usuario **jefe de grupo de trabajo** puede **registrar en nombre de** un **subordinado** la solicitud, **solo** si se cumplen las condiciones del **§2** y el artículo lo **permite en configuración** (**§3**). |

Motivo: alinear el modelo formal con la **práctica administrativa** (el jefe adelanta trámites sin obligar al subordinado a pasar por el mismo paso inicial).

---

## 2. Condiciones obligatorias (todas a la vez)

1. **Relación jefe → subordinado**  
   El actor debe ser **jefe respecto del titular de la solicitud** según la **misma fuente de verdad** que usa el módulo Ticket para jerarquía (burbujeo, niveles por grupo de trabajo, etc.). **No** basta un rol genérico “RRHH” salvo que otra regla de producto lo amplíe en otro documento.

2. **Artículo / licencia configurado para este modo**  
   En la **definición del artículo o tipo de solicitud** (configuración al crearlo/editarlo) debe existir un control explícito, por ejemplo:
   - **`permite_alta_iniciada_por_jefe_grupo`** (boolean u homónimo en `cfg_*`), **y**
   - el flujo del artículo debe **incluir** paso de **autorización por jefe** (p. ej. `requiere_autorizacion_jefe` o equivalente en máquina de estados del trámite).

   Si el artículo **no** exige autorización por jefe, **no** aplica la excepción (evita saltos de flujo incoherentes).

3. **Autorización por jefe “instantánea”**  
   Al ser el **mismo actor** quien inicia la solicitud y quien cumple el rol de **jefe autorizador** en ese paso, el motor debe **resolver en el mismo momento** el estado de “pendiente de jefe” como **cumplido / saltado de forma explícita** (no silencioso): queda trazado **quién** actuó y **en nombre de quién**.

4. **Resto del flujo**  
   Validaciones posteriores, **tomas de conocimiento**, RRHH, auditoría médica, etc. **continúan igual** que si el subordinado hubiera iniciado él mismo la solicitud **después** del paso de jefe (ya satisfecho).

5. **Auditoría**  
   Toda solicitud creada bajo este modo debe generar **eventos de auditoría** (`evt_*` / `tipo_evento_id` → `cfg_*`) que permitan reconstruir: actor real, titular del trámite, artículo, indicador de **alta delegada por jefe**, timestamp y, si aplica, correlación con grupo de trabajo.

---

## 3. Configuración en creación de artículos / licencias

- La posibilidad **no es global**: solo aplica donde el hospital **active** los flags en el documento de configuración del artículo (o tipo de solicitud vinculado).
- Convención recomendada: todo en **`cfg_*`** con **id estable** y vigencia `vigente_desde` / `vigente_hasta` / `activo` según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2.
- Nombres tentativos de campos (a fijar al fusionar con la otra PC):
  - `permite_alta_iniciada_por_jefe_grupo` (boolean)
  - coherencia con flags ya existentes del flujo (p. ej. requiere validación jefe, impacto sueldo, etc.)

---

## 4. Modelado sugerido en el documento de solicitud *(borrador conceptual)*

Separar siempre:

- **`titular_persona_id`** (o nombre acordado): **a quién** corresponde la licencia / derecho.  
- **`creado_por_persona_id`** / **`actor_alta_persona_id`**: **quién** disparó el alta en el sistema (puede ser el titular o el jefe).

Más un flag o tipo de origen del alta, p. ej. **`origen_alta_id`** → `cfg_origen_alta_solicitud` con valor “delegada_jefe_grupo”, para informes y Rules sin inferir solo por comparación de ids.

---

## 5. Pendientes al fusionar con la otra PC

- [ ] Nombres definitivos de colección y campos del **artículo** y de la **solicitud**.
- [ ] Reglas Firestore / Callable: **quién puede crear** `solicitud` con `titular_persona_id != actor` y bajo qué `cfg_*`.
- [ ] UI: pantalla de selección de subordinado filtrada por jerarquía; mensaje claro de “actúa en nombre de …”.
- [ ] Coherencia con menú “Jefe” ([`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md)) si el acceso a esta función sale de ahí.

---

## 6. Referencias cruzadas

| Documento | Relación |
|-----------|----------|
| [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) | Jerarquía **no** en `hlc_*`; motor en Ticket |
| [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md) | Checklist de fusión doc + código |
| [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) | Patrón `cfg_*`, vigencia, sin borrado físico |

---

## 7. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: alta delegada por jefe, condiciones, auditoría, flags en artículo, campos sugeridos titular vs actor. |
