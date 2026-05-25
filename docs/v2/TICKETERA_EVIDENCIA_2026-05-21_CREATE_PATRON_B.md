# Evidencia — Alta Patrón B y contrato create (Bloque A)

**Fecha:** 2026-05-21  
**Proyecto:** `portal-hospital-v2`  
**Rama:** `feature/ticketera-puente-campos-config`

---

## 1. Incidente rules / fuga de contrato (diagnóstico confirmado)

| Síntoma | Causa |
|---------|--------|
| Preview OK, envío `Missing or insufficient permissions` | Cliente enviaba `grupo_trabajo_id_ancla` pero `hasOnly` en Rules **no** lo incluía |
| Nomenclatura mixta | Doc/MDC usan `version_id_aplicada`; create cliente usaba `version_aplicada` |

**Mitigación interina (21-may):** Rules con shape dual (con/sin `grupo_trabajo_id_ancla`).  
**Cierre Bloque A:** contrato unificado — `version_id_aplicada` + `grupo_trabajo_id_ancla` obligatorio en create Patrón B (Zod + Rules + payload).

---

## 2. Piloto integrado — DNI 27667499 · `sol_01KS4ZG2E8FCCAJP72WNN9R8X0`

| Dato | Valor |
|------|--------|
| Titular | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` |
| Grupo ancla | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` (Oficina PERSONAL) |
| Artículo | 64-A · `art_01KRNK10V10CH7W5M2W6V558GS` |
| Fecha permiso | `2026-06-21` |
| Versión | `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` |

### Cadena MVP (AS-IS desplegado)

| Paso | `estado_solicitud_id` | MDC | `asi_*` día 21 |
|------|------------------------|-----|----------------|
| Alta | `cfg_esa_en_revision_jefe` | `PROYECTAR_PENDIENTE` | `PENDIENTE` / naranja |
| Jefe (28914247) | `cfg_esa_en_revision_rrhh` | `AUTORIZAR_JEFE` | `AUTORIZADO_JEFE` |
| RRHH (28914247) | `cfg_esa_aprobada` | `CONSOLIDAR_APROBADO` | `APROBADO` / azul |

**Nota producto:** bandeja RRHH sigue siendo “Aprobar definitivo” (MVP); TO-BE = toma de conocimiento tras cierre jefe — [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md).

### Campos relevantes (piloto jun-21 — pre–Bloque A en raíz `sol_*`)

- `grupo_trabajo_id_ancla`, `hlc_id_elegibilidad`; en raíz pudo quedar `version_aplicada` (legado). Aportes MDC ya usaban `version_id_aplicada`.
- `mdc_ultimo_comando`, `mdc_ultimo_resultado_ok`, `_debito_origen`
- Aporte `asi_*`: `version_id_aplicada`, `grupo_trabajo_id_ancla`, `estado_instancia`

---

## 2b. Regresión post–Bloque A · `sol_01KS50G2FHQJ6HXZ73JTABMM27`

**Fecha prueba:** 2026-05-21 ~07:14 ART · **Titular:** `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` · **Fecha permiso:** `2026-07-21`

| Verificación | Resultado |
|--------------|-----------|
| Alta UI (toast) | «Solicitud aceptada … en revisión por jefe» |
| Create sin `permission-denied` | OK (Rules + Zod Bloque A) |
| `sol_*` con `version_id_aplicada` | Esperado en documento nuevo (no `version_aplicada` solo) |
| `grupo_trabajo_id_ancla` | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` |
| MDC post-alta | `PROYECTAR_PENDIENTE` → aporte `PENDIENTE` |
| Alta + trigger | `cfg_esa_en_revision_jefe` → `PROYECTAR_PENDIENTE` |
| Jefe | `cfg_esa_en_revision_rrhh` · `AUTORIZAR_JEFE` · `asi` `AUTORIZADO_JEFE` |
| RRHH (MVP aprobar) | `cfg_esa_aprobada` · `CONSOLIDAR_APROBADO` · cierre completo |

### `asi_per_01KR3HD24AMJ6YX3N7B3GPAZJ4_20260721` — estado final

| Campo | Valor |
|-------|--------|
| `sol_id` | `sol_01KS50G2FHQJ6HXZ73JTABMM27` |
| `version_id_aplicada` | `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` |
| `grupo_trabajo_id_ancla` | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` |
| `estado_instancia` (aporte) | `APROBADO` |
| `estado_consolidado` | `64-A` (código grilla) |
| `estado_solicitud_id` | `cfg_esa_aprobada` |
| `tiene_tramite_pendiente` | `false` |

### `vis_2026_07_per_01KR3HD24…` — día `21` (final)

| Campo | Valor |
|-------|--------|
| `color_ui` | `#3B82F6` (consolidado) |
| `estado_solicitud_id` | `cfg_esa_aprobada` |
| `tiene_conflicto` | `false` |
| `ultima_sync_mdc` | ~07:17 ART (post-RRHH) |

**Conclusión:** cadena **alta → jefe → RRHH** + MDC **OK** en `2026-07-21` con contrato Bloque A. Misma semántica MVP que `sol_01KS4ZG2…` (doble etapa aprobar); producto TO-BE sigue en RFC autorización.

---

## 3. Checklist Bloque A (implementación)

- [x] Zod `solicitudArticuloCreateShapePatronB` en `web/src/schemas/solicitudArticuloCreate.schema.js`
- [x] Firestore Rules `hasOnly` alineado
- [x] UI multi-grupo + autoselección un grupo
- [x] Payload `version_id_aplicada` + `grupo_trabajo_id_ancla`
- [x] Deploy `firestore:rules` (2026-05-21)
- [x] Deploy `hosting` + `onSolicitudArticuloPatronBOnCreate` (2026-05-21)
- [x] Código Zod + servicio + Rules en repo
- [x] Alta de regresión en prod — `sol_01KS50G2FHQJ6HXZ73JTABMM27` (2026-07-21, cadena completa MVP + Bloque A)

---

## 4. Código (referencia repo)

| Pieza | Ruta |
|-------|------|
| Zod + builder | `web/src/schemas/solicitudArticuloCreate.schema.js` |
| setDoc | `web/src/services/solicitudesArticuloV2Service.js` |
| UI grupo | `web/src/features/solicitudes/useSolicitud64AAlta.js`, `SolicitudPatronBForm.jsx` |
| Rules | `firebase-v2/firestore.rules` — `solicitudArticuloCreateShapePatronB` |

---

## 5. Referencias

- [`HANDOFF_SESION_2026-05-21_BLOQUE_A_Y_CONTINUIDAD.md`](./HANDOFF_SESION_2026-05-21_BLOQUE_A_Y_CONTINUIDAD.md) — **continuidad y prioridades**
- [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §7.1
- [`HANDOFF_SESION_2026-05-20_MDC_OLEADA_B_PAUSA.md`](./HANDOFF_SESION_2026-05-20_MDC_OLEADA_B_PAUSA.md)
