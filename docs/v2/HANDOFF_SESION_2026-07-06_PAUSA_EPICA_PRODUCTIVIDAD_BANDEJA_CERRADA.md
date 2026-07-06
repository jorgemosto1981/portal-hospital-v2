# Handoff — PAUSA sesión 2026-07-06 · épica productividad bandeja auditor C1–C4 CERRADA

> **PAUSA AQUÍ — retomar en otra PC (2026-07-07+)**  
> **Rama:** `master` @ `daf8b6b` · sincronizada con `origin/master`  
> **Veredicto sesión:** **Épica productividad bandeja auditor (Opción C) COMPLETA** — C1 → C4 UAT VERDE

**Remoto:** https://github.com/jorgemosto1981/portal-hospital-v2.git  
**Piloto Firebase:** `portal-hospital-v2` · hosting prod sin UI bandeja C2–C4 (dev local)

---

## 1. Hitos cerrados hoy (2026-07-06)

| Bloque | Tag | Handoff |
|--------|-----|---------|
| **C2** CIE-10 + causal Art. 19 | `v1919-C2-cie10` | [`HANDOFF_SESION_2026-07-06_CIERRE_C2_CIE10_CLASIFICACION.md`](./HANDOFF_SESION_2026-07-06_CIERRE_C2_CIE10_CLASIFICACION.md) |
| **C3** Señales §5.8 | `v1919-C3-senales-58` | [`HANDOFF_SESION_2026-07-06_CIERRE_C3_SENALES_58.md`](./HANDOFF_SESION_2026-07-06_CIERRE_C3_SENALES_58.md) |
| **C4** Modal historial LM | `v1919-C4-modal-historial-lm` | [`HANDOFF_SESION_2026-07-06_CIERRE_C4_MODAL_HISTORIAL_LM.md`](./HANDOFF_SESION_2026-07-06_CIERRE_C4_MODAL_HISTORIAL_LM.md) |

**Histórico previo en la épica:** C1 @ `v1919-C1-bandeja-optimizada` · P4 bandeja @ `v1.0-epica-1919-p4`

---

## 2. Callables desplegados en piloto (sin hosting web)

| Callable | Bloque |
|----------|--------|
| `listarCie10BandejaAuditor` | C2 |
| `listarCausalLargaBandejaAuditor` | C2 |
| `clasificarSolicitudMedicaAuditor` | C2 |
| `listarSolicitudesBandejaAuditorMedica` | C3 |
| `obtenerHistorialLmTitularBandejaAuditor` | C4 |

**Regla acordada:** UI bandeja C2–C4 probada en **dev local** (`npm run dev:web`). Deploy hosting diferido hasta paquete UI completo.

---

## 3. Smokes certificados

```bash
node scripts/smoke/med-c2-cie10-clasificacion.mjs
node scripts/smoke/med-c3-senales-58.mjs
node scripts/smoke/med-c4-modal-historial-lm.mjs
```

---

## 4. Retomar en otra PC

```bash
git clone https://github.com/jorgemosto1981/portal-hospital-v2.git
cd portal-hospital-v2
git checkout master
git pull origin master
git fetch --tags
npm install
npm install --prefix web
npm install --prefix functions
```

1. Copiar **`.env.v2.local`** (raíz) — no versionado. Plantilla: `.env.v2.example`
2. **`GOOGLE_APPLICATION_CREDENTIALS`** para smokes/scripts Admin
3. **Dev bandeja auditor:** `npm run dev:web` → `/portal/medico/solicitudes`
4. **Titular UAT habitual:** MOSTO · DNI `28914247` · `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

Índice continuidad general: [`HANDOFF_CONTINUIDAD_2026-04-25.md`](./HANDOFF_CONTINUIDAD_2026-04-25.md)  
Punto de continuación: [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)  
Matriz brechas (C1–C4 ✅): [`BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md`](./BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md)  
Changelog tags: [`CHANGELOG_1919.md`](./CHANGELOG_1919.md)

---

## 5. Backlog sugerido post-pausa (sin compromiso)

| Prioridad | Ítem | Nota |
|-----------|------|------|
| A | Deploy hosting batch UI bandeja C2–C4 | Cuando RRHH apruebe publicar paquete |
| B | Épica grilla / tope movimientos / B3–B5 | Ver `PENDIENTES_PROXIMA_SESION.md` § grilla |
| C | Bandeja junta médica | Mismas brechas históricas que auditor (fuera C1–C4) |

---

## 6. Árbol local al pausar

- **Commits:** todo en `master` · push realizado
- **Sin commitear:** `scripts/_tmp-*.mjs` (debug local — no subir)

---

## Changelog handoff

| Fecha | Cambio |
|-------|--------|
| 2026-07-06 | PAUSA post-cierre C4 — épica productividad bandeja cerrada |
