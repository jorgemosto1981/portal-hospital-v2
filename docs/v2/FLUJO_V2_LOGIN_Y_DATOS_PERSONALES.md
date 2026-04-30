# Flujo V2: Login → onboarding datos personales → acceso al portal

**Propósito:** una sola lectura para **desarrollo** (frontend, backend, Cloud Functions, reglas de seguridad y seeds de `cfg_*`) que cruza [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) y [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md). No sustituye el detalle campo a campo de esos planes; los amplía con **orden de ejecución**, **ownership** y **gating** explícito.

**Fecha:** 22 de abril de 2026.

---

## 1. Documentos que debe leer quien implementa

| Orden | Documento | Uso |
|-------|------------|-----|
| 0 | [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) | Evaluación del plan, impacto en código, **frase de encargo** para abrir el trabajo. |
| 1 | [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) | **Orden obligatorio** de fases 0–6 y definición de hecho por fase. |
| 2 | Este archivo | Secuencia, reglas de enrutamiento y checklist de código. |
| 3 | [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) | **§1.1** DNI + PIN 6 + correo; email único §2; flujo §4; `estado_acceso`; `usuarios_cuenta`. |
| 4 | [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) | Colecciones, contrato §3, listas **[P]**, catálogos §9, pasos §1.2. |
| 5 | [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) | Matriz lectura/escritura, Callables, orientación Security Rules. |
| 6 | [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) | Forma de `cfg_*`, flags de gating en catálogos de estado. |
| 7 | [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) | `persona_id` como ancla entre módulos. |
| — | [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) | *(Opcional)* Tabla comparativa y **lecciones** desde V1. **Regla:** V2 **no** se conecta a la V1 (sin migración de datos, sin misma BD/Firestore que prod V1). |

**Configuración:** todos los estados y listas cerradas relevantes se resuelven por **`*_id` → documentos en `cfg_*`** (semilla administrable). La app **no** compara strings mágicos en documentos de negocio.

---

## 2. Definiciones cortas

| Término | Significado |
|---------|-------------|
| **Cerrar onboarding de datos personales** | La ficha cumple el checklist V2 (`estado_perfil_datos_id` apunta al valor **“completo”** —o equivalente— en `cfg_estado_perfil_datos`), **`formacion_agente`** y **`consentimientos`** exigidos están conforme al contrato, y la cuenta pasa a **`estado_acceso`** = **“activo portal”** en `cfg_estado_cuenta_acceso`. El usuario entonces puede usar el **shell con menú principal**. |
| **`persona_id`** | Id del documento `personas/per_<ULID>`. Referencia estable en todo el sistema. |
| **Cuenta** | Documento `usuarios_cuenta/usr_<ULID>` con `persona_id`, credenciales y `estado_acceso`. Dueño funcional del módulo **Login**. |

---

## 3. Responsabilidades (quién escribe qué)

| Dato / transición | Dueño funcional | Notas |
|-------------------|-----------------|-------|
| `personas` (identidad, contacto, domicilio, `estado_perfil_datos_id`, …) | Módulo / servicio **Datos personales** | Sin `username` en persona. |
| `formacion_agente` | Datos personales | Un documento vigente por `persona_id` en V2 (salvo política futura). |
| `consentimientos` | Datos personales (+ marco legal) | TyC / DDJJ personales según checklist. |
| `usuarios_cuenta` (`username`, `auth_uid`, `estado_acceso`, `activo`, `role_ids`, …) | Módulo **Login** (y funciones de identidad) | El formulario de datos personales **no** cambia el email de acceso. |
| Usuario en **proveedor Auth** (Firebase u otro) | Login | `auth_uid` debe quedar **persistido** en `usuarios_cuenta` al vincular. |
| `declaraciones_grupo_familiar` | Datos personales | DDJJ grupo familiar; **no** bloquea el menú en la política acordada. |
| `eventos_ticket` | Transversal | Registrar transiciones relevantes con `tipo_evento_id` → `cfg_tipo_evento`. |

---

## 4. Secuencia global (pasos A → E)

