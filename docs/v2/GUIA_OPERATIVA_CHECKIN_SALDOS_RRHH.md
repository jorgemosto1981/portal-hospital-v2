# Guía operativa — Check-in de saldos (RRHH)

**Audiencia:** operadores RRHH.  
**Pantalla:** `/portal/rrhh/checkin-saldos`  
**Copy en app (SSoT):** `web/src/features/checkinSaldos/checkinSaldosAyudaRrhh.js` (modal botón **i**).

---

## Objetivo

Registrar la fotografía inicial de saldos del agente en el portal V2 (patrones A, B y C), con opción de rectificación posterior. La guía de alta RRHH marca el paso check-in como listo solo tras el **cierre global** (`checkin_saldos_portal_en`).

---

## Flujo resumido

1. Elegir agente (`per_*`).
2. Año de corte **A** (go-live portal).
3. Si hay historial → **Check-in nuevo** o **Rectificación**.
4. Check-in nuevo → confirmar **HLC** operativas.
5. Cargar pestañas LAO (A), Ciclos (B), Cuenta continua (C); guardado parcial por pestaña.
6. Check-in nuevo → **Finalizar check-in global** (modal 3 pasos).

---

## Patrones en pantalla

| Pestaña | Patrón | Qué informar |
|---------|--------|----------------|
| LAO disponibles | A | Años &lt; A con días enteros (histórico). Desde A: motor por antigüedad. |
| Ciclos anuales | B | Días consumidos en ciclo A; saldo según cupo del artículo. |
| Cuenta continua | C | Saldo entero actual; vacío = 0. |

---

## Validaciones clave

- Solo rol RRHH.
- Años LAO &lt; A, enteros, sin duplicar año.
- B/C: enteros; guardado B y C atómico (varios artículos en un envío).
- Cierre global: checklist de advertencias; no garantiza todas las bolsas del hospital cargadas.
- Rectificación: no reabre cierre global; no exige HLC de nuevo.

---

## Referencias técnicas

- [`HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md`](./HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md)
- [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md)
- [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md)
