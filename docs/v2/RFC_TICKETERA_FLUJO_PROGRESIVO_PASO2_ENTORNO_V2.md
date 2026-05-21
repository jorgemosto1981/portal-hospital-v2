# RFC — Ticketera flujo progresivo · Paso 2 entorno operativo (HLg / turno / grilla)

**Estado:** borrador de contrato · **2026-05-21**  
**Relacionados:** [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) · [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md) · [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §5.1

---

## 1. Flujo progresivo acordado

| Paso | Nombre | Callable | Qué valida | Qué **no** valida |
|------|--------|----------|------------|-------------------|
| **1** | Selección de artículo | `listarArticulosIngresoAgente` | Elegibilidad HLC + circuito + versión publicada Patrón B (filtros artículo) | HLg, turno, grilla RDA, saldos |
| **2** | Fecha y entorno (HLg) | **`validarEntornoOperativoSolicitud`** *(nuevo)* | HLC vigente en fecha, HLg/grupo ancla, re-elegibilidad artículo, gate grilla RDA si `depende_rda`, turno *(futuro)* | Saldos, tope mes, superposición `sol_*`, MDC |
| **3** | Previsualización | `previsualizarSolicitudPatronB` | Motor Patrón B: saldos, frecuencia mes, superposición, 1919/topes ya cubiertos en motor | — (reutiliza checks paso 2 vía core compartido) |

**Principio:** el wizard **bloquea** el avance del paso 2→3 si `ok === false`. Paso 3 solo corre si paso 2 devolvió `puede_previsualizar: true`.

**Futuro paso 1:** sección «Más usados» en UI (sin cambiar contrato paso 2).

---

## 2. Situación actual (deuda)

| Callable hoy | Usado en wizard | Limitación |
|--------------|-----------------|------------|
| `resolverContextoLaboralSolicitud` | Paso 2 UI | **No** recibe `articulo_id` / `version_id`; no corre gate grilla ni turno |
| `previsualizarSolicitudPatronB` | Paso 3 UI | Ejecuta **todo** el motor (incl. saldos + grilla); duplica trabajo si paso 2 no existía |

**Decisión:** no extender semánticamente `resolverContextoLaboralSolicitud` (queda para grilla GSO / RRHH con solo `fecha`). El wizard Patrón B usa el **nuevo** callable unificado del §3.

---

## 3. Callable propuesto: `validarEntornoOperativoSolicitud`

### 3.1 Identidad

| Campo | Valor |
|-------|--------|
| Nombre Firebase | `validarEntornoOperativoSolicitud` |
| Región | `southamerica-east1` (igual familia solicitudes) |
| Auth | Agente con `persona_id` + `isPortalRoleUsuario`; RRHH puede enviar `persona_id` explícito |
| Implementación sugerida | `functions/onCall/solicitudes/validarEntornoOperativoSolicitud.js` → core `validarEntornoOperativoSolicitudCore.js` |

### 3.2 Entrada

```json
{
  "articulo_id": "art_01KRNK10V10CH7W5M2W6V558GS",
  "version_id": "ver_01KRNKNBXNBFC9HZN7CZJGPRDH",
  "fecha_desde": "2026-05-21",
  "dias_solicitados": 1,
  "grupo_trabajo_id_ancla": "gdt_01KR3H81ENQK84ZK21EQWEQQXG",
  "persona_id": "per_01KR3HD24AMJ6YX3N7B3GPAZJ4"
}
```

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|--------|
| `articulo_id` | string `art_*` | **sí** | Del paso 1 |
| `version_id` | string `ver_*` | **sí** | Versión publicada elegida en listado |
| `fecha_desde` | `YYYY-MM-DD` | **sí** | Fecha del permiso (paso 2 UI) |
| `dias_solicitados` | number | no | Default desde `bloque_topes_plazos_computo.tope_dias_por_evento` (mín. 1) |
| `grupo_trabajo_id_ancla` | string `gdt_*` | no | Obligatorio en salida si `requiere_seleccion_grupo` |
| `persona_id` | string `per_*` | no* | *Obligatorio si caller es RRHH; si no, token del agente |

**No enviar en paso 2:** `fecha_hasta` (servidor la calcula), datos de saldo, borrador `sol_*`.

### 3.3 Salida — éxito (puede avanzar a previsualizar)

```json
{
  "ok": true,
  "puede_previsualizar": true,
  "persona_id": "per_01KR3HD24AMJ6YX3N7B3GPAZJ4",
  "articulo_id": "art_01KRNK10V10CH7W5M2W6V558GS",
  "version_id": "ver_01KRNKNBXNBFC9HZN7CZJGPRDH",
  "fecha_desde": "2026-05-21",
  "fecha_hasta": "2026-05-21",
  "dias_solicitados": 1,
  "hlc_id": "hlc_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
  "grupo_trabajo_id_ancla": "gdt_01KR3H81ENQK84ZK21EQWEQQXG",
  "grupos_trabajo_vigentes": [
    {
      "grupo_de_trabajo_id": "gdt_01KR3H81ENQK84ZK21EQWEQQXG",
      "hlg_id": "hlg_…",
      "etiqueta_ui": "Oficina PERSONAL",
      "nivel_jerarquico": 20
    }
  ],
  "requiere_seleccion_grupo": false,
  "checks": {
    "hlc_vigente": true,
    "elegibilidad_articulo": true,
    "circuito_ingreso": true,
    "grupo_trabajo_vigente": true,
    "grupo_ancla_resuelto": true,
    "grilla_rda": true,
    "turno": null
  },
  "codigos": [],
  "mensajes": []
}
```

### 3.4 Salida — bloqueo (wizard no avanza)

```json
{
  "ok": false,
  "puede_previsualizar": false,
  "persona_id": "per_…",
  "articulo_id": "art_…",
  "version_id": "ver_…",
  "fecha_desde": "2026-05-21",
  "fecha_hasta": "2026-05-21",
  "dias_solicitados": 1,
  "hlc_id": null,
  "grupo_trabajo_id_ancla": null,
  "grupos_trabajo_vigentes": [],
  "requiere_seleccion_grupo": false,
  "checks": {
    "hlc_vigente": false,
    "elegibilidad_articulo": false,
    "circuito_ingreso": true,
    "grupo_trabajo_vigente": false,
    "grupo_ancla_resuelto": false,
    "grilla_rda": true,
    "turno": null
  },
  "codigos": ["ELEG_SIN_HLC"],
  "mensajes": ["No tenés un cargo vigente para la fecha elegida."]
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ok` | boolean | `true` si todos los checks obligatorios del paso 2 pasaron |
| `puede_previsualizar` | boolean | **Alias contractual** de `ok` (UI wizard); siempre igual a `ok` en v1 |
| `checks` | object | Mapa fino para telemetría / mensajes UI por sección |
| `codigos` | string[] | Estables (`ELEG_*`, `SIN_GRUPO_VIGENTE`, `GRILLA_NO_AUTORIZADA`, …) |
| `mensajes` | string[] | Texto usuario (español), alineado a `mensajeParaCodigo` |
| `requiere_seleccion_grupo` | boolean | `true` → UI debe pedir `grupo_trabajo_id_ancla` y reintentar |
| `grupos_trabajo_vigentes` | array | Misma forma que `resolverContextoLaboralSolicitud` |
| `fecha_hasta` | string | Calculada (`patronBFechasSolicitud`) aunque `ok` sea false (UI RO) |
| `hlc_id` | string \| null | HLC usada para elegibilidad en esa fecha (primera que cumple filtros) |

### 3.5 Códigos de error (paso 2)

| Código | Check | Origen actual |
|--------|-------|----------------|
| `ELEG_SIN_HLC` | `hlc_vigente` | `solicitudElegibilidadLaboral` |
| `ELEG_ESCALAFON` … `ELEG_PERSONA` | `elegibilidad_articulo` | Filtros versión § RFC 64-A §6 |
| `CIRCUITO_ROL` | `circuito_ingreso` | `evaluarCircuitoIngreso` |
| `SIN_GRUPO_VIGENTE` | `grupo_trabajo_vigente` | `listarGruposTrabajoVigentesEnFecha` vacío |
| `GRUPO_ANCLA_REQUERIDO` | `grupo_ancla_resuelto` | N>1 HLg sin `grupo_trabajo_id_ancla` |
| `GRUPO_ANCLA_INVALIDO` | `grupo_ancla_resuelto` | Ancla no vigente en fecha |
| `GRILLA_NO_AUTORIZADA` | `grilla_rda` | Plan rotativa existe y `estado_plan` ≠ `AUTORIZADO` |
| `TURNO_NO_PLANIFICADO` | `turno` | `depende_rda` y sin `capa_teorica` en `asi_*` del día |
| `FECHA_RANGO` | — | `fecha_desde` / `dias_solicitados` inválidos |
| `VERSION_NO_PUBLICADA` | — | Versión no `cfg_est_ver_publicada` |

**Fuera de paso 2 (solo paso 3):** `SALDO_CICLO`, `SALDO_MES`, `SALDO_EVENTO`, `SUPERPOSICION_FECHAS`.

### 3.6 Orden de evaluación (determinista)

```text
1. Parse entrada + persona_id (token / RRHH)
2. Cargar persona + versión publicada + Patrón B
3. Calcular dias_solicitados, fecha_hasta
4. HLC vigentes en fecha_desde → si [] → ELEG_SIN_HLC
5. resolverElegibilidadSolicitud(version, hlc, circuito) → si fail → códigos ELEG_*
6. listarGruposTrabajoVigentesEnFecha → si [] → SIN_GRUPO_VIGENTE
7. resolverGrupoTrabajoIdAnclaParaSolicitud → si fail → GRUPO_ANCLA_*
8. validarGrillaHorariaParaSolicitud (depende_rda) → si fail → GRILLA_NO_AUTORIZADA
9. `evaluarGrillaTurnoEntorno` (`grillaTurnoEntornoGate.js`) — plan no autorizado o sin capa teórica
10. return ok + puede_previsualizar
```

### 3.7 Relación con `previsualizarSolicitudPatronB` (paso 3)

| Aspecto | Regla |
|---------|--------|
| Duplicación | Paso 3 **re-ejecuta** elegibilidad + grupo + grilla vía `runPatronBAltaMotor` (defensa en profundidad) |
| Refactor objetivo | Extraer pasos 4–8 del §3.6 a `validarEntornoOperativoSolicitudCore`; motor y preview llaman el mismo core |
| UI | Paso 3 solo habilitado si paso 2 guardó snapshot `{ articulo_id, version_id, fecha_desde, grupo_trabajo_id_ancla, fecha_hasta, dias_solicitados }` |

---

## 4. Check `turno` (futuro — contrato reservado)

Cuando la versión del artículo defina restricciones de turno/regimen (campo TBD en `bloque_topes_plazos_computo` o workflow):

| Entrada implícita | Fuente |
|-------------------|--------|
| `persona_id`, `fecha_desde`, `fecha_hasta` | Request |
| `grupo_trabajo_id_ancla` | Resuelto en paso 2 |
| Teoría del día | `asistencia_diaria` / `capa_teorica` o plan rotativa |

| Salida `checks.turno` | Significado |
|----------------------|-------------|
| `null` | Artículo no exige validación de turno (v1 default) |
| `true` | Turno compatible |
| `false` + `TURNO_NO_COMPATIBLE` | Bloqueo paso 2 |

**No implementar en PR1** del callable; dejar stub y documentar en configurador de artículos.

---

## 5. Cambios UI (después del callable)

| Componente | Cambio |
|------------|--------|
| `useSolicitud64AAlta` | Al salir paso 2: `callValidarEntornoOperativoSolicitud`; guardar `entornoOk` |
| `SolicitudPatronBForm` | Botón «Continuar» paso 2 → callable; mensajes por `checks` |
| `callables.js` | Export `callValidarEntornoOperativoSolicitud` |
| `resolverContextoLaboralSolicitud` | Mantener para grilla/equipo; wizard deja de depender solo de él |

---

## 6. Pruebas

| Caso | Entrada | Esperado |
|------|---------|----------|
| T2-ent-01 | Fecha sin HLc | `ELEG_SIN_HLC`, `ok: false` |
| T2-ent-02 | Fecha sin HLg | `SIN_GRUPO_VIGENTE` |
| T2-ent-03 | 2 HLg sin ancla | `GRUPO_ANCLA_REQUERIDO`, `requiere_seleccion_grupo: true` |
| T2-ent-04 | 64-A `depende_rda` sin `asi_*` | `GRILLA_NO_AUTORIZADA` |
| T2-ent-05 | Piloto 28914247 fecha con grupo | `ok: true`, `puede_previsualizar: true` |

Tests unitarios: core sin Firestore (mocks) + integración opcional con emulador.

---

## 7. Implementación backend (2026-05-21)

| Archivo | Rol |
|---------|-----|
| `functions/modules/ticketera/grillaTurnoEntornoGate.js` | Grilla RDA + turno (`TURNO_NO_PLANIFICADO` / `GRILLA_NO_AUTORIZADA`) |
| `functions/modules/ticketera/validarEntornoOperativoCore.js` | Orquestación paso 2 |
| `functions/onCall/solicitudes/validarEntornoOperativoSolicitud.js` | Callable export |
| `functions/test/validarEntornoOperativo.test.js` | T2-ent-01…05 |

`mdcGrillaHorariaGate.js` delega en `evaluarGrillaTurnoEntorno` (motor/trigger mantiene códigos legacy en rechazo).

## 8. Próximo paso

1. **Deploy** `validarEntornoOperativoSolicitud` a Functions.  
2. **Cablear wizard** paso 2 (React) — sin UI hasta tests OK en prod opcional.  
3. **Refactor opcional** preview comparte core paso 2–8 (PR2).

---

*RFC Paso 2 — formalizar antes de React, alineado al flujo progresivo acordado 2026-05-21.*
