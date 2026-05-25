# Handoff de sesión — 2026-05-09

## Resumen

Sesión dedicada a **planificación y documentación** del **módulo de configuración de artículos** (licencias, justificaciones, franquicias) para **V2**, alineada a normativa (Decreto 1919/89, SARH, Ley 8525), contratos `cfg_*`, ticketera, asistencia (MDC/RDA) y eventos RRHH. **No se codificó la aplicación** en esta sesión; el entregable principal son **documentos en `docs/v2/`** y el **plan maestro en Cursor** (ruta local, ver más abajo).

Se acordó un **punto de restauración en Git** (commit + **tag anotado** en remoto) antes de futuros cambios grandes de código.

---

## 1) Plan maestro (Cursor)

- **Ubicación local:** `C:\Users\jorge\.cursor\plans\plan_configuración_artículos_ffc0f493.plan.md`
- **Contenido relevante:** alcance, vocabulario `cfg_*`, máquina de estados, SLA/burbujeo, superposición, documentación diferida, eventos `cfg_tev_art_*`, Gate RFC, **no negociables** (§14), hábil compuesto (filtro sustractivo: base MDC − `cfg_cfi_*`), prefijos `cfg_tcp_*` / `cfg_cfi_*`, `variantes_sarh[]` con metadatos, MVP sin recordatorios proactivos.

**Nota:** la carpeta `.cursor/plans/` **no forma parte del repositorio** por defecto. Si se desea la misma especificación versionada en el repo, copiar o sincronizar fragmentos a `docs/v2/` en una sesión posterior (sin duplicar fuentes de verdad contradictorias).

---

## 2) Documentos nuevos en `docs/v2/` (entregables §8 del plan)

| Archivo | Descripción breve |
|---------|-------------------|
| [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) | Módulo maestro: principios, entidades, SARH 1:N, vigencia, documentación diferida, UX blueprint |
| [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md) | Prefijos, colecciones del dominio, campos núcleo, MVP 9 eventos |
| [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md) | Jerarquía decreto / SARH / Ley 8525 y trazabilidad |
| [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) | Ocho escenarios → parámetros |
| [`BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md`](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md) | Interfaces con ticketera, Asistencia/MDC, eventos, SLA |

**Índice actualizado:** [`README.md`](./README.md) — tabla “Índice rápido” con enlaces a los cinco documentos anteriores.

---

## 3) Decisiones de producto/datos registradas (referencia cruzada)

- **Relación Decreto → SARH:** 1:N; variantes en `variantes_sarh[]` con `{ codigo_sarh, etiqueta_ui, afecta_sueldo_porcentaje, activo }` cuando las reglas son casi idénticas; artículo duplicado (`art_<ULID>`) si cambian workflow/impacto sustantivo.
- **Prefijos:** `cfg_cfi_<ULID>` (calendario feriados institucional), `cfg_tcp_<ULID>` (tipo cómputo plazo documental).
- **Hábil compuesto:** primero laborables del agente (contrato Asistencia/MDC); luego restar coincidencias con `cfg_calendario_feriados_institucional` según `alcance_efector_id`; feriado pisa hábil para plazos administrativos salvo excepciones documentadas.
- **Documentación diferida:** ancla = día posterior al último día de licencia; vencimiento sin doc por defecto **alerta/evento**; recordatorios proactivos **fuera de MVP**.
- **Eventos MVP:** nueve `codigo_interno` con prefijo `cfg_tev_art_*`; `modulo_origen = articulos`.
- **UX configuración:** RRHH, desktop-only (plan).

---

## 4) Backup en Git y restauración (punto de control antes de más código)

### 4.1 Tag de snapshot (recomendado)

En el remoto quedó publicado un **tag anotado** (nombre exacto en la salida del comando `git tag -l "snapshot*"` tras el push de esta sesión). Ese tag apunta al **commit** que incluye esta documentación y el handoff.

**Listar tag:**

```bash
git fetch origin --tags
git tag -l "snapshot*"
```

**Volver el árbol de trabajo exactamente a ese punto (destructivo en working tree):**

```bash
git checkout snapshot-2026-05-09-articulos-docs-backup
```

O crear una rama desde el tag para inspeccionar sin mover HEAD de tu rama principal:

```bash
git checkout -b restauracion-desde-snapshot-2026-05-09 snapshot-2026-05-09-articulos-docs-backup
```

**Descartar trabajo posterior y alinear la rama actual al snapshot** (solo si se entiende que se pierden commits posteriores en esa rama local):

```bash
git reset --hard snapshot-2026-05-09-articulos-docs-backup
```

Para **reescribir remoto** con reset es necesario `git push --force` — usar solo con acuerdo de equipo; el tag sigue siendo el ref seguro para clonar o crear ramas de recuperación.

### 4.2 Rama y commit

- **Rama usada en esta sesión:** `mvp-fase1-onboarding`
- **Remoto:** `origin` → `https://github.com/jorgemosto1981/portal-hospital-v2.git`

El **push** de la rama y del **tag** deja copia en GitHub: clonación en otra máquina o `git fetch` recupera el mismo estado.

### 4.3 Copia fuera de Git (opcional)

Para backup adicional del disco completo (incl. `.cursor`, node_modules, etc.), usar copia de carpeta del proyecto o herramienta de archivo; **no** sustituye el tag en Git para reproducibilidad del código versionado.

---

## 5) Próximos pasos sugeridos (sin ejecutarse en esta sesión)

1. Revisión humana de los cinco `.md` nuevos y del Gate RFC del plan.
2. RFC de **schema Firestore / Rules** para `cfg_articulos`, `solicitudes_articulo`, `cfg_tcp_*`, `cfg_cfi_*` cuando se autorice codificación.
3. Implementación por fases: callable motor validación, pantalla RRHH, integración MDC para laborables.

---

## 6) Reglas de proyecto recordadas

- V2 **no** comparte Firebase/datos con V1.
- Sin semillas contra Firestore salvo proceso explícito (`ALLOW_FIRESTORE_SEED_V2`, etc.).
- Transiciones sensibles de estados según documentación transversal V2 (callable/backend donde aplique).

---

## 7) Archivos tocados en el repo (esta sesión)

- `docs/v2/README.md` (índice)
- `docs/v2/MODULO_CONFIGURACION_ARTICULOS_V2.md` (nuevo)
- `docs/v2/DICCIONARIO_CFG_ARTICULOS_V2.md` (nuevo)
- `docs/v2/ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md` (nuevo)
- `docs/v2/MATRIZ_ESCENARIOS_ARTICULOS_V2.md` (nuevo)
- `docs/v2/BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md` (nuevo)
- `docs/v2/HANDOFF_SESION_2026-05-09.md` (este archivo)

---

**Fin del handoff — 2026-05-09**
