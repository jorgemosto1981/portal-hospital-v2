# Orden de desarrollo — Módulo Login + datos personales V2

**Propósito:** secuencia **obligatoria** de implementación para que, al decir *“desarrollar el código según las instrucciones”*, el equipo no invierta dependencias (p. ej. UI antes de Rules) ni deje huecos de seguridad.

**Lectura previa de una página:** [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) §1 (frase de encargo) y §2–§3.

**Fecha:** 22 de abril de 2026.

---

## 1. Principios de ejecución

1. **Nada en producción** hasta pasar **Fase 2** (emulador de reglas + tests mínimos).
2. **Transiciones de estado** (`estado_acceso`, `estado_perfil_datos_id` a valores “finales”) **solo** Admin SDK / Callable, nunca `updateDoc` desde cliente para esos campos.
3. **Checklist COMPLETO** = misma función de validación en **Callable `completarOnboardingDatos`** y en tests; la UI solo refleja errores devueltos.
4. **Catálogos:** cargar opciones desde Firestore `cfg_*`; ids en seed alineados a [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5–§6 (sustituir placeholders por ULID en el script real).

---

## 2. Fase 0 — Decisiones de runtime (≤ 1 día equipo)

| # | Decisión | Opciones | Salida |
|---|----------|----------|--------|
| 0.1 | Cómo enlaza `request.auth.uid` con `persona_id` en Rules | Custom claims vs query `usuarios_cuenta` por `auth_uid` | **Cerrado 23/04/2026:** custom claims `persona_id` (+ `cuenta_id` recom.); ver [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§3.3** y [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) **F0.1** |
| 0.2 | Entorno primero | **Obligatorio:** proyecto Firebase / BD **distintos** de producción V1. **Prohibido** usar la misma instancia Firestore que la app V1 (evita conexión implícita y lectura cruzada) | Nombre del proyecto V2 en README del módulo |
| 0.3 | Independencia de V1 | **Regla:** sin migración de datos, sin lectura/escritura de BD/Auth/Functions de V1 desde V2. [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) = lecciones en documentación solamente | Párrafo explícito en README: “V2 no accede a recursos de la V1” |

**Hecho Fase 0:** decisiones escritas; rama `feat/v2-identidad` o equivalente creada.

---

## 3. Fase 1 — Datos: colecciones, índices, seeds

| # | Tarea | Referencia |
|---|-------|------------|
| 1.1 | Crear colecciones vacías o definir en Rules `match` para `personas`, `usuarios_cuenta`, `formacion_agente`, `consentimientos`, `declaraciones_grupo_familiar`, `eventos_ticket`, `cfg_*` necesarios | `MODULO_DATOS_PERSONALES_V2` §2.3, §9 |
| 1.2 | Índices: `usuarios_cuenta` por `auth_uid` (sparse unique), por `persona_id` | `FLUJO_V2` §10, `MODULO_LOGIN` §3.1 |
| 1.3 | Seed idempotente: `cfg_estado_cuenta_acceso`, `cfg_estado_perfil_datos`, `cfg_tipo_evento` mínimo, + catálogos para un formulario de prueba | `MODULO_CONFIGURACION_V2` §6–§7 |

**Hecho Fase 1:** script ejecutable en staging; documento `seed-ids.json` o export en vault interno con ids reales usados por staging.

---

## 4. Fase 2 — Security Rules + emulador

| # | Tarea | Referencia |
|---|-------|------------|
| 2.1 | Rules **deny by default**; abrir lecturas/escrituras según [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) §3–§7 | |
| 2.2 | **No** replicar `allow read: if request.auth == null` sobre colecciones con PII | `V1_VS_V2_LOGIN_DATOS` |
| 2.3 | Suite emulador: usuario no lee `personas` ajeno; no actualiza `estado_acceso` a activo portal; RRHH puede crear paso A si así se definió | `ACCESO` §8 |

**Hecho Fase 2:** `npm test` o script CI que levante emulador y ejecute tests de reglas.

---

## 5. Fase 3 — Cloud Functions: paso A y B

| # | Callable | Comportamiento mínimo |
|---|----------|------------------------|
| 3.1 | `rrhhAltaAgente` (nombre ajustable) | Crea `per_*`, `usr_*`, `estado_acceso` pendiente, `username` null, `auth_uid` null; opcional `gf_*` no iniciada |
| 3.2 | `registrarPrimerAcceso` | Valida DNI + **email** + **PIN `^\d{6}$`** ([`MODULO_LOGIN_V2`](./MODULO_LOGIN_V2.md) §1.1); mensaje genérico ante fallo ([`FLUJO_V2`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §11 P1.1); rate limit; transacción Auth (`username`, `password`=PIN) + `usr_*` post B |
| 3.3 | `eventos_ticket` | Append en post B con `tipo_evento_id` válido |

**Hecho Fase 3:** pruebas manuales o integración contra staging con usuario de prueba de punta a punta A→B.

---

## 6. Fase 4 — Cloud Function: paso C (cierre onboarding)

| # | Tarea |
|---|--------|
| 4.1 | Implementar validación checklist (lista P + † según `MODULO_DATOS_PERSONALES_V2`) en servidor |
| 4.2 | Callable `completarOnboardingDatos`: transacción `estado_perfil_datos_id` completo + `estado_acceso` activo portal + `evt_*` |
| 4.3 | Comprobar `emailVerified` antes de activo portal si aplica ([`FLUJO_V2`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §11 P1.2) |

**Hecho Fase 4:** usuario de prueba llega al menú solo con estados coherentes; intento de fraude desde cliente rechazado por Rules.

---

## 7. Fase 5 — Frontend

| # | Tarea |
|---|--------|
| 5.1 | Tras login/registro, invocar **solo** `destinoTrasAuth` (flags cfg) para redirigir: wizard primer acceso / wizard datos / menú / bloqueado |
| 5.2 | Wizard datos: formularios desde `cfg_*`; persistencia según Rules (parcial cliente + Callable cierre) |
| 5.3 | Pantalla cambio email / recuperación: solo flujos Login; sin campo `username` en módulo datos |

**Hecho Fase 5:** recorrido E2E manual documentado (capturas o video corto interno).

---

## 8. Fase 6 — Operación y hardening

| # | Tarea | Referencia |
|---|-------|------------|
| 6.1 | Cron + Callable admin `reconciliarEstadosCuentaPersona` | `FLUJO_V2` §11 P1.3 |
| 6.2 | Métricas: contador de reconciliaciones, errores Callable, latencia DNI | — |
| 6.3 | Opcional Fase 2 producto: DDJJ flujo completo si Ticket ya expone contrato | `FLUJO_V2` §8 |

**Hecho Fase 6:** checklist de go-live (rollback, feature flag, monitoreo 48 h).

---

## 9. Checklist rápido “¿puedo decir que el módulo está implementado?”

- [ ] Fases 1–4 **completadas** en staging.
- [ ] Fase 5 **verificada** (flujo feliz + 3 casos negativos: DNI inválido, email no verificado si aplica, intento de salto de estado).
- [ ] Fase 6 **programada** antes de producción o en la primera semana prod.
- [ ] Documento **una página** de runbook: variables de entorno, ids de cfg críticos, quién pagina on-call.

---

## 10. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: fases 0–6, criterios de hecho, checklist cierre módulo. |
| 2026-04-22 | **Fase 0.2–0.3:** V2 greenfield; sin dependencia runtime de colecciones V1. |
| 2026-04-22 | **Regla estricta:** proyecto Firestore distinto de V1; sin conexión V1↔V2. |
| 2026-04-22 | Fase 3.2: criterios **PIN 6** + email en `registrarPrimerAcceso` (`MODULO_LOGIN_V2` §1.1). |
| 2026-04-23 | **Fase 0.1 cerrada:** custom claims `persona_id` / `cuenta_id` — `MODULO_LOGIN_V2` §3.3, `DECISIONES` F0.1, [`ARRANQUE_BD_Y_CODIGO_V2.md`](./ARRANQUE_BD_Y_CODIGO_V2.md). |
| 2026-04-23 | **Fase 1 (en repo):** [`scripts/seed-v2/seed-cfg.mjs`](../../scripts/seed-v2/seed-cfg.mjs), `firebase-v2/firestore.indexes.json` (mínimo), `npm run seed:cfg`, `scripts/seed-v2/seed-ids.v2.json`. `match` de Rules en Fase 2. |
