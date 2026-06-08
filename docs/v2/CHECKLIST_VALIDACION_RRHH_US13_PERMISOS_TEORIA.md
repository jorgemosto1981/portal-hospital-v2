# Checklist validación RRHH — US-13 permisos sobre teoría (capa 1)

**Estado:** ✅ **OFICIAL / CERRADO** (2026-06-08) — G1–G7 validados; SSoT permisos teoría US-13 en repo (pre código Fase A)  
**Audiencia:** RRHH, jefes de servicio (referencia), desarrollo  
**Artefacto técnico:** [`MATRIZ_US13_PERMISOS_TEORIA_V2.md`](./MATRIZ_US13_PERMISOS_TEORIA_V2.md)  
**Acta base:** [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) §6.2.1 y §6.3 (Q9-1…Q9-6)

## Cómo usar este documento

1. Leer la **matriz** (canales C1–C10 y ventanas GSO) antes de la reunión.
2. Por cada ítem **G1–G7**, marcar **Decisión** y completar **Notas / capacitación**.
3. Al cerrar, completar **Acta breve** al final y avisar a desarrollo para **Fase A** (código alineado a decisiones).

**Leyenda de decisión:** marcar una opción por ítem; si **Otro**, describir en notas.

---

## Contexto en una frase

La grilla GSO no tiene un botón «editar teoría»: la capa 1 cambia por **plan mensual**, **override del día**, **datos laborales (HLg)**, o **materialización** al consultar. US-13 unifica **quién puede qué** en pantalla y en servidor.

---

## Decisiones registradas

### G1 — ✅ Cerrado 2026-06-08 — Opción **A** (confirmar acta Q9-1 = B)

**Dos caminos (normativa / capacitación):**

| Camino | Uso | Ejemplos |
| :--- | :--- | :--- |
| **Plan** — Revertir → Editar → Aprobar | Cambios **estructurales** o de diseño del mes | Pasar a un agente de mañana a noche **todo el mes**; corregir francos mal cargados de base; llenar días en **blanco** por error de planificación |
| **Grilla** — Override / gestión de turno | Cambios **tácticos**, día a día (contingencias) | Intercambio de guardia **puntual** entre dos médicos; cobertura por falta de último momento; turno **adicional** por pico de demanda ese día |

**Motivo producto:** integridad de datos, cadena de aprobación RRHH y auditoría (evitar teoría inconsistente por parches).

**Urgencias operativas** (override permitido en mes habilitado sin revertir plan):

| # | Frase (capacitación) | Aprobado |
| :---: | :--- | :---: |
| 1 | **Cobertura por ausencia imprevista:** enfermedad, accidente o licencia de fuerza mayor notificada con **menos de 48 h** de anticipación al turno. | ✅ |
| 2 | **Intercambio táctico de guardia:** permuta entre dos agentes por conflicto personal surgido en la **semana en curso**. | ✅ |
| 3 | **Pico de demanda espontánea:** turno adicional en el día por aumento imprevisto de carga (ej. emergencia en Sala). | ✅ |

**Implicación desarrollo (US-13):** alinear UI/callables — bloquear o desviar override «estructural» hacia plan; permitir C5/C6 acotado a estas excepciones + copy de capacitación.

### G2 — ✅ Cerrado 2026-06-08 — Opción **A** (solo superior jerárquico en el `gdt`)

**Norma:** quien **ajusta turno / override** sobre un agente debe ser su **superior jerárquico** en ese **grupo de trabajo** (misma regla que `assertOverrideAuth` en backend).

**Justificación producto:** coherencia con G1 (auditoría y responsabilidad); un jefe no debe alterar teoría de agentes de los que no es responsable.

**UX:** si el servidor no permitirá guardar, **no mostrar** botones de gestión (eliminar «botón engañoso»).

**Implicación desarrollo — Fase B:** refactorizar `grillaGestionTurnoCapabilities.js` (y consumidores: modal día, shell, modales A/B/C) para evaluar **jerarquía HLG real** antes de renderizar gestión turno. RRHH mantiene bypass según matriz G3.

### G3 — ✅ Cerrado 2026-06-08 — **P2** + **Opción B** (RRHH unificado)