Resumen alineado a [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§1.2** y [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§4**.

| Paso | Nombre | Usuario | Autenticación | Pantalla dominante | Persistencia principal |
|------|--------|---------|---------------|---------------------|-------------------------|
| **A** | Alta RRHH | RRHH | Sesión RRHH | Backoffice | `personas` mínima + `usuarios_cuenta` con `estado_acceso` = *pendiente registro*; `auth_uid` **null**; **obligatorio** crear `declaraciones_grupo_familiar` (`gf_*`) con `estado_declaracion_id` = *no iniciada* (u otro en `cfg_estado_declaracion_ddjj`) — criterio **B7**; plan unificado: [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md). |
| **B** | Primer acceso | Agente | Flujo **DNI** (custom) → alta email/password en Auth | Wizard “crear credenciales” | Auth: usuario creado; `usuarios_cuenta`: `auth_uid`, `username`, `estado_acceso` = *onboarding datos*; **no** escribir email en `personas`. |
| **C** | Onboarding datos personales | Agente | Sesión **ya autenticada** (post B) | Wizard ficha + formación + consentimientos obligatorios | `personas`, `formacion_agente`, `consentimientos`; al validar checklist: `estado_perfil_datos_id` = *completo*; luego transición cuenta → *activo portal*. |
| **D** | DDJJ grupo familiar | Agente | Misma sesión u otro momento | Flujo DDJJ o “omitir por ahora” | `declaraciones_grupo_familiar` + `estado_declaracion_id` siempre consultable; opcional `evt_*`. |
| **E** | Portal operativo | Agente | Login email/password habitual | Menú principal + módulos | Lecturas; transiciones de estado solo por reglas de negocio (bloqueos, etc.). |

**Regla de producto:** entre **B** y **C** el usuario **sí** tiene sesión válida, pero el **router** lo mantiene fuera del menú principal hasta cumplir **C** (y la transición de `estado_acceso` a *activo portal*). La **DDJJ (D)** no bloquea el menú salvo cambio explícito de política documentado en Login §4.4.

### 4.1 Flujo oficial de primer acceso (decisión operativa)

- Flujo oficial para agente nuevo: **`/registro` -> `/vinculacion` -> `/onboarding`**.
- La pantalla **`/inicio`** queda para diagnóstico técnico y no para ejecutar operaciones de negocio RRHH.
- La operación administrativa de alta permanece en **`/rrhh/alta`**.
- Si existiera un camino alternativo técnico (por callable), se considera contingencia de soporte y no flujo funcional principal.

---

## 5. Gating: menú principal y login

### 5.1 Variables de verdad

Para decidir navegación post-login se consultan al menos:

1. `usuarios_cuenta.activo` y `personas.activo` (kill-switch).
2. `usuarios_cuenta.estado_acceso` → documento en `cfg_estado_cuenta_acceso` (p. ej. flag materializado `permite_menu_principal` **solo en cfg**, no duplicado como string en la cuenta).
3. `personas.estado_perfil_datos_id` → `cfg_estado_perfil_datos` (coherencia con “ficha completa”).
4. Opcional: claims de sesión **derivados** de lo anterior (regenerar al login o al cambiar cuenta/persona).

**Coherencia:** tras cerrar **C**, la cuenta **no** debería quedar en *activo portal* si `estado_perfil_datos_id` no refleja *completo* (evitar menú con ficha incompleta). La escritura **atómica** (§11) reduce divergencias.

### 5.2 Pseudocódigo recomendado (dominio compartido)

```
function destinoTrasAuth(cuenta, persona, docsCfg):
  if not cuenta.activo or not persona.activo:
    return BLOQUEADO
  acceso = cfg[cuenta.estado_acceso]
  perfil = cfg[persona.estado_perfil_datos_id]
  if acceso.codigo_interno == "PENDIENTE_REGISTRO":
    return WIZARD_PRIMER_ACCESO   // solo si el flujo aún aplica; si ya tiene Auth, reconciliar datos
  if acceso.codigo_interno == "ONBOARDING_DATOS":
    return WIZARD_DATOS_PERSONALES
  if acceso.codigo_interno == "ACTIVO_PORTAL" and perfil.permite_portal_completo:
    return MENU_PRINCIPAL
  return RUTA_SEGURA_POR_DEFECTO  // p. ej. soporte / error amigable
```

La app **compara ids** guardados en `cuenta` / `persona` contra documentos `cfg_*`; los `codigo_interno` del pseudocódigo son **ilustrativos** y viven en el catálogo, no hardcodeados en la cuenta.

### 5.3 Matriz rápida (implementación UI)

| `estado_acceso` (vía cfg) | `estado_perfil_datos_id` (vía cfg) | Comportamiento esperado |
|-----------------------------|-------------------------------------|-------------------------|
| Pendiente registro | Cualquiera incompleto | Solo flujo primer acceso (DNI), no menú. |
| Onboarding datos | Incompleto / borrador | Sesión permitida; **forzar** wizard datos personales. |
| Onboarding datos | Completo | Estado inconsistente → **reconciliar** (no abrir menú hasta corregir `estado_acceso`). |
| Activo portal | No completo | Inconsistente → reconciliar o bloquear menú. |
| Activo portal | Completo | Menú principal. |
| Bloqueado / política | * | Pantalla de bloqueo; sin menú. |

---

## 6. Paso B: orden sugerido de persistencia (evitar huérfanos)

1. Validar DNI ↔ `personas` y existencia de `usuarios_cuenta` en *pendiente registro*.
2. Crear usuario en **Auth** con email + contraseña (manejar colisión de email con mensaje claro).
3. En **una misma transacción o lote atómico** (ideal): actualizar `usuarios_cuenta` con `auth_uid`, `username`, `estado_acceso` = *onboarding datos*, `actualizado_en`.
4. Registrar `eventos_ticket` con `tipo_evento_id` apropiado.

**`auth_uid`:** ver contrato **[C]** en datos personales **§3.7 ítem 56**: `null` solo **antes** de vincular; tras crear el usuario en Auth debe ser **no-null**. Índice único de `auth_uid` **solo sobre valores no nulos** (sparse / parcial).

---

## 7. Paso C: criterio “ficha completa” antes de activar menú

El checklist obligatorio al perfil **`COMPLETO`** está en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **lista P 1–10** y **§3** / **§4** (incluye `formacion_agente` y campos † de `personas`).

**Implementación sugerida:**

1. **Validación servidor** (Cloud Function o API): misma regla que la UI final (“no confiar solo en el cliente”).
2. Al aprobar: actualizar `personas.estado_perfil_datos_id` al id cfg *completo* y, en el mismo lote atómico, `usuarios_cuenta.estado_acceso` al id cfg *activo portal* (salvo que exista paso manual RRHH `perfil_validado_por_rrhh`; si aplica, documentar gate adicional).
3. Incrementar / respetar `perfil_completitud_version` cuando cambie el checklist hospitalario (re-onboarding selectivo).

**Consentimientos:** persistir documentos `consentimientos` con `tipo_consentimiento_id`, `version_id`, `texto_hash`, etc., según **§3.8** y política de `ip_origen` (lista P 14).

---

## 8. Paso D: DDJJ familiar (paralelo o posterior)

- Tras **C**, el usuario puede acceder al menú aunque **D** no esté cerrada.
- Toda omisión o borrador debe reflejarse en **`estado_declaracion_id`** (FK `cfg_estado_declaracion_ddjj`), no solo en UI.
- El módulo Ticket consumirá **`cfg_requisitos_ticket`** + estado de DDJJ; no es responsabilidad del router de menú salvo política explícita.

---

## 9. Auditoría mínima (recomendada)

| Momento | Ejemplo de intención `tipo_evento_id` (definir en `cfg_tipo_evento`) |
|---------|-----------------------------------------------------------------------|
| Post B | Cuenta vinculada a Auth / credenciales registradas. |
| Post C | Perfil datos marcado completo; cuenta activada portal. |
| Cambios sensibles en persona | Datos contacto / domicilio actualizados. |
| DDJJ | Envío, omisión controlada, cambio de estado. |

Payload **mínimo** y sin datos redundantes masivos (ver datos personales §2.4 sobre inflar `payload`).

---

## 10. Checklist de implementación (código V2)

**Infraestructura y datos**

- [ ] Seeds (bootstrap) de `cfg_estado_cuenta_acceso`, `cfg_estado_perfil_datos`, `cfg_estado_declaracion_ddjj`, `cfg_tipo_evento`, catálogos de §9 datos personales.
- [ ] Índices: `usuarios_cuenta.auth_uid` único sparse; unicidad `personas.dni` entre `activo == true` según regla acordada.

**Backend / reglas**

- [ ] Matriz de acceso y Callables según [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) §3–§6 y §8.
- [ ] Lookup seguro DNI → `persona_id` → `usuarios_cuenta` para paso B (anti-enumeración según política de seguridad).
- [ ] Función o módulo compartido `destinoTrasAuth` / equivalente usado por **login redirect** y **guards** de rutas (preferir flags `cfg_*` de [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §2).
- [ ] Validación servidor del checklist **COMPLETO** antes de transición a *activo portal*.
- [ ] Transacción o saga: `estado_perfil_datos_id` + `estado_acceso` coherentes.

**Frontend**

- [ ] Shell con rutas: `pendiente` / `onboarding-datos` / `app` (menú) según §5.3.
- [ ] Formulario datos personales sin campo ni mutación de `username`.
- [ ] Tras login, **siempre** evaluar destino antes de asumir menú.

**Login**

- [ ] Recuperación contraseña y cambio email solo vía módulo Login ([`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §2, §6).

---

## 11. Mejoras propuestas y deuda documental *(revisión)*

Prioridad orientativa: **P0** bloquea implementación segura o coherente; **P1** fuerte recomendación antes de producción; **P2** calidad / evolución.

### P0 — Cerrar contrato o código

| Tema | Estado | Dónde quedó resuelto |
|------|--------|----------------------|
| **`username` entre A y B** | Cerrado en contrato | [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §3.1; [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) §3.7 ítem 58; matriz de acceso [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) §3–§4. |
| **Gating sin hardcodear strings** | Cerrado como diseño | Flags en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §2.1–§2.2 y §3; pseudocódigo §5.2 de este documento sigue siendo **ilustrativo** — en código usar flags cargados por `*_id`. |
| **`signIn` vs paso A** | Cerrado en contrato | [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §1.3; reforzado en [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) §2 y §6 (`permite_login_email_password` en cfg). |

**Pendiente implementación (no solo doc):** reglas `.rules` concretas, emulador y Callables desplegados según [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) §8.

### P1 — Seguridad y operación *(definido en documentación 22/04/2026; pendiente de revisión global)*

Las siguientes decisiones son **normativas para implementación** salvo que el hospital apruebe un RFC que las modifique.

#### P1.1 Enumeración por DNI (primer acceso / Callables)

- **Respuesta al cliente:** para fallos de negocio (DNI no elegible, ya registrado, cuenta bloqueada, etc.) el Callable devuelve **un único mensaje genérico**, p. ej.: *“No pudimos completar este paso. Si el problema continúa, contactá a RRHH.”* No distinguir en UI entre “DNI inexistente” y “DNI ya vinculado”.
- **Errores técnicos** (Auth caído, Firestore unavailable): mensaje distinto genérico de sistema.
- **Rate limiting:** implementar en el Callable (contador por `IP` + hash de `DNI`, ventana configurable; valor inicial sugerido **20 intentos / 15 min** por par IP+DNI). Opcional: **App Check** + CAPTCHA tras N fallos.
- **Logging:** el detalle real queda solo en logs del servidor (nivel `warn`/`error`), no en la respuesta al cliente.

#### P1.2 Verificación de email (Firebase `emailVerified`)

- **Antes del paso C (wizard datos personales):** **no obligatorio** por defecto: el usuario puede completar la ficha con email aún no verificado.
- **Antes de pasar a `estado_acceso` = *activo portal* y menú principal:** **obligatorio** `emailVerified === true` salvo **RFC** explícito del hospital que documente riesgo aceptado.
- Si en el futuro se exige verificación **antes** del wizard: añadir valor en `cfg_estado_cuenta_acceso` con `codigo_interno` = `PENDIENTE_VERIFICACION_EMAIL` (ver [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §2.1).

#### P1.3 Reconciliación `estado_acceso` ↔ `estado_perfil_datos_id`

- **Job programado:** Cloud Function **diaria** (hora off-peak configurable) idempotente que corrige inconsistencias según matriz **§5.3** de este documento.
- **On-demand:** mismo algoritmo expuesto como Callable **`reconciliarEstadosCuentaPersona`** restringido a **RRHH_ADMIN / superadmin**.
- **Reglas de corrección (prioridad):** (1) Si `estado_perfil_datos_id` no es “completo” → forzar `estado_acceso` al id cfg *onboarding datos* (nunca *activo portal*). (2) Si perfil “completo” y cuenta sigue en *onboarding datos* → promover cuenta a *activo portal*. (3) Registrar `evt_*` solo si hubo cambio.
- **Alerta:** métrica/contador si en un día se corrigen > umbral de cuentas (posible bug en cliente).

#### P1.4 Cambio de proveedor Auth / `auth_uid`

- **Fase 2** (fuera del cierre del plan actual): Callable dedicado `reVincularAuth`, reautenticación y **`evt_*` obligatorio**. No bloquea el “plan documentado” del módulo Login + datos personales V2.

### P2 — Producto y documentación

| Tema | Solución propuesta |
|------|---------------------|
| **`perfil_completitud_version`** | Tabla de compatibilidad: versión N del checklist → qué campos mínimos; UI “debe actualizar datos” cuando sube versión. |
| **`MODULO_CONFIGURACION_V2.md`** | Inventario §9 replicado + semilla ilustrativa en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5–§7; scripts de despliegue **pendiente** en repo de infra. |
| **Sesiones / claims (Login §3.3)** | Decidir: claims con `persona_id` + snapshot de `estado_acceso` vs lectura Firestore en cada navegación; TTL y refresco. |
| **Multi-cuenta** | Si algún día 1 `persona_id` → N cuentas, rompe unicidad `persona_id` en índice; documentar **1:1** como V2 por defecto. |

### Coherencia entre documentos

- Changelog antiguo de Login (**“réplica opcional en `personas`”**) contradice el acuerdo actual (**sin** `email_laboral` en persona). Tratar esa línea como **histórica obsoleta**; la fuente de verdad es §2 actual.
- Unificar cuando exista Rulebook: **nombres de colección** `cfg_estado_cuenta_acceso` vs variantes “tentativas” en datos personales §9.

---

## 12. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: flujo unificado A–E, ownership, gating, pseudocódigo, checklist código, alineación Login + Datos personales. |
| 2026-04-22 | **§11** mejoras propuestas, deuda documental y matriz P0/P1/P2 *(revisión plan)*. |
| 2026-04-22 | §1 lecturas: [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md), [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md); §10 checklist backend; §11 P0 razonado en doc + pendiente implementación Rules/CF. |
| 2026-04-22 | Enlace opcional a [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) en §1. |
| 2026-04-22 | §1: añadidos [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) y [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) como lecturas 0–1. |
| 2026-04-22 | **§11 P1** en documentación: enumeración DNI, `emailVerified`, reconciliación diaria+admin, Auth proveedor Fase 2; §11 P2 referencia a módulo config ampliado. |
| 2026-04-23 | P1/§11: sustituir “cerrado en documentación” por *definido/razonado; pend. revisión* (alineado plan maestro). |
| 2026-04-22 | Alineación **greenfield:** §1 enlace `V1_VS_V2` (lecciones, sin datos legacy); §10 checklist “Seeds (bootstrap)”. |
| 2026-04-22 | **Regla estricta** en §1: sin conexión V1↔V2 ni migración de datos. |
| 2026-04-22 | Doc V2 en `docs/v2/`; §1 tabla Login: **DNI + PIN 6 + correo** (`MODULO_LOGIN_V2` §1.1). |
| 2026-04-23 | §4 paso **A:** `declaraciones_grupo_familiar` pasa a **obligatoria** en el alta (B7; plan [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md)). |
| 2026-04-30 | §4.1 decisión operativa: flujo oficial de primer acceso ` /registro -> /vinculacion -> /onboarding`; `/inicio` sin operación de negocio RRHH. |
