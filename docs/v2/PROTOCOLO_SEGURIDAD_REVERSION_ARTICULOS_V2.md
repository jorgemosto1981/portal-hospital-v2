# Protocolo de seguridad y reversión — Artículos V2 (Triple capa / Schema)

**Propósito:** ancla de código y de datos **antes** de cambios de estructura (Firestore, Functions, reglas). Stack: Git + Firebase (Blaze) + Cursor.

**Cuándo aplicarlo:** antes del primer merge que introduzca colecciones de **triple capa** (`solicitudes_articulo` + capa saldos + capa vista mensual), triggers en cadena o reglas nuevas.

**Contrato de datos:** [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) (§2.5–2.8).

---

## 1. Tag de Git — ancla de código

Crea un punto de restauración **inmutable** en el historial. Ejecutar **después** de tener el working tree limpio y los docs de arquitectura **commiteados**.

```bash
git status
git add .
git commit -m "docs: arquitectura Artículos V2 (schema, triple capa, protocolo reversión)"
git tag -a v1.9.0-pre-articulos-v2 -m "Estado estable previo a implementación Triple Capa y schema V2"
git push origin HEAD
git push origin v1.9.0-pre-articulos-v2
```

**Volver a este código (rama actual):**

```bash
git fetch origin
git checkout <tu-rama-de-trabajo>
git reset --hard v1.9.0-pre-articulos-v2
```

> **No uses `git push --force` a `main`** salvo política explícita del equipo y ventana acordada. Preferí **rama de implementación** + PR, o **revert** de commits sobre `main`.

---

## 2. Backup de Firestore — red de datos

Antes de migraciones o escrituras masivas de Functions que toquen **saldos** o **vistas**:

**Opción A — `gcloud` (Google Cloud SDK):**

```bash
gcloud firestore export gs://TU_BUCKET_BACKUPS/pre-v2-articulos --project=TU_PROJECT_ID
```

Sustituí `TU_BUCKET_BACKUPS` y `TU_PROJECT_ID` (p. ej. `portal-hospital-v2`).

**Opción B — Consola:** Google Cloud Console → Firestore → **Importar/Exportar** → exportación manual de las colecciones que vayan a mutar.

**Importación de emergencia (solo si hubo corrupción y política lo autoriza):**

```bash
gcloud firestore import gs://TU_BUCKET_BACKUPS/pre-v2-articulos --project=TU_PROJECT_ID
```

> Importar **sobreescribe** el destino acorde al producto de import de GCP; coordinar con ventana de mantenimiento.

---

## 3. Ramificación — aislamiento

- **Prohibido** implementar triple capa y triggers directamente sobre `main` sin revisión.
- Crear rama dedicada desde el commit etiquetado (o desde `feature/articulos-v2-reborn` si esa es la línea de trabajo):

```bash
git checkout v1.9.0-pre-articulos-v2   # o el commit base acordado
git checkout -b feature/articulos-v2-triple-layer
```

Nombre sugerido: `feature/articulos-v2-triple-layer` (implementación física). Puede convivir con `feature/articulos-v2-reborn` según estrategia del equipo; lo importante es **una rama por incremento** y PR antes de `main`.

**Criterio de merge:** la grilla mensual cumple presupuesto de lecturas del schema (**§8**, objetivo N / techo acordado) con datos de prueba y emuladores verdes.

---

## 4. Plan de rollback — si explota después de desplegar

Seguir **en orden**. Ajustar nombres de rama/proyecto.

### Paso A — Código

1. Identificar el tag o commit estable (`v1.9.0-pre-articulos-v2`).
2. En la **rama de implementación**: `git reset --hard v1.9.0-pre-articulos-v2` (o `git revert` de un rango de commits si no se puede reescribir historia).
3. Redesplegar **Functions** y **hosting** desde ese árbol (`firebase deploy` según scripts del repo).

Evitar `git push --force origin main` salvo procedimiento de incidente acordado.

### Paso B — Reglas Firestore

Consola Firebase → Firestore → **Rules** → **History** → restaurar versión anterior → publicar.

### Paso C — Datos

Solo si hay corrupción en documentos de saldo/vista: import desde el export del **§2** (importación controlada, ver advertencias arriba).

---

## 5. Checklist pre-implementación (Cursor / equipo)

- [ ] **Aislamiento:** trabajo en rama dedicada (`feature/articulos-v2-triple-layer` o la acordada), no en `main` sin PR.
- [ ] **Tag:** `v1.9.0-pre-articulos-v2` (o versión bump siguiente) creado y **pusheado** tras commit estable.
- [ ] **Export Firestore** si existe data real en colecciones afectadas.
- [ ] **Pre-vuelo:** antes de cada deploy de Functions, emuladores + tests de integración pasan (scripts del `package.json` del repo).
- [ ] **Modo espejo:** no eliminar colecciones o campos legacy hasta validar triple capa con datos de prueba y rollback probado en staging.

---

## 6. Referencias

- [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md)
- [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md)
