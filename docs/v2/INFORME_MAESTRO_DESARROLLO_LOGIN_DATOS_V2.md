# Informe maestro — Plan V2 Login + datos personales (evaluación e instrucciones de desarrollo)

**Audiencia:** quien tome decisiones técnicas y quien implemente el módulo.  
**Fecha:** 22 de abril de 2026.

Este documento **no duplica** el contrato campo a campo; **evalúa** el plan actual y define **cómo ordenar el trabajo de código** cuando se decida ejecutar.

---

## 1. Frase de encargo (copiar al abrir el trabajo de implementación)

> **Desarrollar el código del módulo Login + datos personales V2** siguiendo estrictamente, en este orden de lectura y obligaciones:  
> (1) [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) **fases 0–6** (orden de trabajo y criterios de hecho),  
> (2) [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md),  
> (3) [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md),  
> (4) [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5–§6,  
> (5) [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md),  
> (6) [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) §1–§4 y §9,  
> (7) [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) — **lecciones** desde V1 y anti-patrones; **prohibido** conectar la V2 a la BD, Auth o Functions de la V1 (sin migración, sin lectura cruzada).  
> **Prohibido** persistir estados de negocio como strings libres en `personas` / `usuarios_cuenta`; **prohibido** duplicar `username` en `personas`; **prohibido** elevar `estado_acceso` a *activo portal* desde cliente sin el Callable `completarOnboardingDatos` (o equivalente documentado).  
> **Obligatorio** credenciales según [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§1.1:** en UI el acceso es **DNI + PIN**; el PIN es **numérico de 6 dígitos** definido por el agente en el **primer acceso** junto con el **correo**; salvo **RFC** no se admiten otras políticas de contraseña para el portal.

*(La misma lista vive desglosada en [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) para ejecutar tarea por tarea.)*

---

## 2. Evaluación del plan (nivel maestro)

### 2.1 Fortalezas

| Área | Por qué ayuda al desarrollo |
|------|------------------------------|
| **Separación de concerns** | `personas` vs `usuarios_cuenta` vs `formacion_agente` reduce el “documento dios” de V1 y permite equipos paralelos (identidad vs ficha). |
| **Estados solo `*_id`** | Obliga a UI a leer catálogos; facilita administración sin redeploy por etiqueta nueva. |
| **Flujo A–E explícito** | Reduce discusiones en sprint (“¿el menú antes o después de la DDJJ?”). |
| **Matriz de acceso + Callables** | [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) anticipa el error típico: reglas permisivas + transiciones en cliente. |
| **P1 de seguridad** razonado en documentación | Enumeración DNI, `emailVerified`, reconciliación: criterios testeables (*revisar con plan maestro*). |

### 2.2 Debilidades / riesgos del plan como insumo a código

| Riesgo | Impacto en desarrollo | Mitigación ya en doc o pendiente |
|--------|-------------------------|----------------------------------|
| **Contrato muy extenso** (`MODULO_DATOS_PERSONALES` §3, 102 ítems) | Costo de implementar validación 1:1; riesgo de olvidar un campo † o **[P]**. | Generar capa de validación única (servidor) derivada del checklist; tests de tabla. |
| **Pseudocódigo §5.2 con `codigo_interno`** | Tentación de `switch(string)` en frontend. | Ya se dijo usar **flags** en cfg; en código: **solo** `estado_*_id` + resolución de doc cfg. |
| **§3.3 Login “claims pendiente”** | Bloqueo de diseño si el equipo espera claims antes de escribir Rules. | Decidir en Fase 0: **solo Firestore** para `persona_id` en sesión vs **custom claims**; no bloquea Callables. |
| **Semilla §6 con ids placeholder** | Si se copian a prod sin reemplazo, datos “pegados” a ejemplos. | Script de seed que **genere ULID** y exporte `seed-ids.json` para env; documentado en `MODULO_CONFIGURACION_V2` §7. |
| **Ticket / `cfg_requisitos_ticket`** | DDJJ y menú dependen de otro módulo aún en desarrollo en doc. | Implementar V2 con **stubs** de lectura de DDJJ; contrato de `estado_declaracion_id` acotado en módulo datos personales. |

### 2.3 Conclusiones

1. El plan es **suficiente para iniciar implementación** del núcleo (A→E, gating, cuenta+persona) **sin ambigüedad de flujo**.
2. El mayor riesgo de proyecto **no es la documentación** sino la **disciplina de implementación**: reglas Firestore y transiciones **solo** en Callables.
3. La **V2 es independiente de la V1** (nueva BD, código y datos): **sin** migración de datos, **sin** APIs ni cliente apuntando al proyecto Firebase de la V1, **sin** jobs que sincronicen ambas bases.
4. El módulo **cruza** frontend, Functions y Rules: sin **dueño de función** (un dev o par) que cierre Fase 1–3 del orden de desarrollo, se reproduce el patrón V1 (UI adelantada, seguridad a remiendo).

---

## 3. Impacto por capa al desarrollar

| Capa | Impacto | Esfuerzo relativo |
|------|---------|-------------------|
| **Firestore / índices** | Nuevas colecciones, índices compuestos para `usuarios_cuenta` por `auth_uid` y `persona_id`, sparse unique. | Medio |
| **Cloud Functions** | Mínimo 3–4 Callables + cron reconciliación; Admin SDK; transacciones. | Alto |
| **Security Rules** | Reescritura fuerte vs V1 (`allow read if auth==null` en usuarios); validación obligatoria antes de producción (matriz de casos / suite de reglas según política del equipo, contra proyecto remoto o herramienta de testing acordada). | Alto |
| **Frontend** | Router post-login, wizard sin menú, formularios desde `cfg_*`, sin tocar `username` en pantalla datos. | Alto |
| **QA / automatización** | Matriz §5.3 + casos P1.1 (mensaje genérico) + emailVerified. | Medio |
| **Legal / PDP** | `ip_origen` en consentimientos (lista P 14); revisión con abogacía antes de “obligatorio”. | Variable |

---

## 4. Propuestas de mejora (recomendadas antes o durante el código)

1. **Un solo módulo npm o carpeta `functions/src/v2/identidadDatos/`** con Callables + tests, en lugar de dispersar en archivos sueltos.
2. **Contrato JSON Schema o Zod** generado a partir de una **tabla mínima** exportada desde §3 (no 102 hand-written duplicados): una fuente para servidor y cliente.
3. **`destinoTrasAuth`** como paquete compartido (`packages/domain` o `src/domain/sessionRouting.ts`) importado por **app web** y por **Functions** (misma lógica de flags cfg).
4. **Entorno V2 dedicado:** proyecto Firebase / BD **distintos** de los de producción V1. No reutilizar la misma instancia Firestore que la app V1 (evita acoplamiento y lectura cruzada). Flags de despliegue solo para **rollout interno de V2**, no para “mezclar” datos con V1.
5. **Documentar decisión §3.3** en un párrafo en `MODULO_LOGIN_V2.md` cuando se elija claims vs solo Firestore (mejora post-informe).

---

## 5. Relación con otros documentos

| Documento | Rol frente a este informe |
|-------------|---------------------------|
| [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) | **Plan de ejecución** fase a fase (usar como checklist de sprint). |
| [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) | Marco modular y cierre plan doc. |
| [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) | Lecciones desde V1, criterios de alineación (guía) (**sin** migración ni conexión técnica V1↔V2). |

---

## 6. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: evaluación maestro, impacto, conclusiones, mejoras, frase de encargo. |
| 2026-04-22 | Alineación **greenfield:** frase de encargo §1, conclusiones §2.3, mejoras §4, tabla §5. |
| 2026-04-22 | **Regla estricta:** sin conexión V1↔V2; §2.3, §4 y §5 actualizados. |
| 2026-04-22 | §1 frase de encargo: **PIN 6 + DNI + correo** (`MODULO_LOGIN_V2` §1.1). |
