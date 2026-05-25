# Datos laborales — arquitectura web (V2)

**Estado:** vigente para implementación en `web/` (mayo 2026).  
**Pantalla:** `/portal/laboral` · entrada [`web/src/pages/DatosLaborales.jsx`](../../web/src/pages/DatosLaborales.jsx)  
**Contrato de negocio y BD:** [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md)  
**Auditoría funcional (fechas, HLg, BOLA):** [`DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md`](./DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md)  
**Refactor formulario (componentes base):** [`REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md`](./REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md)

---

## 1. Objetivo de este documento

Registrar **cómo está organizado el cliente** del módulo Datos laborales tras el refactor de mayo 2026: archivos, responsabilidades, reglas de UI ya implementadas y enlaces con backend. No sustituye el contrato Firestore ni las Callables; describe la **capa de presentación y orquestación** en React.

### Evolución de tamaño (líneas aprox., solo código fuente)

| Momento | `DatosLaborales.jsx` | Notas |
|---------|----------------------|--------|
| Pre-refactor (may 2026) | ~1 768 | Monolito: snapshots, formulario, tarjetas y modales inline |
| Tras tarjetas activas/históricas | ~1 470 | `LaboralCargosActivosCard`, `LaboralCargosHistoricosCard`, panel HLD |
| Tras snapshots + modales + formulario | ~900–950 | Hooks + `laboralSnapshots.js` + modales y modal de formulario extraídos |

El resto del módulo vive bajo `web/src/pages/datos-laborales/` (~3 500+ líneas repartidas).

---

## 2. Mapa de archivos (`web/src/pages/datos-laborales/`)

```
datos-laborales/
├── constants.js              # INITIAL_FORM_DATA_LABORAL, AYUDA_CAMPOS, COLECCIONES_FORM, OPCIONES_TIPO_ALTA
├── formLogic.js              # validateLaboralForm, buildFormDataFromRecord
├── payloadBuilders.js        # buildHlcPayload, buildHldPayload, buildHlgPayload
├── callableErrorMessage.js   # Mensajes amigables errores Cloud Functions (p. ej. IAM 403)
├── laboralDisplayFormat.js   # formatDateTime, formatFechaVisible (DD/MM/AAAA)
├── laboralSnapshots.js       # buildLaboralSnapshotActual, buildLaboralSnapshotHistorico
├── utils.js                  # Timeline, integridad, vigencia, índices, planilla 7 días
├── useDatosLaboralesCollections.js
├── useLaboralSnapshots.js
├── useLaboralAnalisisOperativa.js
├── components/
│   ├── LabeledSelect.jsx
│   ├── LabeledTextField.jsx
│   ├── PersonaSearchSelect.jsx
│   └── LaboralHldVigenciaPanel.jsx
└── sections/
    ├── LaboralCargosActivosCard.jsx      # CARGOS ACTIVOS + consistencia + HLD por ciclo
    ├── LaboralCargosHistoricosCard.jsx   # CARGOS CERRADOS O HISTÓRICOS
    ├── LaboralFormularioModal.jsx        # Modal “Carga y edición laboral”
    ├── LaboralModalesOperativos.jsx      # Deshabilitar HLC/HLg + resultado guardado
    ├── LaboralFormCabeceraFields.jsx
    ├── LaboralFormHlcFields.jsx
    ├── LaboralFormHlgFields.jsx
    ├── LaboralFormVigenciaFields.jsx
    ├── IntegridadReferencialCard.jsx
    ├── TimelineLaboralPersonaCard.jsx
    ├── VistaOperativaGrupoCard.jsx
    ├── ColeccionesLaboralesCards.jsx     # (import en página; uso según evolución UI)
    └── FasesLaboralesTables.jsx          # (import en página; tablas HLc/HLd/HLg — ver §7)
```

**Servicios (fuera de la carpeta):** [`web/src/services/datosLaboralesService.js`](../../web/src/services/datosLaboralesService.js) — `guardarRegistroLaboral`, `deshabilitarCicloHlc`, `deshabilitarAsignacionHlg`, listados.

**Shared (fechas):** [`shared/utils/fechaLaboralYmd.js`](../../shared/utils/fechaLaboralYmd.js) · [`shared/utils/fechaInstitucionalBa.js`](../../shared/utils/fechaInstitucionalBa.js) (réplica en `functions/modules/shared/`).