**Perfil hospital:** un **solo rol RRHH** hace todo (no segregación labor vs admin en la práctica).

**Permisos normativos (todos Sí para RRHH):**

| Acción | Permitido |
| :--- | :---: |
| Override / batch GSO (C5/C6), incl. mes **M-1** y período **🔒** | ✅ |
| Aprobar / habilitar plan (C3) | ✅ |
| Revertir plan habilitado → `EN_REVISION` (C4b) | ✅ |
| Cerrar período liquidación (C10) | ✅ |

**Implicación desarrollo (US-13):**

- En documentación y matriz: **una columna «RRHH»** (no dos perfiles operativos distintos para el usuario final).
- En código: hoy existen `tokenHasRrhhLaborAccess` y `tokenHasRrhhAccess`; el negocio los trata como **equivalentes** → en **Fase A** `teoriaPermisosGso.js` (y gates UI) usar helper del estilo `esRrhhOperativo(token)` = labor **o** admin, para no bloquear botones por tecnicismo de claim.
- Backend: revisar callables que solo miran uno de los dos claims y alinear en fase posterior si hace falta (sin relajar jefes — G2).

### G4 — ✅ Cerrado 2026-06-08 — Opción **A** (titular sin override)

**Norma:** el **agente** (portal usuario) **no** modifica su propia teoría en GSO. Solo **consulta** («Mi calendario») y tramita cambios por **solicitudes / bandeja**; ejecutan **jefe** (jerárquico, G2) o **RRHH** (G3).

**Justificación:** riesgo de auditoría y de planificación (auto-francos/turnos sin supervisión); coherente con autoridad del jefe y con G1.

**Implicación desarrollo:** cerrar bypass en `assertOverrideAuth` (rechazar `actorPid === targetPersonaId` salvo RRHH) o regla equivalente; UI titular sin gestión turno (ya casi así). Documentar en capacitación portal agente.

### G5 — ✅ Cerrado 2026-06-08 — Opción **A** (confirmar Q9-5)

**Norma:** **listar grilla equipo** (C8) puede **materializar / autosanar** teoría sin confirmación previa. El jefe ve siempre la verdad calculada más reciente (feriados, régimen, plan, etc.) sin interrumpir el flujo.

**Transparencia:** **US-11** toast no invasivo al remat de sector; badge **⚠️** cuando hay conflicto real post-referencia de licencia (Q9-5 causa-agnóstica). **No** modal de confirmación (evitar fatiga de clics — Opción B descartada).

**Implicación desarrollo:** mantener comportamiento actual C8; US-13 solo documenta y no agrega gate «¿rematerializar?». Matiz idempotente sin ⚠️ si no hubo cambio semántico → **v2** opcional (acta).

### G6 — ✅ Cerrado 2026-06-08 — Opción **A** (solo jefe / superior del servicio)

**Norma:** solo quien tiene **autoridad jerárquica** sobre la dotación del `gdt` puede **guardar** (C1) y **enviar** (C2) el plan mensual a RRHH. El envío debe equivaler a la «firma» del superior del servicio, no de cualquier integrante con HLG.

**Justificación:** coherencia con G1, G2 y G4; evita envíos accidentales a bandeja RRHH por usuarios sin jefatura.

**Implicación desarrollo:** endurecer `assertPlanAuth` para `guardar`/`enviar` (ej. `tiene_subordinados` + HLG en grupo, o nivel jerárquico máximo / superior en `gdt` — alinear criterio con G2); gates en `PlanTurnoServicioPage` / editor. Hoy: cualquier HLG vigente en el grupo.

### G7 — ✅ Cerrado 2026-06-08 — **Lanzamiento día 1** (variante B sin pre-campaña)

**Contexto:** la app **aún no** opera en el día a día del hospital — no hay hábitos adquiridos que migrar.

**Norma:** **desplegar reglas estrictas (G1–G6) desde el primer uso en producción.** Los jefes conocen solo el flujo auditado correcto. **Capacitación** (Plan vs Grilla, 3 urgencias G1) integrada en manuales / onboarding / reunión de **lanzamiento**, sin campaña especial previa al deploy.

