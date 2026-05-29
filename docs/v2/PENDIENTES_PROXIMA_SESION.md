# Punto de Continuación — Próxima Sesión

**Última actualización:** Viernes 29 de mayo de 2026 (cierre sesión Multi-HLG)  
**RETOMAR AQUÍ:** [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md)

| Campo | Valor |
|-------|--------|
| **Branch** | `feat/epic-multi-hlg-fase1-execution` (pusheada a `origin`) |
| **Biblia** | [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) |
| **Handoff incidente Z** | [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) |
| **Producción** | https://portal-hospital-v2.web.app |
| **Plan piloto** | `plt_01KSSPY2H5EZA925FQP4S1G2XW` · Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| **Tag salvavidas** | `v2.2.0-pre-multi-hlg` |

---

## Estado al cerrar sesión 29/05

| Hito | Estado |
|------|--------|
| Opción A scoped (`vis_*` + `capa_teorica_por_grupo`) | ✅ Código + BD |
| Purga `vis_*` legacy | ✅ 8 docs (sesión previa) |
| Paso 2 — Gates + overrides E2 | ✅ Deploy `fc54e8b` |
| Paso 3 — Materialización mayo Sala | ✅ 93 agentes |
| Paso C — Strip `capa_teorica` raíz | ✅ 244 docs → **0** legacy |
| Documentación biblia/handoff | ✅ `c07cea3` |
| **PR → `master`** | ⏳ **Pendiente (Jorge)** |
| **Merge + Paso 4 QA** | ⏳ Tras sign-off PR |

---

## Objetivo principal — próxima sesión

1. **Abrir Pull Request** `master` ← `feat/epic-multi-hlg-fase1-execution` (equipo valida biblia vs código).
2. Tras review: **merge a `master`**.
3. **Paso 4** — completar matriz QA §4.2 en [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) (ítems 2–3, 6, 8–9).
4. Validación visual UI: MOSTO/CHAPARRO — mayo y junio (Sala completo; Oficina vacío si multicargo).

### Abrir PR (recordatorio)

- **Web:** https://github.com/jorgemosto1981/portal-hospital-v2/compare/master...feat/epic-multi-hlg-fase1-execution?expand=1
- **CLI:** `gh auth login` → `gh pr create --base master --head feat/epic-multi-hlg-fase1-execution`

**Título sugerido:** `feat(asistencia): épica Multi-HLG Opción A + limpieza quirúrgica asi_*`

**No re-ejecutar** `strip-capa-teorica-legacy.mjs --apply` (ya aplicado en pre-prod).

---

## Hecho en sesión 29/05 (resumen)

1. Dry-run strip: 244 candidatos → validación orden A→B→C.
2. Deploy functions con gates E11 estrictos y overrides por `gdt`.
3. Materialización mayo 2026 grupo Sala (93 personas).
4. Strip apply: 0 documentos con `capa_teorica` raíz post-verificación.
5. Tests gate: `node --test functions/test/validarEntornoOperativo.test.js` (10/10).
6. Push remoto + docs biblia/handoff/cierre sesión.

---

## Pendientes priorizados

### Alta (próxima sesión)

1. Crear y compartir **PR** con el equipo.
2. QA visual mayo/junio en app (piloto MOSTO/CHAPARRO).
3. `audit-vis-junio-2026.mjs` — confirmación formal plan vs `vis_*` vs `asi_*`.

### Media

4. Materializar otros `gdt` con plan HABILITADO (fuera piloto Sala) cuando RRHH lo requiera.
5. Actualizar scripts `audit-fase4-6`, `rematerializar-vis-turno-teorico` a `buildVisDocumentId` 3 args.
6. Hook KI-1 `proyectarAportesNormativosVisGrupo` (épica futura).

### Baja

7. Fichadas reales (reloj).
8. Code splitting bundle > 500KB.

---

## Archivos clave

| Área | Archivo |
|------|---------|
| Biblia | `docs/v2/PLAN_GRILLA_MULTI_HLG_V2.md` |
| Worker | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Gate E11 | `functions/modules/ticketera/grillaTurnoEntornoGate.js` |
| Lectura capa | `functions/modules/shared/capaTeoricaPorGrupoCore.js` |
| Strip (ops) | `scripts/strip-capa-teorica-legacy.mjs` |
| Materializar mes | `scripts/materializar-grupo-mes.mjs` |

---

## Historial sesiones recientes (turnos / grilla)

| Fecha | Documento |
|-------|-----------|
| 29/05 | [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md) — **cierre hito** |
| 29/05 | [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) — incidente Z |
| 28/05 | [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) |
