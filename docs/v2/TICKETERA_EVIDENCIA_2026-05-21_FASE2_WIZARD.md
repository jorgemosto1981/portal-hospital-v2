# Evidencia — Fase 2 ticketera dinámica (wizard Patrón B + grilla)

**Fecha:** 2026-05-21  
**Proyecto:** `portal-hospital-v2`  
**Rama:** `feature/ticketera-puente-campos-config`  
**Commits referencia:** `6f1fdbf` (wizard inicial) · `469d7d9` (paso 2 UI + callable) · `72c8ae6` (fix RRHH persona_id) · **HEAD:** `72c8ae6`

**RFC:** [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md)

---

## 1. Alcance validado

| Oleada | Entregable | Evidencia esta sesión |
|--------|------------|------------------------|
| 2.1 | P0 `listarArticulosIngresoAgente` (MVP / catálogo) | Deploy Functions 21-may · tests `listarArticulosIngresoCore.test.js` |
| 2.2 | Wizard 3 pasos (`TicketeraPatronB` + `SolicitudPatronBForm`) | UI local/prod |
| 2.3 | `fecha_hasta` solo lectura + `dias_solicitados` desde listado | Paso 2 wizard |
| 2.4 | Preview explícito antes de envío | Paso 3 wizard |
| 2c | Paso 2 `validarEntornoOperativoSolicitud` bloquea 2→3 | `469d7d9` + deploy Functions/Hosting 21-may |
| Integración | Visible en grilla MDC (Oleada C) | **`sol_01KS65K…` §2** |

---

## 2. Piloto E2E — `sol_01KS65KJW3Q163YEJ32GHDW12E`

| Verificación | Resultado |
|--------------|-----------|
| Alta vía ticketera Fase 2 (wizard → preview → envío) | ✅ (operador) |
| Alta post-rediseño UX (confirmación huérfana/jefatura) | ✅ `sol_01KS7N68PW8T3BXAH1GN8SVN54` (22-may) |
| Documento `sol_*` persistido | ✅ `sol_01KS65KJW3Q163YEJ32GHDW12E` |
| Proyección MDC `vis_*` / calendario licencias | ✅ **visible en grilla** (`/portal/grilla` → pestaña Calendario licencias MDC) |
| Enlace detalle día / bandeja (C3) | Pendiente anotar si se probó clic en celda |

**Notas operador:** solicitud creada tras cierre Fase 2; confirma cadena **ticketera → trigger Patrón B → MDC → GSO** sin regresión respecto a pilotos `sol_01KS57Y…` / `sol_01KS50G2…`.

### Campos a contrastar en consola (checklist auditoría)

- [ ] `version_id_aplicada`, `grupo_trabajo_id_ancla` en raíz `sol_*`
- [ ] `estado_solicitud_id` coherente con flujo Oleada A (p. ej. `cfg_esa_en_revision_jefe` post-alta)
- [ ] `mdc_ultimo_comando` = `PROYECTAR_PENDIENTE` (o siguiente si ya hubo jefe)
- [ ] Doc `vis_YYYY_MM_per_*` con día del permiso coloreado según MDC

---

## 3. Entorno

| Capa | Valor |
|------|--------|
| Hosting | https://portal-hospital-v2.web.app (wizard: verificar bundle post-`6f1fdbf`) |
| Functions | `southamerica-east1` · deploy 21-may (`listarArticulosIngresoAgente`, `previsualizarSolicitudPatronB`) |
| Grilla | Oleada C cerrada · [`HANDOFF_SESION_2026-05-21_GRILLA_OLEADA_C_CIERRE.md`](./HANDOFF_SESION_2026-05-21_GRILLA_OLEADA_C_CIERRE.md) |

---

## 4. Paso 2 entorno (tarde 21-may)

| Verificación | Resultado |
|--------------|-----------|
| Callable `validarEntornoOperativoSolicitud` en prod | ✅ deploy `9319bf7` |
| Wizard «Continuar» llama callable | ✅ `469d7d9` + hosting |
| Tests unitarios T2-ent-01…05 | ✅ |
| Smoke E2E operador post-fix RRHH (`72c8ae6`) | ⏳ **mañana** — ver handoff §6 |
| Caso bloqueo turno/grilla en UI (mensajes rojos) | ⏳ anotar captura + `codigos[]` |

**Handoff:** [`HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md`](./HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md)

---

## 5. Próximo (sesión siguiente)

| Ítem | Doc |
|------|-----|
| Smoke paso 2 → 3 → envío → grilla | Handoff §6 P0 |
| F3a LAO en shell ticketera (`fecha` desde hub) | [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) F3a |
| F2.5 catálogo completo Patrón B | `TICKETERA_LISTAR_TODOS_PATRON_B=1` |
| Oleada A autorización + TC | [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md) |

---

*Evidencia Fase 2 — `sol_01KS65K…` en grilla OK; paso 2 callable cableado 21-may tarde.*