**Implicación desarrollo:** no feature flag por «modo permisivo»; priorizar Fase A → B → C en la versión de go-live. Copy en UI como refuerzo, no como sustituto de capacitación inicial.

---

## Resumen ejecutivo — implementación US-13

| ID | Decisión | Acción código (referencia) |
| :--- | :--- | :--- |
| **G1** | Plan vs override; 3 urgencias | Gates C5/C6 mes HABILITADO; derivar a C4b + editor |
| **G2** | Solo superior jerárquico | `grillaGestionTurnoCapabilities` + jerarquía HLG |
| **G3** | RRHH unificado | `esRrhhOperativo` (labor ∨ admin); columna única en matriz |
| **G4** | Titular sin override | `assertOverrideAuth`: no self salvo RRHH |
| **G5** | Q9-5 + US-11 | Mantener C8; sin modal remat |
| **G6** | Solo jefe guarda/envía plan | `assertPlanAuth` guardar/enviar |
| **G7** | Reglas estrictas día 1 | Sin rollout gradual por hábitos |

**Orden sugerido:** Fase A `teoriaPermisosGso.js` → Fase B UI → Fase C callables + copy.

---

## Ítems obligatorios (brechas G1–G7)

### G1 — Plan vs override en mes HABILITADO (acta **Q9-1 = B**) — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Decisión** | [x] Confirmamos acta Q9-1 (B) tal cual — **Opción A** |

---

### G2 — Quién es «jefe» para gestionar turno en GSO — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Decisión** | [x] Solo superior jerárquico (alinear UI a backend) — **Opción A** |

---

### G3 — RRHH labor vs admin — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Perfil** | [x] **P2** — Un solo rol RRHH |
| **Decisión** | [x] **Opción B** — permisos unificados (GSO + plan + C10) |

---

### G4 — Titular: cambio de turno sobre sí mismo — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Decisión** | [x] **Opción A** — No override titular; bloquear en servidor + solo consulta/solicitudes |

---

### G5 — Materializar al «solo abrir» grilla equipo (C8) — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Decisión** | [x] **Opción A** — Confirmar Q9-5 (A); US-11 + ⚠️; sin modal confirmación |

---

### G6 — Quién guarda y envía el plan mensual (C1 / C2) — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Decisión** | [x] **Opción A** — Solo jefe / superior jerárquico del servicio (`guardar` + `enviar`) |

---

### G7 — Prioridad de implementación — ✅ ver § Decisiones registradas

| Campo | Contenido |
| :--- | :--- |
| **Decisión** | [x] **Lanzamiento día 1** — reglas G1–G6 en go-live; capacitación en onboarding (sin pre-campaña) |

---

## Ítems de confirmación acta (ya decididos — validar que sigan vigentes)

Marcar si **siguen vigentes** sin cambio; si no, anotar en notas.

| ID acta | Tema | Respuesta acta | ¿Vigente? | Notas |
| :--- | :--- | :--- | :---: | :--- |
| **Q9-2** | Motivo del override | **A** — texto libre obligatorio (auditoría) | [x] Sí | Confirmado en sesión G1 |
| **Q9-6** | Acciones ante ⚠️ (US-14) | **1+2+3** — bandeja, ajustar turno, derivar plan | [x] Sí | |
| **Q3-2** | Copy post-deshabilitar HLg | Texto 📅 acordado | [x] Sí | |
| **—** | Celda blanca (US-16) | Prohibido operar; corrección vía plan | [x] Sí | Alineado G1/G6 |

---

## Ventanas de tiempo (confirmación operativa)

| Situación | Jefe puede override / batch | RRHH puede override | ¿OK RRHH? |
| :--- | :--- | :--- | :---: |
| Mes **anterior** (M-1) desde día 1 del mes actual | No (`ASI-GSO-001`) | Sí (RRHH unificado G3) | [x] |
| Período **cerrado** 🔒 para liquidación | No | Sí (RRHH) | [x] |
| Mes actual / futuro, plan **HABILITADO** | Solo urgencias G1 (implementar en go-live) | Sí | [x] |

---

