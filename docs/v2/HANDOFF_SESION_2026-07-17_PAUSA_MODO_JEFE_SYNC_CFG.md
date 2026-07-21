# Handoff — PAUSA 2026-07-17 (modo jefe + 77-0 + sync cfg)

**Estado:** **PAUSA formal** · no seguir código hasta retoma  
**Fecha:** 2026-07-17 (~11:30 ART)  
**Guía viva:** [`GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md`](./GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md)  
**Cheat sheet entornos:** [`CHEATSHEET_PROD_VS_DEV_V2.md`](./CHEATSHEET_PROD_VS_DEV_V2.md)  
**Contrato entorno:** [`ETAPA1_GIT_Y_ENTORNOS_V2.md`](./ETAPA1_GIT_Y_ENTORNOS_V2.md) · [`ETAPA1_POLITICA_DEPLOY_V2.md`](./ETAPA1_POLITICA_DEPLOY_V2.md)

Relacionados:  
[`RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md`](./RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md) ·  
[`RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md`](./RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md) ·  
[`HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md`](./HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md)

---

## 1. Resumen ejecutivo

| Tema | Estado al pausar |
|------|------------------|
| **Modo resolución jefe** (63 TC / 64 autorización) | ✅ Código + smoke E2E −dev |
| **Art. 77-0** (rechazo autorización → hija injustificada + acuse) | ✅ E2E −dev |
| **Art. 64 unificado** (chip, bolsas A/B, cruce sin goce, saldo UI) | ✅ E2E −dev |
| **Acuse autorización sin goce (64-B)** | ✅ mismo gate que rechazo; copy “autorizada sin goce” |
| **64-A sin retroactividad (−dev)** | ✅ `permite_retroactividad: false` (parche post-sync) |
| **Sync selectivo cfg prod → −dev** | ✅ script `a7ce943` + apply 212 docs |
| **Vite / Firebase** | Siempre **`:5174`** + `npm run dev:web:dev` |
| **Soft Launch prod** | Sin promoción en este ciclo |

### Por qué pausamos aquí

Átomo de producto (77-0 / 64 / acuses) cerrado y arenero −dev alineado al “Libro de Recetas” de prod (cfg), con sabores locales re-aplicados. Siguiente ciclo: push/PR o átomo nuevo (alta RRHH 77-0).

---

## 2. Git (foto al pausar)

| Recurso | Valor |
|---------|--------|
| Rama | `feature/modo-resolucion-jefe-v2` |
| HEAD | `a7ce943` — `chore(db): implementar script seguro de sync selectivo de config prod a -dev` |
| Commits clave sesión | `d32d471` feat(77-0) · `51305bc` docs cheat sheet · `a7ce943` sync cfg |
| Working tree | **limpio** |
| Push a `origin` | ⚠ **pendiente** (no se hizo push) |

### Commits a conservar (orden)

1. `d851b5c` — modo resolución jefe  
2. `8f409a1` — script patch modo jefe  
3. `d32d471` — 77-0 + fixes 64/acuses  
4. `51305bc` — cheat sheet + cierre handoff  
5. `a7ce943` — sync cfg prod → −dev  

---

## 3. Firebase −dev (laboratorio sellado)

Proyecto: **`portal-hospital-v2-dev`**  
SA: `C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json`  
Prod SA (solo lectura/sync): `C:\DATOS\portal-hospital-v2-4885ffb02c61.json`

| Qué | ID / nota |
|-----|-----------|
| Art. 77-0 | `art_01KXK3HN7Z52Q0TKPM5EE6Y0M7` / `ver_01KXK3HN80GFD52WM4WWGGY1C5` · **sigue vivo** (solo −dev) |
| 64-A **piloto** | `art_01KRNK10V10CH7W5M2W6V558GS` / `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` · sin retro · `autorizacion` |
| 64-A **legacy** | `art_01KRDTBZRDSK7K9JAPXCYWYFRC` · archivado 2026-07-21 (`64-A-LEGACY-ARCHIVED`, `activo=false`) |
| 64-B | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` · `autorizacion` |
| Allowlist | `cfg_etapa1/runtime` **no tocado** por el sync |
| Lokito | `per_01KXK214PYGN9W38CZR4SMV3XW` · DNI `1234567` / PIN `123456` |
| Mosto | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` · DNI `28914247` / PIN `123456` |
| GDT | `gdt_01KXGK9GXHHVE0FCKPJRPDDHXA` |

