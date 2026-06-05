# Release notes — Epic turnos compuestos F3 (V2)

**Fecha cierre núcleo F3:** 2026-06-02  
**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**RFC:** [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) · tag contrato `v2.0.0-rfc-turnos-compuestos`  
**Tag sugerido cierre F3:** `v2.3.0-f3-turnos-compuestos`

---

## Resumen

Motor de **capa teórica segmentada** (`segmentos[]` en `asi_*`), proyección operativa en `vis_*`, **fichadas esperadas** (T-08) y badge **F:n** en grilla (F-UX.2). Piloto validado en producción con régimen planificado Sala (`CFG_REG_HOR_1779788226715`) e ids compuestos con **`+`**.

---

## Entregables cerrados

| Ticket | Entregable | Validación |
|--------|------------|------------|
| T-02 | Zod + contrato segmentos | `npm run test:segmentos-contract` 6/6 |
| T-03 | Worker materialización día/mes | Smoke + rematerialización grupo |
| T-04 | Cobertura parcial + `materializarDiaAfectado` | Freeze `ASI-PER-001` |
| T-08 | `fichadas_esperadas` + extras | `npm run test:fichadas-esperadas` + smoke |
| F-UX.2 | Badge F:n en grilla/modal | Usuario RRHH **F:2** prod 2026-06-02 |

---

## Piloto grilla (validado usuario 2026-06-02)

| Control | Evidencia |
|---------|-----------|
| Régimen planificado | `CFG_REG_HOR_1779788226715` — paleta `M,T,N,M+T,T+N,N+M,M+T+N` |
| Grupo | Sala Internación 1 `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Plan jun-2026 | `plt_01KSXBAFCN14GSHXE7HMTZM3MK` — migrado `MT→M+T`, `NM→N+M` |
| Rematerialización | Script `migrar-regimen-planificado-compuesto-plus.mjs --apply` — 60 agentes jun, 0 fallos |
| Compuesto `M+T` | Horario 06–22, **F:2**, 2 segmentos (M 06–14, T 14–22) |
| Compuesto `NM` / `N+M` | Ej. LOKITO día 9: **22:00–14:00**, **F:2** |
| Regla ids **`+`** | Atomo `MT` = 1 segmento; `M+T` = descomposición + cobertura parcial por tramo |

---

## Operaciones / scripts

| Script | Uso |
|--------|-----|
| `npm run db:migrar-regimen-plus` | Migrar ids atómicos → `+` en planes + rematerializar HABILITADO |
| `npm run test:segmentos-contract` | Contrato segmentos |
| `npm run test:fichadas-esperadas` | Fórmula T-08 |
| `scripts/materializar-grupo-mes.mjs` | Rematerializar mes completo por `gdt` |

---

## UI

- Badge **F:n** en grilla equipo, titular, plan aprobado, modal día.
- Aviso **Turnos compuestos con «+»** en pantalla RRHH regímenes planificado (`RegimenTurnoCompuestoPlusTip.jsx`).

---

## Pendiente post-F3 (no bloquea tag núcleo)

| Ítem | Notas |
|------|--------|
| T-05/06/07/09 | Editor segmentos, help extendido, caché catálogo |
| UX-6 | Filtro API jefe sin `fichadas_reales` (capa 4 aún no existe) |
| Deploy hosting | Tip régimen `+` en prod |
| PR merge épica → `master` | Decisión RRHH |

---

## Tag

```bash
git tag -a v2.3.0-f3-turnos-compuestos -m "F3 turnos compuestos: segmentos, fichadas esperadas, piloto Sala validado"
```
