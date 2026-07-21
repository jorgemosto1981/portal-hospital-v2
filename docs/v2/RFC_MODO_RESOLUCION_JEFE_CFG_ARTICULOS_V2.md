# RFC — `modo_resolucion_jefe` en cfg_articulos (acto del jefe inmediato)

**Estado:** implementando en arenero (`feature/modo-resolucion-jefe-v2` / `develop`) · **2026-07-15**  
**Ámbito:** configuración de artículo → snapshot en `sol_*` → UI wizard agente + bandeja jefe.  
**Relacionado:** [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) (contrato MDC / TC de RRHH post-cierre — **otra** familia de “toma de conocimiento”).

---

## 1. Problema

El booleano `requiere_toma_conocimiento_superior` (burbujeo de acuse) **no** describe si el jefe inmediato **autoriza** o solo **toma conocimiento** del derecho legal (Art. 63 vs Art. 64). Cambiar solo el copy del wizard del agente barre el problema bajo la alfombra: la bandeja del jefe seguía exigiendo “Aprobar / Rechazar”.

---

## 2. Campo (versión de artículo)

En `bloque_workflow_sla_cobertura`:

| Campo | Tipo | Valores | Default |
|-------|------|---------|---------|
| `modo_resolucion_jefe` | enum string | `autorizacion` \| `toma_conocimiento` \| `ninguno` | `autorizacion` |

- **`autorizacion`:** UI jefe = Aprobar / Rechazar (p. ej. Art. 64). Payload puede incluir `modalidad_goce_jefe` (`con_goce` / `sin_goce`) para 64-A/B.
- **`toma_conocimiento`:** UI jefe = Conforme / Observado (p. ej. Art. 63). Alias callable → mismos estados AS-IS (`aprobar` / `rechazar`); se persiste `decision_jefe_ui`.
- **`ninguno`:** sin paso de jefe inmediato (reservado).

`requiere_toma_conocimiento_superior` / `toma_conocimiento_limitada` / `niveles_burbujeo` quedan para **acuse post-cierre** hacia superiores de servicio — no confundir.

---

## 3. Propagación

1. **ABM** configurador: FieldSelect en pestaña workflow.  
2. **Listado ingreso** (`listarArticulosIngreso*`): expone `modo_resolucion_jefe` desde la versión vigente.  
3. **Trigger Patrón B onCreate:** escribe `modo_resolucion_jefe` en el doc `sol_*` (snapshot inmutable del trámite).  
4. **Bandeja jefe:** lee el snapshot (fallback: código grilla `63*` → TC).  
5. **Wizard agente:** copy “Informar / Comunicar” si TC; “Solicitar” si autorización.

---

## 4. Seeds / datos

| Familia | `modo_resolucion_jefe` |
|---------|------------------------|
| Oleada 63 (builders) | `toma_conocimiento` |
| CAMBIO-DIA / 64 | `autorizacion` |

Versiones ya publicadas en Firestore **no** se actualizan solos: hace falta re-publicar / patch de versión o seed dirigido en-dev antes de UAT.

---

## 5. Fuera de este átomo

- Cruce de bolsas 64-A ↔ 64-B según `modalidad_goce_jefe` del jefe (siguiente motor).  
- Cambiar semántica de rechazo en TC (“Observado” hoy = `cfg_esa_rechazada` AS-IS).  
- Deploy a producción: solo con acta; primero-dev.