---

## 3. Página orquestadora — `DatosLaborales.jsx`

Responsabilidades que **permanecen** en la página:

| Área | Contenido |
|------|-----------|
| Estado | Formulario (`formData`, `cargaPorDiaRows`), edición (`modoEdicion`, `registroEditId`), modales deshabilitar, timeline/grupo filtros, `mostrarFormulario` |
| Datos | `useDatosLaboralesCollections` → `rowsByCollection`, índices `idxHlc`, `idxHld`, … |
| Derivados | `hlgRowsVisibles` (`activo !== false`), `cargoContexto`, `personaActivaLabel`, validación formulario |
| Hooks | `useLaboralSnapshots`, `useLaboralAnalisisOperativa` |
| Handlers | `onGuardarRegistro`, `abrirFormularioEdicionHlg`, `confirmarDeshabilitacionHlc/Hlg`, `cerrarFlujoFormularioManteniendoPersona`, etc. |
| Composición | Búsqueda persona → tarjetas cargos → modal formulario → integridad / timeline / vista grupo → modales operativos |

**No** debe volver a crecer con JSX masivo de tarjetas o snapshots: extender los módulos de `sections/` o `laboralSnapshots.js`.

---

## 4. Hooks de dominio (web)

### 4.1 `useLaboralSnapshots`

Entrada: `personaId`, filas `hlc`/`hld`/`hlg` visibles, mapas de catálogo (`idxHld`, `idxFunciones`, …).  
Salida: `snapshotActual`, `snapshotHistorico` (misma forma que antes del refactor).

Usado por: `LaboralCargosActivosCard`, `LaboralCargosHistoricosCard`.

### 4.2 `useLaboralAnalisisOperativa`

Entrada: filas laborales, índices, **estado de filtros** del timeline y parámetros de vista por grupo.  
Salida: `timelineItemsBase`, `timelineItems`, `timelineResumen`, `vistaGrupoItems`, más campos de `buildIntegridadLaboral` (`totalAlertasIntegridad`, `hldSinCargo`, …).

### 4.3 `useDatosLaboralesCollections`

Carga paralela de colecciones Firestore (laborales + `cfg_*` del formulario). Expone `cargarTodo`, loading/error por colección.

---

## 5. Reglas de UI implementadas (sin cambiar contrato BD)

### 5.1 Visibilidad HLg

Documentos con **`activo: false`** no se listan en la ficha operativa (ni vigentes ni históricos en tarjetas). Siguen en Firestore para auditoría. Helper: `hlgVisibleEnPantalla` / `registroLaboralActivo` en [`utils.js`](../../web/src/pages/datos-laborales/utils.js).

### 5.2 Tres vigencias en pantalla (no confundir)

| Bloque UI | Nivel | Origen del texto “Desde …” |
|-----------|--------|---------------------------|
| Período de cargo vigente | **HLc** | `hlc.fecha_desde` / `fecha_hasta` |
| Tarjeta de grupo (verde) | **HLg** | `fecha_inicio` / `fecha_fin` del HLg |
| Panel **Dato laboral (HLD)** | **HLd** | `fecha_inicio` / `fecha_fin` del HLD enlazado vía `dato_laboral_id` del HLg vigente |

Al **guardar un HLg**, el backend alinea fechas del **HLD** con las del formulario (mismo `fecha_desde`/`fecha_hasta` en payload HLD y HLg). El panel HLD deja explícito que no es la vigencia del cargo (HLc).

Componente: [`LaboralHldVigenciaPanel.jsx`](../../web/src/pages/datos-laborales/components/LaboralHldVigenciaPanel.jsx).

### 5.3 Formulario — validación y botón Guardar

- Validación reactiva: `validateLaboralForm` en [`formLogic.js`](../../web/src/pages/datos-laborales/formLogic.js) (incl. contención HLg ⊆ HLc, planilla con al menos un día con horas > 0).
- Botón **Guardar cambios**: azul solo si `puedeGuardarFormulario`; gris y deshabilitado si hay error; mensaje en rojo encima de los botones ([`LaboralFormularioModal.jsx`](../../web/src/pages/datos-laborales/sections/LaboralFormularioModal.jsx)).

### 5.4 Planilla HLg