## Acta breve de cierre (completar al terminar reunión)

| Campo | Valor |
| :--- | :--- |
| **Fecha validación política (G1–G7)** | 2026-06-08 (sesión iterativa checklist) |
| **Contexto** | Pre go-live hospital — sin usuarios con hábitos previos |
| **G1–G7** | [x] **Todos cerrados** — ver § Decisiones registradas + Resumen ejecutivo |
| **Lista urgencias override (G1)** | [x] § Decisiones registradas (3 frases) |
| **G7 lanzamiento** | [x] Reglas estrictas día 1; capacitación en onboarding |
| **Código + deploy** | [x] Fases A/B/C · `origin/master` · hosting + functions 2026-06-08 |

**Firma / visto bueno RRHH (nombre + rol):**  

---

## Acta smoke post-deploy (staging / piloto — completar tras ejecución humana)

| Campo | Valor |
| :--- | :--- |
| **Fecha smoke** | *(pendiente)* |
| **GDT** | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` (Sala Internación 1 / Clínica Médica — confirmar etiqueta UI) |
| **Período** | `2026-06` · plan `plt_01KT9AZQGV0BRZVSEEMBT0141A` (estado al probar: _______) |
| **Jefe_Sala** | cuenta _______ · `per_*` _______ · nivel HLG en GDT _______ |
| **Medico_Planta** | cuenta _______ · `per_*` _______ (ej. LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB`) |
| **Administrativo_RRHH** | cuenta _______ · `per_*` _______ |
| **G4** | ☐ `TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA` |
| **G2** | ☐ `NO_ES_SUPERIOR_JERARQUICO` |
| **G1** | ☐ sin urgencia bloqueado · ☐ con urgencia permitido |
| **G6** | ☐ `SOLO_JEFE_O_RRHH_PUEDE_EDITAR_PLAN` |
| **G3 opc.** | ☐ RRHH override sin urgencia en HABILITADO permitido |
| **Estado US-13 ops** | ☐ **Cerrado** ☐ Hallazgos (ver notas) |

**Notas / hallazgos:**  

**Firma operador smoke:**  

*Protocolo detallado:* [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) § **Unidad piloto — smoke US-13 post-deploy**.

---

## Referencia rápida — canales (solo lectura reunión)

| Canal | En lenguaje RRHH |
| :--- | :--- |
| **C1–C4** | Plan mensual: borrador, envío, aprobación, rechazo |
| **C4b** | RRHH devuelve plan habilitado a **en revisión** sin borrar turnos ya materializados |
| **C5–C6** | Ajuste **del día** en GSO (cobertura, cambio, adicional, lote) |
| **C7** | Datos laborales / HLg / régimen |
| **C8** | Abrir grilla equipo (puede recalcular teoría — US-11) |
| **C10** | Cerrar mes para liquidación (jefe queda solo lectura) |

Detalle técnico: [`MATRIZ_US13_PERMISOS_TEORIA_V2.md`](./MATRIZ_US13_PERMISOS_TEORIA_V2.md).

---

## Historial

| Fecha | Cambio |
| :--- | :--- |
| 2026-06-08 | Checklist inicial para validación RRHH (US-13) |
| 2026-06-08 | **G1 cerrado** — Opción A; caminos Plan vs Grilla + 3 urgencias operativas |
| 2026-06-08 | **G2 cerrado** — Opción A; Fase B → jerarquía HLG en `grillaGestionTurnoCapabilities.js` |
| 2026-06-08 | **G3 cerrado** — P2 + Opción B; columna RRHH unificada; `esRrhhOperativo` en Fase A |
| 2026-06-08 | **G4 cerrado** — Opción A; bloquear self-override en `assertOverrideAuth` |
| 2026-06-08 | **G5 cerrado** — Opción A; Q9-5 + US-11; sin modal remat |
| 2026-06-08 | **G6 cerrado** — Opción A; `assertPlanAuth` guardar/enviar solo jefatura |
| 2026-06-08 | **G7 cerrado** — lanzamiento día 1; checklist completo |
| 2026-06-08 | Estado **OFICIAL / CERRADO** — commit SSoT US-13 en repo |
