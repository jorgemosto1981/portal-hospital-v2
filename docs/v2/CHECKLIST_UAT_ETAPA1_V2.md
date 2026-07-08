# Checklist UAT (User Acceptance Testing) — Etapa 1 V2

**Estado:** aceptado · 2026-07-08  
**Origen:** plan Etapa 1 vida real

**Objetivo:** Validar flujos críticos Etapa 1 y superficies por rol antes del Soft Launch.

### Prerrequisitos (agregar al acta al ejecutar)

- GDT de prueba definido (p. ej. Sala Internación 1 u otro).  
- Al menos: 1 agente allowlist, 1 agente fuera de allowlist, 1 jefe con HLg > agentes, 1 RRHH.  
- Check-in saldos 64-A/64-B cargados en el agente de prueba.  
- Artículos Etapa 1 publicados; LAO/médicas no visibles en catálogo filtrado.  
- Anotar: fecha, entorno (URL + proyecto Firebase), executor, resultado por ítem.

### 1. Agente piloto

**Superficie:** login, solicitudes Etapa 1, historial. Sin LAO/médicas/GSO.

- Acceso: login usuario+PIN OK; fuera de allowlist → menú vacío o rechazo sin operar; sin menús fuera de alcance.  
- Catálogo: solo 64-A, 64-B, 63.j, Cambio de día.  
- Casos: alta 64 con saldo B; alta 63.j con opciones de vínculo; wizard Cambio de día (origen/destino/motivo) con elegibilidad.  
- Seguimiento: historial con estado (p. ej. `en_revision_jefe`).  
- **Refuerzo UAT:** cancelación agente solo en borrador / en revisión (si el RFC lo permite en Etapa 1); intento de alta LAO/médica debe fallar también en callable (no solo UI).

### 2. Jefe piloto

**Superficie:** solo bandeja aprobar/rechazar. **Sin GSO / sin turnos / sin Flujo A/B/C.**

- Login + bandeja visible; GSO y modales de gestión turno inaccesibles (menú y deep-link).  
- Recepción de 64 / 63.j / Cambio de día de agentes a cargo.  
- Rechazo → agente ve rechazada.  
- Aprobación 64/63.j → proyección MDC + aparece para TC RRHH.  
- Aprobación Cambio de día → sale de pendientes jefe; B-BATCH server-side **sin** abrir grilla.  
- **Refuerzo UAT:** solicitud de agente de **otro** GDT no debe autorizarse por este jefe (o no aparece / rechazo duro).

### 3. RRHH

**Superficie:** dueño operativo — TC, remediación, GSO completa (temporal hasta cerrar módulo).

- Bandeja TC recibe aprobadas por jefe.  
- Acceso GSO + creación/edición turnos.  
- Happy path Cambio de día: en GSO el turno quedó en día destino / origen franco.  
- Unhappy path: B-BATCH falla → estado remediación (no “aprobada fantasma”); RRHH aplica manual en GSO.  
- **Refuerzo UAT:** huérfana (agente sin superior) cae en RRHH con cierre sustituto según RFC (smoke 1 caso).

### Go / No-Go Soft Launch (Fase 1 → 2)

1. Checklist UAT **100% verde** en entorno de pruebas alineado a prod (mismo proyecto o mirror; GDT definido).  
2. **Cero bloqueantes** en puente Cambio de día (ticketera → B-BATCH / remediación).  
3. **Aislamiento confirmado:** agentes sin LAO/médicas; jefes sin GSO.  
4. **Gate deploy:** ningún release a prod piloto Etapa 1 sin este UAT verde (o subset smoke firmado) — detallado en política de deploy.

---
