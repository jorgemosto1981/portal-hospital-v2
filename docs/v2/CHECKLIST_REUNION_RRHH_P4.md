# Checklist reunión RRHH — Bandeja auditoría médica (épica 1919 · P4)

> **Uso:** guion de demostración en vivo (~30–45 min). No sustituye el acta formal; la acompaña.  
> **Piloto:** https://portal-hospital-v2.web.app  
> **`master`:** `7a719a6` (código P0/P1/P2b + docs smoke + evidencia P2b)  
> **Acta:** [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md)  
> **Evidencia técnica:** [`HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md`](./HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md)

---

## Antes de la reunión (5 min)

| # | Preparación | ✓ |
|---|-------------|---|
| 0.1 | Usuario con rol **auditor médico** en piloto V2 (no V1). | ☐ |
| 0.2 | Navegador en **ventana incógnita** o hard refresh (`Ctrl+Shift+R`) para evitar cache. | ☐ |
| 0.3 | Tener a mano este checklist + acta impresa o en segunda pantalla. | ☐ |
| 0.4 | Confirmar que **no** se usará Firebase Console durante la demo (“cero consola”). | ☐ |

**Rutas clave**

| Rol | Ruta |
|-----|------|
| Auditor médico | `/portal/medico/solicitudes` (bandeja clasificación) |
| Junta médica | `/portal/medico/junta` |
| Grilla operativa | Grilla del titular / sector (según perfil demo) |

**Titular de referencia (piloto):** MOSTO, JORGE ANTONIO — DNI **28914247**

---

## Mensaje de apertura (1 min)

> “La bandeja de auditoría médica ya no es un visor de PDFs: el auditor ve **certificado**, **ficha del agente**, **preview normativo en vivo** y puede **corregir fechas** con trazabilidad en base de datos. Todo el circuito agente → auditor → junta → grilla fue smoke-testeado en piloto.”

---

## Pilar 1 — Integridad operativa (datos clínicos sin consola)

**Objetivo:** demostrar que el auditor no necesita Firebase Console para contacto ni contexto clínico.

| # | Acción en pantalla | Qué debe ver RRHH | ✓ |
|---|-------------------|-------------------|---|
| 1.1 | Abrir bandeja auditor → filtro **Completas** → buscar aviso pendiente (o mostrar caso histórico en detalle si no hay pendientes). | Listado ordenado por fecha de inicio. | ☐ |
| 1.2 | Expandir un aviso → sección **Certificado médico**. | PDF embebido (visor P0). | ☐ |
| 1.3 | Debajo del PDF: **Ficha del aviso (agente)**. | Badge tipo ingreso (ej. *Enfermedad propia*), **Contacto** (teléfono, email, domicilio), **Declaración clínica** (síntomas). | ☐ |
| 1.4 | Narrar: *“Estos datos los declaró el agente al dar el aviso; son solo lectura y no reemplazan el certificado.”* | Comprensión RRHH. | ☐ |

**Caso blindado (evidencia P1 + P2b):** `sol_01KWM0R9KMDEJ7ZKS416H5FSGR`  
— Ficha con contacto `3466004444`, domicilio IRIGOYEN 511; dictamen cerrado 21/07/2026.

---

## Pilar 2 — Control de tiempos (P2b: edición + trazabilidad)

**Objetivo:** el auditor puede ajustar fechas; el sistema avisa, recalcula tramos y persiste el flag de corrección.

| # | Acción en pantalla | Qué debe ver RRHH | ✓ |
|---|-------------------|-------------------|---|
| 2.1 | En un aviso **pendiente de clasificación**, abrir sección **Rango de licencia (dictamen)**. | Inputs fecha Desde / Hasta editables. | ☐ |
| 2.2 | Cambiar **Hasta** a una fecha distinta del aviso original. | Banner ámbar: *“Atención: Estás modificando el rango de fechas original…”* | ☐ |
| 2.3 | Observar **Preview normativo (Art. 14)** sin dictaminar. | Tramos 100% / 60% / sin remuneración se **recalculan en vivo** al cambiar fechas. | ☐ |
| 2.4 | (Opcional en vivo) Dictamen favorable con fechas editadas. | Toast de éxito + aviso sale de la cola pendiente. | ☐ |
| 2.5 | Mencionar trazabilidad Firestore (sin abrir consola): `auditor_medico_clasificacion.fechas_corregidas_por_auditor: true`. | Evidencia: [`EVIDENCIA_P2B_DICTAMEN_2026-07-03.md`](./EVIDENCIA_P2B_DICTAMEN_2026-07-03.md) — caso `sol_01KWM0…` estimado 22/07 → dictamen 21/07. | ☐ |