7 filas fijas (`cfg_dia_semana`); persistencia de 7 días con `horas: 0` donde corresponda. Ver auditoría §3 en [`DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md`](./DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md).

### 5.5 Deshabilitar

- **HLg:** modal en `LaboralModalesOperativos` → `deshabilitarAsignacionHlg` / callable `rrhhDeshabilitarHlg`.
- **HLc:** modal deshabilitar ciclo → `deshabilitarCicloHlc`.

Errores Cloud Run **403** en callables nuevas: revisar invoker IAM (scripts en `scripts/grant-cloud-run-invoker-callables.mjs`, `scripts/grant-rrhh-deshabilitar-hlg-invoker.ps1`). Mensaje UI: [`callableErrorMessage.js`](../../web/src/pages/datos-laborales/callableErrorMessage.js).

---

## 6. Flujo de guardado (cliente)

1. Usuario completa modal → `onGuardarRegistro`.
2. `validateLaboralForm` (cliente).
3. Si `tipoAlta === historial_laboral_grupos`: `buildHldPayload` + `guardarRegistroLaboral(hld)` → `buildHlgPayload` + `guardarRegistroLaboral(hlg)`.
4. Si HLc: solo `buildHlcPayload` + guardado.
5. `callSyncSessionClaims` + `cargarTodo` + modal resultado.

Payloads: [`payloadBuilders.js`](../../web/src/pages/datos-laborales/payloadBuilders.js).

---

## 7. Archivos en repo sin montar en la página actual

| Archivo | Estado (may 2026) |
|---------|-------------------|
| `FasesLaboralesTables.jsx` | **No** importado en `DatosLaborales.jsx`; tablas HLc/HLd/HLg legacy. Mantener solo si se reactiva una vista “fases”; si no, candidato a eliminación tras confirmar con RRHH. |
| `ColeccionesLaboralesCards.jsx` | **No** importado; progreso de carga de colecciones. |
| `LaboralFormModoEdicionFields.jsx` | Usado desde cabecera/modal del formulario según composición actual. |

Antes de nuevas features, confirmar en JSX de la página qué se monta realmente.

---

## 8. Backend y despliegue (referencia cruzada)

| Tema | Dónde |
|------|--------|
| Callables export | `functions/modules/catalogosLaborales.js` → `functions/modules/catalogos.js` |
| Fechas write | `ymdDesdeValorLaboral`, vigencia inclusiva en `hlcOperativo` / validadores |
| `rrhhDeshabilitarHlg` | Set directo (sin transacción que opaque `HttpsError`) |
| Deploy Functions + IAM | Tras nueva callable: Cloud Run invoker `allUsers` o cuenta de prueba (consola GCP / scripts repo) |
| Hosting UI | `npm run build:web` + `firebase deploy --only hosting` |

Detalle de cambios de mayo 2026: [`DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md`](./DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md).

---

## 9. Cómo extender el módulo (convención)

1. **Lógica de vista por persona/cargo** → `laboralSnapshots.js` o nuevo builder en esa carpeta.
2. **Nueva tarjeta o bloque de ficha** → `sections/Laboral*.jsx` + props desde la página.
3. **Nuevo filtro analítico** → ampliar `useLaboralAnalisisOperativa` o `utils.js` (timeline/integridad).
4. **Campo de formulario** → sección HLc/HLg/Vigencia + `formLogic` + `payloadBuilders`.
5. **No** duplicar helpers de fecha: usar `fechaLaboralYmd` / `laboralDisplayFormat`.

---

## 10. Índice de documentación relacionada

| Documento | Uso |
|-----------|-----|
| [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) | Colecciones, HLc/HLd/HLg, principios |
| [`MATRIZ_WARN_ERROR_LABORAL_V2.md`](./MATRIZ_WARN_ERROR_LABORAL_V2.md) | Códigos VAL-* |
| [`REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md`](./REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md) | LabeledSelect/TextField, fix combo edición |
| [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md) | Orden alta persona → laboral → check-in |
| [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md) | Activo / baja / deshabilitado |
| [`HANDOFF_SESION_2026-05-19.md`](./HANDOFF_SESION_2026-05-19.md) | Cierre de sesión y “retomar aquí” |

---

**Última actualización documental:** 19 de mayo de 2026 (refactor web: tarjetas, snapshots, modales, hooks, panel HLD, validación formulario).
