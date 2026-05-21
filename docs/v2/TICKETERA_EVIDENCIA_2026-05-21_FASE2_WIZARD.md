# Evidencia — Fase 2 ticketera dinámica (wizard Patrón B + grilla)

**Fecha:** 2026-05-21  
**Proyecto:** `portal-hospital-v2`  
**Rama:** `feature/ticketera-puente-campos-config`  
**Commit referencia:** `6f1fdbf` — `feat(ticketera): Fase 2 dinámica — P0 listado, wizard 3 pasos y docs`

**RFC:** [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md)

---

## 1. Alcance validado

| Oleada | Entregable | Evidencia esta sesión |
|--------|------------|------------------------|
| 2.1 | P0 `listarArticulosIngresoAgente` (MVP / catálogo) | Deploy Functions 21-may · tests `listarArticulosIngresoCore.test.js` |
| 2.2 | Wizard 3 pasos (`TicketeraPatronB` + `SolicitudPatronBForm`) | UI local/prod |
| 2.3 | `fecha_hasta` solo lectura + `dias_solicitados` desde listado | Paso 2 wizard |
| 2.4 | Preview explícito antes de envío | Paso 3 wizard |
| Integración | Visible en grilla MDC (Oleada C) | **`sol_01KS65K…` §2** |

---

## 2. Piloto E2E — `sol_01KS65KJW3Q163YEJ32GHDW12E`

| Verificación | Resultado |
|--------------|-----------|
| Alta vía ticketera Fase 2 (wizard → preview → envío) | ✅ (operador) |
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

## 4. Próximo (no bloquea este cierre)

| Ítem | Doc |
|------|-----|
| F3a LAO en shell ticketera (`fecha` desde hub) | [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) Fase 4 |
| F2.5 catálogo completo Patrón B | `TICKETERA_LISTAR_TODOS_PATRON_B=1` |
| Hosting deploy bundle wizard si prod aún muestra formulario plano | `npm run build:web` + `firebase deploy --only hosting` |

---

*Evidencia Fase 2 — operador confirma grilla OK con `sol_01KS65KJW3Q163YEJ32GHDW12E`.*