**Caso histórico P2b UI:** `sol_01KWKVW4SED7ETGKPDMB61ES8Q` — aprobación 2 d (20–21/07) con preview 60% en sesión UAT.

---

## Pilar 3 — Flujo de derivación (junta vs aprobación directa)

**Objetivo:** bifurcación automática >15 días; junta cierra o revierte en grilla.

| # | Escenario | Caso piloto | Qué validar | ✓ |
|---|-----------|-------------|-------------|---|
| 3.1 | **≤15 d** — aprobación directa | `sol_01KWKVW4SED7ETGKPDMB61ES8Q` | Estado `Aprobada`; grilla día 20/07 con código **14**. | ☐ |
| 3.2 | **>15 d** — derivación a junta | `sol_01KWKTC9BD5BJQ37TMAGADN1XR` (32 d) | Auditor derivó; junta favorable; consolidado en grilla desde 23/07. | ☐ |
| 3.3 | Junta **desfavorable** | `sol_01448C1850AA72A73CED4C2C65` | `cfg_esa_rechazada`; licencia **no** proyectada en grilla (REVERTIR). | ☐ |
| 3.4 | Modal día grilla — período dictamen | Cualquier día de casos aprobados | Período efectivo + aviso si fechas corregidas por auditor (P2b modal grilla). | ☐ |

**Narrativa junta:** *“Por encima de 15 días corridos el dictamen favorable del auditor deriva a junta; la aprobación sustantiva final la registra junta médica, no jefatura ni RRHH genérico.”*

---

## Demostración en vivo sugerida (15 min) — “El caso perfecto”

Orden recomendado si hay un aviso **nuevo pendiente**; si no, usar capturas + casos históricos de la tabla.

1. **Agente** (opcional, 2 min): mostrar mensaje *“Tu aviso fue recibido”* y ref. `sol_…`.
2. **Auditor — Pilar 1:** abrir aviso → PDF + ficha contacto/clínica.
3. **Auditor — Pilar 2:** editar fechas → banner → preview 60%/100% → (opcional) dictaminar.
4. **Grilla:** abrir día de la licencia → modal con período y estado **Aprobada**.
5. **Cierre:** mostrar acta checklist firmable.

---

## Preguntas frecuentes RRHH (respuestas cortas)

| Pregunta | Respuesta |
|----------|-----------|
| ¿El auditor puede cambiar datos del agente? | No. Solo fechas del dictamen y artículo imputado; ficha agente es solo lectura. |
| ¿Qué pasa si el certificado falta? | Aviso **provisorio** — no aparece en cola “Completas”; filtro dedicado. |
| ¿Quién aprueba licencias ≤15 d? | **Auditor médico** (callable backend; no editable desde UI agente). |
| ¿Dónde queda la trazabilidad? | `auditor_medico_clasificacion` en `solicitudes_articulo` + MDC en grilla. |
| ¿Producción V1? | **No.** Piloto V2 aislado (`portal-hospital-v2`). |

---

## Veredicto reunión (completar al cierre)

| Ítem | GO / Ajuste / Pendiente | Notas |
|------|-------------------------|-------|
| Pilar 1 — Ficha sin consola | | |
| Pilar 2 — Fechas + trazabilidad | | |
| Pilar 3 — Junta y grilla | | |
| **Acta RRHH P4** — firma | | |

**Participantes**

| Rol | Nombre | Firma / Fecha |
|-----|--------|---------------|
| RRHH | | |
| Medicina laboral / auditoría | | |
| Producto / desarrollo | | |

---

## Después de la reunión

- [ ] Registrar veredicto en [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) (sección Firmas).
- [ ] Si RRHH pide **más historial normativo en bandeja** sin abrir preview → backlog **P4.3b** (historial inline en ficha).
- [ ] Si GO total → tag release / comunicado interno piloto.

---

## Referencias rápidas repo

| Documento | Contenido |
|-----------|-----------|
| [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) | Acta institucional P4 |
| [`HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md`](./HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md) | Smoke 6/6 PASS |
| [`EVIDENCIA_P2B_DICTAMEN_2026-07-03.md`](./EVIDENCIA_P2B_DICTAMEN_2026-07-03.md) | Flag `fechas_corregidas_por_auditor` |
| [`BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md`](./BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md) | Brechas cerradas / backlog |
