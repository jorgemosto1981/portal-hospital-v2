# Datos Laborales — auditoría, acuerdos e implementación

**Tag de referencia (pre-implementación en commit):** `audit/datos-laborales-pre-impl-2026-05-19`  
**Pantalla:** `/portal/laboral` · [`web/src/pages/DatosLaborales.jsx`](../../web/src/pages/DatosLaborales.jsx)  
**Matriz de errores:** [`MATRIZ_WARN_ERROR_LABORAL_V2.md`](./MATRIZ_WARN_ERROR_LABORAL_V2.md)  
**Módulo normativo:** [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md)

---

## 1. Resumen ejecutivo

Auditoría del flujo HLc → HLd → HLg (cargos, detalle, asignación a grupo). Se corrigió el desfase de fechas (+1 día) por uso de UTC vs día civil en Argentina, se unificó vigencia **inclusiva** `[desde, hasta]`, y se acordaron mejoras de UX (planilla 7 días, deshabilitar HLg, formato `DD/MM/AAAA`, autorización BOLA en backend).

---

## 2. Modelo de fechas

| Nivel | Campos canónicos | Persistencia |
|-------|------------------|--------------|
| HLc | `fecha_desde` / `fecha_hasta` | string `YYYY-MM-DD` |
| HLd / HLg | `fecha_inicio` / `fecha_fin` | string `YYYY-MM-DD` |

- **Zona:** `America/Argentina/Buenos_Aires` ([`shared/utils/fechaInstitucionalBa.js`](../../shared/utils/fechaInstitucionalBa.js)).
- **Helpers compartidos:** [`shared/utils/fechaLaboralYmd.js`](../../shared/utils/fechaLaboralYmd.js) (sync a `functions/modules/shared/fechaLaboralYmd.js`).
- **Visualización RRHH:** siempre **`DD/MM/AAAA`** (no `dd mm yyyy` sin barras).
- **Edición:** fechas HLc/HLg **editables**; cada guardado valida rango y contención.

### Contención HLg ⊆ HLc (inclusivo)

Ejemplo: HLc `01/01/2026`–`01/02/2026` → HLg debe cumplir `hlg_inicio >= hlc_desde` y `hlg_fin <= hlc_hasta` (fin vacío solo si HLc abierto). Errores: `VAL-HLG-003`, `VAL-HLG-004`.

---

## 3. HLg — planilla de carga (7 días)

- UI: **7 filas fijas** (catálogo `cfg_dia_semana`), sin “Agregar día” / “Quitar”.
- Persistencia: **siempre 7 entradas** en `carga_por_dia_semana`; días sin carga con `horas: 0`.
- Validación: **al menos un día con horas > 0**; si no, mensaje UI:

  > Un grupo de trabajo debe tener al menos un día con carga horaria asignada. Si el grupo ya no opera, utilice la opción "Deshabilitar asignación".

- Servidor: `VAL-HLG-013` (array no vacío); validación de horas 0–24.

---

## 4. Deshabilitar HLg (borrado lógico)

| Acción | Efecto en documento | Auditoría |
|--------|---------------------|-----------|
| Deshabilitar HLg | `activo=false`, `fecha_fin` = fecha de corte (inclusivo) | Motivo texto **≤ 100 caracteres** solo en **evento** `evt_*` (no campo en Firestore) |
| Deshabilitar ciclo HLc | Cascada transaccional HLc + HLd + HLg con misma `fecha_corte` | Ya en `rrhhDeshabilitarHlc`; HLg abiertos deben cerrar en el mismo commit |

Callable: `rrhhDeshabilitarHlg` · códigos `VAL-HLG-DES-*`.

---

## 5. Seguridad — IDOR / BOLA

`guardarRegistroLaboralTemporal` (y deshabilitaciones) deben usar **`assertEscrituraLaboral`**:

- **RRHH** (`tokenHasRrhhLaborAccess`): puede escribir cualquier `persona_id`.
- **Agente** (sin RRHH): solo si `token.persona_id === payload.persona_id`.
- Caso contrario: `permission-denied`.

No depender solo de ocultar botones en React.

---

## 6. Rendimiento (solapes)

`findSolapeHlc`: acotar candidatos en memoria tras `where("persona_id")` — incluir solo HLc con `fecha_hasta` null **o** `fecha_hasta >= fechaDesde` del registro en curso.

---

## 7. Vigencia operativa unificada

`isHlcOperativo` / cargo activo para onboarding, check-in y warnings debe usar **vigencia inclusiva a hoy** + `activo` + sin deshabilitación administrativa, vía `fechaLaboralYmd` (no solo “`fecha_hasta` vacía”).

---

## 8. Trazabilidad errores

- Solape HLc bloqueante **`VAL-HLC-008`**: no existe; solape = **`VAL-HLC-W001`** (warning).
- Mantener código ↔ [`MATRIZ_WARN_ERROR_LABORAL_V2.md`](./MATRIZ_WARN_ERROR_LABORAL_V2.md) alineados.

---

## 9. Checklist de prueba manual (RRHH)

1. HLc inicio `31/05/2022` se muestra y guarda como `31/05/2022` (no `01/06/2022`).
2. HLg dentro del rango HLc; fuera de rango → error con fechas en `DD/MM/AAAA`.
3. Editar HLg: planilla 7 días con valores guardados; guardar con un día > 0 h.
4. Planilla toda en cero → mensaje que indica Deshabilitar asignación.
5. Deshabilitar HLg: corte + motivo (≤100) en evento; tarjeta pasa a histórico.
6. Deshabilitar HLc: HLg abiertos cierran con misma corte.
7. (Seguridad) Agente no puede guardar otro `persona_id` vía callable.

---

## 10. Archivos principales tocados en implementación

| Área | Archivos |
|------|----------|
| Shared | `fechaLaboralYmd.js`, `hlcOperativo.js`, `hlcVigenciaFecha.js` |
| Functions | `catalogosLaborales.js`, `catalogosShared.js`, `helpers.js`, `catalogos.js` |
| Web | `DatosLaborales.jsx`, `datos-laborales/*`, `callables.js`, `datosLaboralesService.js` |
| Docs | Esta nota, actualización matriz si hay `VAL-HLG-DES-*` |
