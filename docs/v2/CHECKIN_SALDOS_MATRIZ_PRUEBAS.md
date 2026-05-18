# Matriz de pruebas — Check-in saldos + guía alta RRHH

**Epic:** check-in A/B/C + onboarding RRHH (oleadas 1–3).  
**Rutas:** `/portal/rrhh/checkin-saldos` · `/portal/rrhh/alta-agente` · legado `/portal/rrhh/lao-checkin`  
**Rama de referencia:** `feature/ticketera-puente-campos-config`  
**Proyecto Firebase:** `portal-hospital-v2`

Marcar **OK** / **Falla** / **N/A** y anotar `persona_id` / fecha / operador.

---

## A. Check-in — agente sin historial

| # | Paso | Resultado esperado | OK |
|---|------|-------------------|-----|
| A1 | Elegir agente sin bolsas ni flags de check-in | Auto-modo **Check-in nuevo**; no pide rectificación | |
| A2 | Indicar año **A**, confirmar **HLC** | Formulario habilitado en pestañas | |
| A3 | Pestaña LAO: cargar ≥1 año &lt; A, guardar parcial | Toast éxito; bolsa en `saldos_articulo_agente` | |
| A4 | Pestaña B: informar días usados en un artículo, guardar | Un solo callable lote; todas las filas informadas persisten | |
| A5 | Pestaña C: informar saldo, guardar | Ídem lote atómico | |
| A6 | Finalizar check-in global (modal 3 pasos + advertencias si aplican) | `checkin_saldos_portal_en` en persona; modal cierra | |

---

## B. Check-in — agente con historial (precarga)

| # | Paso | Resultado esperado | OK |
|---|------|-------------------|-----|
| B1 | Elegir agente con bolsas existentes | Precarga filas LAO / B / C; toast **una vez** por `persona:A` | |
| B2 | Elegir **Rectificación** | Sin HLC; formulario editable; no botón cierre global reactivo | |
| B3 | Corregir solo una pestaña y guardar | Solo bolsas tocadas se actualizan; `version_id_origen` conservado si existía | |

---

## C. Check-in — cierre global previo

| # | Paso | Resultado esperado | OK |
|---|------|-------------------|-----|
| C1 | Agente con `checkin_saldos_portal_en` | No queda trabado en «nuevo»; pide **Rectificación** o checkbox recarga en banner | |
| C2 | Rectificación + guardado LAO/B/C | Sin error `already-exists` por consumo previo (flags rectificación) | |
| C3 | Intento «Check-in nuevo» sin autorizar recarga | Bloqueo claro (toast / banner) | |

---

## D. Combobox y URL

| # | Paso | Resultado esperado | OK |
|---|------|-------------------|-----|
| D1 | Abrir combobox y escribir DNI/nombre | `buscarPersonasCheckinRrhh` devuelve opciones (server-side) | |
| D2 | Entrar con `?persona_id=per_…` | Precarga agente; no pisa si el operador ya eligió otro manualmente | |
| D3 | Cambiar de agente | Formulario y modo se reinician | |

---

## E. Guía alta RRHH

| # | Paso | Resultado esperado | OK |
|---|------|-------------------|-----|
| E1 | `/portal/rrhh/alta-agente?persona_id=per_…` | Tracker carga sin listar colecciones enteras | |
| E2 | Paso laboral incompleto | Indicador pendiente + enlace a datos laborales | |
| E3 | Check-in «Listo» | Solo si `checkin_saldos_portal_en` (cierre global), no solo LAO parcial | |
| E4 | Deep-link a check-in desde guía | Misma persona en URL | |

---

## F. Errores y permisos

| # | Paso | Resultado esperado | OK |
|---|------|-------------------|-----|
| F1 | Usuario RRHH sin claims | Mensaje legible (no pantalla en blanco) | |
| F2 | Bolsa LAO con consumo, guardar como «nuevo» | Mensaje orienta a **Rectificación** | |
| F3 | Pestaña B/C con artículo sin patrón / metaError | Aviso en listado (`articulosConProblema`) | |

---

## G. Regresión técnica (opcional)

```bash
cd web && npm test -- --run checkinOleada2
```

| # | Comando | Esperado | OK |
|---|---------|----------|-----|
| G1 | Vitest `checkinOleada2` | 10/10 pass | |

---

## Cierre del epic

| Criterio | OK |
|----------|-----|
| Matriz A–E ejecutada en entorno acordado (local o hosting desplegado) | |
| Sin fallas bloqueantes abiertas | |
| Backlog #24 revisado (contrato precarga) | |
| Decisiones 16–18 documentadas como **comportamiento vigente** | |

**Siguiente foco acordado:** configurador de artículos (altas adicionales para ticketera).
