# Handoff — 2026-07-15 → cierre 2026-07-17 (modo jefe + Art. 77-0)

**Estado:** **CIERRE de átomo** · smoke E2E −dev OK · commit `d32d471`  
**Guía viva:** [`GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md`](./GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md)  
**Cheat sheet entornos:** [`CHEATSHEET_PROD_VS_DEV_V2.md`](./CHEATSHEET_PROD_VS_DEV_V2.md)  
**Contrato entorno:** [`ETAPA1_GIT_Y_ENTORNOS_V2.md`](./ETAPA1_GIT_Y_ENTORNOS_V2.md) · [`ETAPA1_POLITICA_DEPLOY_V2.md`](./ETAPA1_POLITICA_DEPLOY_V2.md)

Relacionados:  
[`RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md`](./RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md) ·  
[`RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md`](./RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md) ·  
[`HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md`](./HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md)

---

## 1. Resumen ejecutivo

| Tema | Estado al cerrar (2026-07-17) |
|------|-------------------------------|
| **Modo resolución jefe** | ✅ Código + smoke |
| **Art. 77-0** (rechazo autorización → hija injustificada) | ✅ E2E −dev + acuse rechazo |
| **Art. 64 unificado** (chip, bolsas A/B, cruce al aprobar sin goce) | ✅ E2E −dev |
| **Acuse autorización sin goce (64-B)** | ✅ mismo gate que rechazo; copy distinto |
| **64-A sin retroactividad** | ✅ `permite_retroactividad: false` en versión publicada −dev |
| **Vite / Firebase** | Trabajar en **`:5174`** con `npm run dev:web:dev` |
| **Soft Launch prod (Vía A)** | Sin promoción en este átomo |

---

## 2. Git (foto al cierre)

| Recurso | Valor |
|---------|--------|
| Rama | `feature/modo-resolucion-jefe-v2` |
| HEAD | `d32d471` — `feat(77-0): implementar inasistencia injustificada automatizada desde rechazo y fixes de acuses 64` |
| Commits previos feature | `d851b5c` modo resolución jefe · `8f409a1` script patch modo jefe |
| Working tree | **limpio** al cierre del átomo |
| Push a `origin` | ⚠ pendiente (no se hizo push en esta sesión) |

---

## 3. Firebase −dev (piloto)

Proyecto: **`portal-hospital-v2-dev`**  
SA: `C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json`

| Qué | ID / nota |
|-----|-----------|
| Art. 77-0 | `art_01KXK3HN7Z52Q0TKPM5EE6Y0M7` / `ver_01KXK3HN80GFD52WM4WWGGY1C5` |
| 64-A | `art_01KRNK10V10CH7W5M2W6V558GS` / `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` · **sin retro** |
| 64-B | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` |
| Allowlist Etapa 1 | 64-A/B + 63s (+ CAMBIO-DIA si aplica); **77-0 no** en wizard agente |
| Lokito | `per_01KXK214PYGN9W38CZR4SMV3XW` · DNI `1234567` / PIN `123456` |
| Mosto (jefe) | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` · DNI `28914247` / PIN `123456` |
| GDT piloto | `gdt_01KXGK9GXHHVE0FCKPJRPDDHXA` |

### Scripts de parche (−dev)

- `scripts/seed-v2/patch-modo-resolucion-jefe-dev.mjs`
- `scripts/seed-v2/patch-64a-retroactividad-dev.mjs` (`--dry-run` / `--apply`)

### Functions desplegadas en −dev (oleada cierre)

- `resolverDecisionJefeSolicitud`, `listarArticulosIngresoAgente`, `previsualizarSolicitudPatronB`, `obtenerResumenSaldoFamilia64Agente`
- `obtenerContextoAcuseSinGoceAgente`, `registrarAcuseSinGoceAgente`
- (previas) acuse rechazo + bandeja jefe según oleadas anteriores

### Evidencia smoke (muestra)

| Flujo | Evidencia |
|-------|-----------|
| 64 rechazo → 77-0 | padre `sol_01KXR5KC1K0N6AZ1T8FPDH61TA` → hija `sol_01KXR5PPM3HP4KT4RCBKZPN2Y0` |
| 64-B sin goce + acuse | `sol_01KXR59XG4425V901DD7E8EQDP` · modal ámbar “autorizada sin goce” |

---

## 4. Decisiones de producto vigentes

| # | Decisión |
|---|----------|
| 1 | 63 → jefe **toma de conocimiento** (Conforme / Observado). |
| 2 | 64 → entrada unificada; jefe elige **con/sin goce** (default con goce). |
| 3 | **77-0 solo al Rechazar** autorización (no al Observado de 63). |
| 4 | Rechazo 64 exige checkbox / `confirma_injustificada`. |
| 5 | Autorización **sin goce** exige justificativo + doble confirmación + **acuse agente** (no es rechazo). |
| 6 | Umbral EGAP → evento `ALERTA_77_0_UMBRAL_EXCEDIDO` (aviso RRHH; portal no inicia cesantía). |
| 7 | 64-A **sin carga retroactiva** (`permite_retroactividad: false`). |
| 8 | Alta directa RRHH de 77-0: **diferido**. |

---

## 5. Checklist (estado)

### A — Smoke −dev

- [x] `npm run dev:web:dev` → **http://localhost:5174/**
- [x] Lokito ve 64 (+ 63)
- [x] Alta 64 → bandeja Mosto → Aprobar / Rechazar
- [x] Rechazar → 77-0 hija + acuse rechazo
- [x] 63 Observado **sin** 77-0
- [x] Autorizar sin goce → acuse agente (copy autorización)
- [x] Commit `d32d471`

### B — Mapa prod vs −dev

- [x] Cheat sheet: [`CHEATSHEET_PROD_VS_DEV_V2.md`](./CHEATSHEET_PROD_VS_DEV_V2.md)

### C — Siguiente (no hoy)

- [ ] Push rama / PR → `develop`
- [ ] Promoción a prod solo con flags / allowlist + UAT
- [ ] Alta directa RRHH 77-0 (átomo futuro)

---

## 6. Cuentas demo (−dev)

| Rol | DNI | PIN | persona_id |
|-----|-----|-----|------------|
| Agente Lokito | `1234567` | `123456` | `per_01KXK214PYGN9W38CZR4SMV3XW` |
| Jefe Mosto | `28914247` | `123456` | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` |

---

## 7. Frase de continuación (próximo arranque)

> Retomar desde `docs/v2/CHEATSHEET_PROD_VS_DEV_V2.md` + este handoff: átomo 77-0/64 cerrado en `d32d471` (`feature/modo-resolucion-jefe-v2`). Próximo: push/PR a `develop`, o átomo alta RRHH 77-0. UI smoke siempre en `:5174` (−dev).
