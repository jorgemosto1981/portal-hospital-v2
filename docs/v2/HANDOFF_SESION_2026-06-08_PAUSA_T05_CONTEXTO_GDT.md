# Handoff — Sesión 2026-06-08 · Cierre US-13 ops + pausa T-05 (contexto GDT)

**Estado:** **PAUSA** — sin código T-05 en esta sesión; acuerdo de producto y DoR documentados.  
**Producción:** https://portal-hospital-v2.web.app  
**Índice RETOMAR AQUÍ:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)  
**Handoff US-13 smoke:** commit `0af4b0f` · acta [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md)

---

## 1. Resumen ejecutivo

| Bloque | Estado | Referencia |
|--------|--------|------------|
| **US-13 ops** | ✅ Cerrado | Smoke piloto prod G1/G2/G4/G6 + G2 neg. motor · acta checklist |
| **Git cierre US-13** | ✅ `0af4b0f` en `origin/master` | Grilla jefe, redirect `/portal/grilla`, docs acta |
| **T-05 (épica F3)** | ⏸ DoR + reencuadre | Dos frentes: **contexto GDT** (operativo) + **paleta segmentos** (editor plan) |
| **Implementación T-05** | ⏳ Pendiente | Ver §5 orden sugerido |

---

## 2. US-13 — cierre oficial (esta sesión / continuidad)

### 2.1 Commit y remoto

- **Commit:** `0af4b0f` — `docs: acta cierre US-13, checklist completado y ajustes en grilla jefe`
- **Push:** `master` → `origin/master`
- **Incluye:** `CHECKLIST_…`, `PENDIENTES_…`, `GrillaOperativaJefePage`, `GrillaPortalRedirect`, menú jefe, `App.jsx`, catálogo pantallas.

### 2.2 Piloto smoke (prod 2026-06-08)

