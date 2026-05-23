# Handoff — Motor LAO v2 (RFC cableado) · PAUSA 2026-05-23

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · región `southamerica-east1`  
**Hosting prod:** https://portal-hospital-v2.web.app  
**Artículo LAO piloto:** `art_01KRNYDN5WR7RER7MWXRZ817E7`

> **Retomar en otra PC (obligatorio):**
> ```bash
> git fetch origin
> git checkout feature/ticketera-puente-campos-config
> git pull origin feature/ticketera-puente-campos-config
> ```
> **HEAD al cerrar sesión:** ver `git log -1` tras el commit de cierre de esta sesión.

---

## 1. Punto exacto — RETOMAR AQUÍ

**Siguiente tarea: Fase 4 — CI semántica muerta (R5)**

1. Crear `scripts/auditar-campos-version-consumidos-lao.mjs` (RFC §12).
2. Añadir npm script (p. ej. `npm run audit:lao-campos-version`).
3. Ejecutar localmente; corregir huérfanos si los hay.
4. Después: **Fase 6** (actualizar RFC §16, criterios §15, MODULO §4.1) y **Fase 5** checklist BD greenfield (operativa RRHH).

**Smoke test pendiente (opcional al retomar):** acreditación RRHH vía `acreditarLaoBolsaAgente` sin `cantidad_inicial` manual — verificar cupo v2 en `saldos_articulo_agente`.

---

## 2. Qué se hizo en esta sesión (RFC LAO motor wiring)

| Fase | Estado | Entregable |
|------|--------|------------|
| **Eje 1** — Core motor | ✅ | `laoMotorConfigResolver`, `laoHlcIntervals`, `laoAsignacionDiasCore`, tests `laoMotorCore.test.js` (15/15) |
| **Eje 2** — Orquestador | ✅ | `laoAltaMotorCompleto`, `laoMotorAuditoriaSnapshot`, `simularLaoPreview`, trigger `onSolicitudArticuloLaoMotorValidate` |
| **Eje 3** — UI auditoría | ✅ | `LaoAuditoriaDisplay`, bandeja RRHH `BandejaRrhhMotorAuditoria`, fase C `FECHAS_OK` |
| **Fase 3** — Schema + config | ✅ | 3 campos motor en Zod + `LaoMotorParamsEditor` + guardián Firestore |
| **Fase 1** — Superposición | ✅ | `laoSuperposicionMotor` → `superposicionVal` en orquestador fase E; **validado prod** |
| **Fase 2** — Erradicar v1 | ✅ | `laoPreviewDateUtils.js`; eliminado `laoPreviewMotor.js`; `acreditarLaoBolsaAgente` → `runLaoAsignacionDiasCore` |

**Orden de ejecución acordado:** 3 → 1 → 2 → 4 → 6 → 5 (BD).

---

## 3. Deploy Functions (prod, sesión)

Desplegar **una function por comando** en PowerShell (coma en `--only` falla):

```powershell
firebase deploy --only functions:simularLaoPreview
firebase deploy --only functions:onSolicitudArticuloLaoMotorValidate
firebase deploy --only functions:listarSolicitudesBandejaRrhh
firebase deploy --only functions:acreditarLaoBolsaAgente
```

| Callable / trigger | Estado deploy sesión |
|--------------------|----------------------|
| `simularLaoPreview` | ✅ (v2 + date utils + superposición) |
| `onSolicitudArticuloLaoMotorValidate` | ✅ (superposición + snapshot v2) |
| `acreditarLaoBolsaAgente` | ✅ (motor v2 asignación) |
| `listarSolicitudesBandejaRrhh` | ✅ (sesión anterior — `motor_snapshot`) |

---

## 4. Validaciones manuales OK

| Prueba | Resultado |
|--------|-----------|
| Configurador: guardar versión LAO + 3 campos motor | ✅ `ver_01KRPQDTM7BHZKYGKR91BEXHTR` |
| Preview wizard: motor `lao-preview-v2`, TSE 152/180, camino stock | ✅ |
| Preaviso R4: advertencias sin bloquear | ✅ |
| Superposición: rango 23/05→01/06 vs trámite existente | ✅ bloqueo + copy Patrón B |
| Bandeja RRHH: snapshot inmutable visible | ✅ (sesión previa) |

**Evidencia snapshot v2:** solicitud `sol_01KSBCCZQRA6JDCZ3VPPYW5JQC` (pre-deploy referencia).

---

## 5. Archivos clave (mapa rápido)

| Pieza | Ruta |
|-------|------|
| RFC SSoT | [`RFC_LAO_MOTOR_CONFIG_WIRING_V2.md`](./RFC_LAO_MOTOR_CONFIG_WIRING_V2.md) |
| Orquestador | `functions/modules/shared/laoAltaMotorCompleto.js` |
| Asignación L | `functions/modules/shared/laoAsignacionDiasCore.js` |
| Superposición E | `functions/modules/shared/laoSuperposicionMotor.js` |
| Date utils (ex-v1) | `functions/modules/shared/laoPreviewDateUtils.js` |
| Preview callable | `functions/onCall/solicitudes/simularLaoPreview.js` |
| Trigger alta | `functions/triggers/solicitudArticuloLaoOnCreate.js` |
| Acreditación RRHH | `functions/onCall/solicitudes/acreditarLaoBolsaAgente.js` |
| Config UI motor | `web/src/features/configuracion/articulos/LaoMotorParamsEditor.jsx` |
| Auditoría wizard | `web/src/features/lao/LaoAuditoriaDisplay.jsx` |
| Wizard | `web/src/pages/LaoWizardTicketera.jsx` |

**Eliminado:** `functions/modules/shared/laoPreviewMotor.js`, `tests/lao-preview-motor.test.mjs`

---

## 6. Tests backend (correr al retomar)

```powershell
node --test functions/test/laoMotorCore.test.js functions/test/laoAltaMotorCompleto.test.js functions/test/laoPreviewDateUtils.test.js
node --test web/src/features/lao/laoAuditoriaDisplayUtils.test.js
```

Última corrida sesión: **26/26** tests motor + date utils OK.

---

## 7. Pendiente RFC (no hecho)

| Ítem | Fase |
|------|------|
| `scripts/auditar-campos-version-consumidos-lao.mjs` + npm script | **4 — próximo** |
| Actualizar §15 criterios + §16 checklist + MODULO §4.1 | 6 |
| BD greenfield: borrar sol v1, corregir `fecha_corte_antiguedad: 2000-12-31` | 5 (RRHH) |
| Smoke acreditación `acreditarLaoBolsaAgente` post-deploy | opcional |

---

## 8. Comandos útiles

```powershell
npm run dev:web
npm run build:web
firebase deploy --only hosting
firebase functions:list
```

---

## 9. Continuidad desde handoff anterior

- Wizard F3a completo (pasos 1–4): ver [`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md) (supersedido en motor por este doc para cableado RFC).
- Grupos involucrados: [`RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md`](./RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md).

---

*Sesión pausada a pedido del responsable — 2026-05-23.*
