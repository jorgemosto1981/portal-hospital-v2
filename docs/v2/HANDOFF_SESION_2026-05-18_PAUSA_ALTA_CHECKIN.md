# Handoff sesión 2026-05-18 — Epic check-in saldos A/B/C + guía alta RRHH

**Rama:** `feature/ticketera-puente-campos-config`  
**Estado:** **Epic cerrado en código y documentación** (2026-05-18 tarde). Validación operativa: ejecutar [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md) y marcar OK.  
**Proyecto Firebase:** `portal-hospital-v2`  
**Relación:** [`HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md`](./HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md) · [`CHECKIN_SALDOS_BACKLOG.md`](./CHECKIN_SALDOS_BACKLOG.md) · [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md)

---

## Aviso — siguiente foco

> **Epic check-in + alta RRHH:** oleadas **1, 2 y 3** implementadas; refactor hooks (#21) hecho.  
> **Siguiente tanda acordada:** **configurador de artículos** (altas de artículos adicionales para ticketera). Ver plan ticketera en [`HANDOFF_SESION_2026-05-13_TICKETERA.md`](./HANDOFF_SESION_2026-05-13_TICKETERA.md) (campo por campo; primer pendiente histórico: `circuito_ingreso_ids`).

---

## 1. Objetivo original de la tanda

1. Guía de alta completa RRHH (`/portal/rrhh/alta-agente`) con checklist y `?persona_id=`.
2. Pantalla unificada check-in A/B/C (`/portal/rrhh/checkin-saldos`).
3. Backlog S/M/L en tres oleadas + deploy Functions.

---

## 2. Entregado (resumen)

| Oleada | Contenido principal |
|--------|---------------------|
| **1** | Enteros A/B, copy C, toast precarga, `cerrarCheckinGlobal`, URL persona, limpieza legacy |
| **2** | Modal cierre + advertencias, HLc servidor, precarga acotada, avisos meta B/C, cache meta, resumen guía alta, Vitest |
| **3** | Lote B/C transaccional, búsqueda personas server-side, fix rectificación con cierre global, reglas RRHH `personas` |
| **Deuda** | Refactor `useCheckinSaldosPage` + `useCheckinPersonaFlow` en hooks &lt;100 líneas c/u (objetivo modular) |

### Callables vigentes (check-in)

- `obtenerSaldosCheckinPersona`, `persistirCheckinLaoBolsas`, `persistirCheckinSaldoEstandarLote` (B/C), `cerrarCheckinGlobal`
- `buscarPersonasCheckinRrhh`, `obtenerResumenAltaOnboardingPersona`
- No usar desde web: `cerrarCheckinSaldosPortal` (legacy)

### Código web (hooks)

Orquestador: `useCheckinSaldosPage.js` → `useCheckinFormState`, `useCheckinPersonaFlow` (→ `useCheckinPersonaSeleccion`, `useCheckinPersonaDatos`, `useCheckinModoCheckin`, `useCheckinPrecarga`), `useCheckinGuardados`, `useCheckinResumenCierre`.

Página: `CheckinSaldosAgente.jsx`. Guía alta: `AltaAgenteOnboardingRRHH.jsx`.

---

## 3. Deploy

**Functions:** deploy OK 2026-05-18 (`npm run firebase:deploy:functions`). Incluye callables de oleadas 2–3.

**Hosting:** si se prueba en URL desplegada, verificar build/deploy de `web` tras pull (`firebase deploy --only hosting` según pipeline).

---

## 4. Pendiente no bloqueante

| Ítem | Notas |
|------|--------|
| **#23** | Smoke script B/C / rectificación — ampliar y ejecutar en piloto |
| **#24** | Revisado — contrato en backlog § Contrato precarga; whitelist opcional futura |
| **16–18** | Comportamiento vigente: `anio_corte_portal_a` en parciales + cierre; guía exige cierre global |
| Panel agente «Mis saldos» | Fuera de epic |
| Wizard único laboral + check-in | UX futura |

---

## 5. Cómo retomar en otra PC

```bash
git fetch origin
git checkout feature/ticketera-puente-campos-config
git pull origin feature/ticketera-puente-campos-config
cd web && npm install && npm run dev
```

1. Ejecutar matriz: [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md).
2. Para **configurador**: leer [`HANDOFF_SESION_2026-05-13_TICKETERA.md`](./HANDOFF_SESION_2026-05-13_TICKETERA.md) y crear/versionar artículos en `/portal/rrhh/configuracion-articulos`.

---

## 6. Commits de referencia

| Commit | Descripción |
|--------|-------------|
| `ad86cbf` | UI check-in + guía alta + oleada 1 |
| `4dc09f2` | Oleadas 2–3 |
| `74e100e` / `f90ee57` | Refactor hooks + fix setters precarga |

---

## 7. Registro cronológico

| Momento | Acción |
|---------|--------|
| Mañana 18/05 | Guía alta + oleada 1 + deploy + pausa documental |
| Tarde 18/05 | Oleadas 2–3, fixes RRHH/rectificación, refactors, push remoto |
| Cierre Fase A | Matriz pruebas, actualización handoffs, contrato #24, epic cerrado en doc |

**Fecha cierre epic (documental):** 2026-05-18.
