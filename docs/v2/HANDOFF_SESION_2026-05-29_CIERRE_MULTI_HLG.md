# Handoff — Cierre sesión 29/05/2026 · Épica Multi-HLG

**Estado:** Hito **Limpieza quirúrgica** cerrado en pre-prod. Código en `origin`. **PR pendiente** de apertura/merge.  
**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**Plan maestro:** [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md)  
**Incidente origen:** [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md)  
**Continuidad:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)

---

## Resumen de la sesión (qué se hizo hoy)

| Fase | Acción | Resultado |
|------|--------|-----------|
| **Paso A** | Commit `fc54e8b` + `firebase deploy --only functions` | Gates E11, overrides E2, sin fallback `capa_teorica` |
| **Paso B** | `materializar-grupo-mes.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-05` | **93** personas; 0 fallos |
| **Paso C** | `strip-capa-teorica-legacy.mjs --apply` | **244** `asi_*` sin campo raíz; dry-run post = **0** legacy |
| **Docs** | Commit `c07cea3` — biblia + handoff materialización | DoD §4.1 actualizado |
| **Git remoto** | `git push origin feat/epic-multi-hlg-fase1-execution` | `ba308ba`…`c07cea3` en GitHub |

### Verificación piloto (post-strip)

| Agente | `persona_id` | Mayo | Junio |
|--------|--------------|------|-------|
| MOSTO | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` | 31/31 `asi_dias_capa_grupo` | 30/30 turnos + capa |
| CHAPARRO | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` | 31/31 capa scoped | junio OK (sesión previa) |

---

## Modelo final vigente (para el equipo)

- **`vis_*`:** solo `vis_{YYYY}_{MM}_per_{ULID}_gdt_{ULID}` — sin IDs legacy.
- **`asi_*`:** capa teórica **solo** en `capa_teorica_por_grupo[gdt]` — **sin** `capa_teorica` raíz en BD.
- **Gates:** `depende_rda` exige `grupo_trabajo_id` + lectura scoped (E11).
- **Overrides:** `grupo_de_trabajo_id` obligatorio en escritura; filtro en worker (E2).
- **Transparencia:** si un `gdt` no fue materializado, no hay capa inventada ni mezcla cross-grupo.

---

## Commits de cierre (últimos en rama)

| Hash | Mensaje |
|------|---------|
| `fc54e8b` | feat(asistencia): Paso 2 gates scoped por gdt y overrides E2 |
| `c07cea3` | docs: finalize architecture bible and report strip legacy |

*(Épica completa incluye commits previos: `c26e393`…`ba308ba` — ver `git log origin/master..HEAD`.)*

---

## Pendiente explícito (próxima sesión — Jorge)

1. **Abrir PR** → `master` ← `feat/epic-multi-hlg-fase1-execution`  
   - Enlace: https://github.com/jorgemosto1981/portal-hospital-v2/compare/master...feat/epic-multi-hlg-fase1-execution  
   - `gh` no autenticado en PC de sesión — usar UI GitHub o `gh auth login` + `gh pr create`  
   - Cuerpo PR: ver borrador en conversación / [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)

2. **Sign-off equipo** — revisar biblia vs código en el PR.

3. **Paso 4 QA** — matriz §4.2 plan maestro (ítems 2–3, 6, 8–9); validación visual mayo en UI.

4. **Merge a `master`** tras aprobación del PR.

5. **Opcional:** `node scripts/audit-vis-junio-2026.mjs` — cierre formal plan = `vis_*` = `asi_*`.

---

## Scripts operativos (referencia)

```bash
node scripts/materializar-grupo-mes.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=YYYY-MM
node scripts/verificar-vis-mes-agente.mjs --persona=per_* --gdt=gdt_* --periodo=YYYY-MM
node scripts/strip-capa-teorica-legacy.mjs --dry-run   # ya aplicado; solo auditoría
node scripts/purge-vis-legacy.mjs --dry-run
```

**No re-ejecutar** `strip --apply` sin dry-run (ya aplicado 29/05).

---

## Piloto de referencia

| Campo | Valor |
|-------|--------|
| Plan | `plt_01KSSPY2H5EZA925FQP4S1G2XW` |
| Grupo | Sala Internación 1 — `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Períodos materializados scoped | `2026-05`, `2026-06` |
| Tag salvavidas | `v2.2.0-pre-multi-hlg` |
| Producción | https://portal-hospital-v2.web.app |

---

*Sesión cerrada 29/05/2026. Sin cambios de código pendientes en working tree.*