| Parámetro | Valor |
|-----------|--------|
| GDT | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` — Sala Internación 1 |
| Período | `2026-06` |
| Plan | `plt_01KT9AZQGV0BRZVSEEMBT0141A` — HABILITADO |
| Jefe piloto | CHAPARRO DNI `27667499` |
| Motor | `npm run test:us13-functions` — 30/30 |

Reglas validadas en UI: G4 self, G2 feliz, G1a/G1b, G6 planta; G2 negativo vía motor `NO_ES_SUPERIOR_JERARQUICO`.

### 2.3 Working tree local

- Archivos `functions/modules/shared/*.js` con aviso LF/CRLF (Windows): **sin diff real** — usar `git restore functions/modules/shared/` si molestan en otra PC.

---

## 3. T-05 — DoR editor segmentos (épica documental)

**Componente base:** `web/src/pages/jefe/planes/GrillaMensualEditor.jsx` (~1.300 líneas) — **no** esqueleto nuevo.

**Props actuales del editor:** `plan`, `grupoId`, `periodo`, modos vista/incorporación, callbacks guardar/cerrar/huecos. El **GDT ya viene fijado** desde `PlanTurnoServicioPage` al abrir el modal.

**T-02 listo para el editor:**

- Zod: `web/src/schemas/capaTeoricaSegmentos.schema.js`
- Motor: `buildSegmentosDesdeTurnoCompuesto`, `buildCapaTeoricaSegmentada` (`capaTeoricaSegmentosCore.js`)
- Guardado plan: intención `{ tipo_dia, turno_id }` — **no** reenvía `capa_teorica` (RFC)

**CA#1 acordado (plan mensual):**

- **Una** intención por celda (`turno_id` atómico o compuesto `M+T`, etc.).
- **No** multi-selección ad-hoc de tramos en el mismo día en el editor de plan.
- Compuestos: el backend materializa `segmentos[]` al aprobar/materializar.

**Pendiente técnico (paleta F3):**

- Paleta hoy = unión global `turnos_disponibles` (solo planificados).
- `horarioPlanificadoPorTurno` no descompone ids `+`.
- Util web espejo de parseo compuesto + paleta **por régimen de fila** + labels/horarios.

---

## 4. T-05 reencuadre operativo — selector de contexto GDT

### 4.1 Por qué (producto)

1. **Anti cross-pollination:** plan y `vis_*` son por `grupo_id`; mezclar dos GDT en una vista de gestión genera nombres duplicados y turnos cruzados.
2. **G2 (US-13):** la jerarquía se evalúa en el **GDT de la operación** (`teoriaPermisosGso` + `nivelJerarquico` en contexto).
3. **Jefe dual rol:** foco explícito “Consultorio” vs “Guardia” sin adivinar contexto.

### 4.2 Qué ya existe en código (no reinventar)

| Superficie | Selector GDT | Recarga |
|------------|--------------|---------|
| `/portal/jefe/planes-turno` | Tarjetas mes × GDT · URL `grupo_id`, `periodo` | Sí — planes + `listarContextoPlanGrupo` |
| `/portal/jefe/grilla-operativa` | `GrillaMesSelector` — vista **Equipo** (y Titular si ≥2 HLg) | Sí vía `useGrillaMesVista.cargar` → `listarVistaGrillaMesPorGrupo` |
| `GrillaMensualEditor` | `grupoId` implícito del plan abierto | Cambiar GDT = cerrar modal y elegir otra tarjeta |

### 4.3 Lista de GDT para el jefe — origen de datos

- **No** hay lista de `gdt_*` en el token JWT.
- **Callable:** `resolverContextoLaboralSolicitud` (`callResolverContextoLaboralSolicitud`) con `{ persona_id, fecha_desde }` (corte fin de mes).
- **Respuesta:** `grupos_trabajo_vigentes[]`, `grupo_trabajo_id_ancla_sugerido`, `requiere_seleccion_grupo`.
- **Matiz:** lista = **HLg vigente del actor**, no “solo grupos donde soy superior”. Para modo coordinador usar vista **Equipo** + un GDT.
- **RRHH:** catálogo `listarColeccionLaboral("grupos_de_trabajo")`.
- **Escritura plan:** `assertPlanAuth(request, grupoId, acción)` — HLg en ese GDT.

### 4.4 Cambio de GDT: recarga total (no filtro visual)

Al cambiar foco, el bounded context cambia (`vis_*`, filas equipo, plan mensual del GDT). Patrón correcto: nueva llamada API, no filtrar en cliente un mega-listado.

**Fricción actual:** en grilla operativa, tras cambiar el `<select>` de grupo suele hacer falta pulsar **Cargar** — candidato a auto-`cargar` al cambiar GDT.

### 4.5 Hueco de seguridad a cerrar con T-05

- `listarVistaGrillaMesPorGrupo` valida sesión/persona pero **no** replica membresía HLg en el GDT (a diferencia de `assertPlanAuth` “leer”).
- **Recomendación:** assert pertenencia al `grupo_trabajo_id` en ese callable (salvo RRHH labor).

---

## 5. Orden de implementación acordado (próxima sesión)

**Decisión 2026-06-10:** **Dos shells + motor compartido** — cerrar **grilla operativa RRHH** (`/portal/rrhh/grilla-operativa`) antes que jefe o Turnos mensuales. El jefe no es “RRHH con filtros”; es otro bounded context (HLg vigente + G2). Contrato de capacidades: `web/src/features/grilla/grillaOperativaCapabilities.js` (`resolveGrillaOperativaCapabilities` desde cada shell).

| Paso | Entregable | Notas |
|------|------------|--------|
| **0** | `GrillaOperativaCapabilities` + shells | ✅ en curso — `GrillaOperativaRrhhPage` / `GrillaOperativaJefePage` pasan `capabilities`; panel deja de inferir liquidación/fichadas solo por claim en ruta jefe |
| **1** | `SelectorFocoGdt` reutilizable | RRHH: `origenGrupos: "catalogo"` · jefe (después): `"hlg_vigente"` |
| **2** | URL `?grupo_id=&periodo=` en **grilla RRHH** | Luego paridad en jefe y escritura en Turnos mensuales |
| **3** | Auto-recarga al cambiar GDT | Quitar fricción botón solo para cambio de grupo |
| **4** | Cabecera “Trabajando en: {GDT} · {período}” | Contexto visible |
| **5** | Backend: auth en `listarVistaGrillaMesPorGrupo` | ✅ `assertPlanAuth(..., "leer")` (RRHH pasa · jefe exige HLg vigente en el GDT) |
| **5b** | URL foco shell jefe | ✅ `syncFocoEnUrl` + `SelectorFocoGdt` (`hlg_vigente`) · tarjetas ocultas con foco URL |
| **6** | (Paralelo o después) Paleta compuesta en `GrillaMensualEditor` | Con GDT ya fijado — épica F3 original |

**Opcional v2:** callable “solo grupos gestión” (intersección HLg + superior jerárquico) — **no existe hoy**.

---

## 6. Referencias rápidas

| Tema | Archivo |
|------|---------|
| Épica tickets F3 | [`EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md`](./EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md) |
| Editor plan | `web/src/pages/jefe/planes/GrillaMensualEditor.jsx` |
| Grilla GSO hook | `web/src/features/grilla/useGrillaMesVista.js` |
| Selector UI | `web/src/features/grilla/GrillaMesSelector.jsx` |
| Permisos G1–G7 | [`MATRIZ_US13_PERMISOS_TEORIA_V2.md`](./MATRIZ_US13_PERMISOS_TEORIA_V2.md) |
| Backlog SSoT | [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) §3 |

---

## 7. Comandos útiles (otra PC)

```bash
git pull origin master
npm run test:us13-functions
cd web && npm run test -- --run grillaMesEquipoDisplay
```

Transcript sesión (Cursor): `agent-transcripts/49e80f93-eece-43fa-9e9f-6325ad927ec8/49e80f93-eece-43fa-9e9f-6325ad927ec8.jsonl`