### Sync cfg (2026-07-17)

- Script: `scripts/seed-v2/sync-cfg-prod-to-dev.mjs`  
- Creds: `GOOGLE_APPLICATION_CREDENTIALS_PROD` + `_DEV`  
- Apply: **212 writes** (48 catálogos + 19 arts + 23 versiones)  
- Excluidos: `cfg_etapa1`, `cfg_cie10`  
- npm: `sync:cfg-prod-to-dev` / `sync:cfg-prod-to-dev:apply`

### Sabores locales re-aplicados post-sync

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-….json"
$env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
$env:ALLOW_FIRESTORE_SEED_V2="true"
node scripts/seed-v2/patch-64a-retroactividad-dev.mjs --apply
node scripts/seed-v2/patch-modo-resolucion-jefe-dev.mjs --apply
# + refuerzo piloto 64-A → autorizacion (query por codigo tomó el duplicado)
```

**Aviso ops:** tras cada sync, re-correr parches −dev. El patch modo jefe por `codigo==64-A` puede elegir el doc legacy; el piloto Etapa 1 es `art_01KRNK10…`.

### Functions −dev (oleada)

- `resolverDecisionJefeSolicitud`, `listarArticulosIngresoAgente`, `previsualizarSolicitudPatronB`, `obtenerResumenSaldoFamilia64Agente`
- `obtenerContextoAcuseSinGoceAgente`, `registrarAcuseSinGoceAgente`
- (+ acuse rechazo / bandeja jefe previas)

### Evidencia smoke

| Flujo | Evidencia |
|-------|-----------|
| 64 rechazo → 77-0 | `sol_01KXR5KC1K0N6AZ1T8FPDH61TA` → hija `sol_01KXR5PPM3HP4KT4RCBKZPN2Y0` |
| 64-B sin goce + acuse | `sol_01KXR59XG4425V901DD7E8EQDP` |

---

## 4. Decisiones de producto vigentes

| # | Decisión |
|---|----------|
| 1 | 63 → jefe **toma de conocimiento** (Conforme / Observado). |
| 2 | 64 → entrada unificada; jefe elige **con/sin goce** (default con goce). |
| 3 | **77-0 solo al Rechazar** autorización (no al Observado de 63). |
| 4 | Rechazo 64 exige checkbox / `confirma_injustificada`. |
| 5 | Autorización **sin goce** → justificativo + doble confirmación + **acuse agente**. |
| 6 | Umbral EGAP → `ALERTA_77_0_UMBRAL_EXCEDIDO` (aviso RRHH; sin cesantía en portal). |
| 7 | 64-A −dev **sin** carga retroactiva (`permite_retroactividad: false`). |
| 8 | Alta directa RRHH de 77-0: **diferido**. |
| 9 | −dev **no** es mirror total de prod; sync **solo cfg** del configurador. |

---

## 5. Checklist

### Hecho

- [x] Smoke E2E 63 / 64 / 77-0 / acuses en `:5174`
- [x] Commits `d32d471` + docs + `a7ce943`
- [x] Cheat sheet prod vs −dev
- [x] Sync cfg apply + parches locales
- [x] PAUSA documentada

### Próxima sesión

- [x] Push rama / merge → `develop` (`9570464`)
- [x] Archivar 64-A legacy `art_01KRDTBZ…` en −dev (`codigo=64-A-LEGACY-ARCHIVED`, `activo=false`)
- [ ] Promoción a prod solo con flags / allowlist + UAT
- [ ] Átomo: alta directa RRHH 77-0

---

## 6. Cuentas demo (−dev)

| Rol | DNI | PIN | persona_id |
|-----|-----|-----|------------|
| Agente Lokito | `1234567` | `123456` | `per_01KXK214PYGN9W38CZR4SMV3XW` |
| Jefe Mosto | `28914247` | `123456` | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` |

---

## 7. Frase de continuación (copiar al reabrir chat)

> Retomar desde `docs/v2/HANDOFF_SESION_2026-07-17_PAUSA_MODO_JEFE_SYNC_CFG.md`: feature mergeada en `develop` (`9570464`). Push OK. 64-A legacy archivado en −dev. UI `:5174` o `:5173` con `npm run dev:web:dev`. **Próximo átomo:** alta directa RRHH 77-0.
