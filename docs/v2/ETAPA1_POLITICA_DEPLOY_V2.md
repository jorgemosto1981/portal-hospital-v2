# Política de despliegue — Etapa 1 V2

**Estado:** borrador para aceptación · **Alcance:** proteger el go-live Etapa 1 (~70–80 usuarios) mientras continúa el desarrollo del resto de V2.  
**Gate de aceptación funcional:** [`CHECKLIST_UAT_ETAPA1_V2`](#acta-aceptada--checklist-uat-etapa-1-v2) (Go/No-Go Soft Launch).

## 1. Entornos

| Entorno | Proyecto Firebase | URL típica | Uso |
|---------|-------------------|------------|-----|
| **Prod piloto Etapa 1** | `portal-hospital-v2` | https://portal-hospital-v2.web.app | Usuarios reales allowlist; solo releases Etapa 1 estables |
| **Dev / staging técnico** | `portal-hospital-v2-dev` | Hosting del proyecto-dev | Features en curso (LAO, médicas, GSO jefes, 1919, experimentos) |

- Mismo código de repo; distinto `.firebaserc` / `.env` (`VITE_V2_*`).  
- **Prohibido** apuntar `dev:web` habitual de features no-Etapa1 a prod piloto.  
- **Hasta que exista `portal-hospital-v2-dev`:** moratoria — en `portal-hospital-v2` solo fixes Etapa 1 y releases ya acotados.

## 2. Superficie congelada en prod piloto

En **prod piloto** no se habilita a usuarios:

- LAO / wizards Patrón A de producto completo  
- Licencias médicas / bandeja auditor / junta  
- **GSO / creación de turnos para rol jefe** (GSO solo RRHH + perfiles técnicos)  
- Artículos fuera del catálogo Etapa 1 (64-A, 64-B, 63.j, CAMBIO-DIA)

Todo lo anterior se desarrolla y prueba en **dev**.

## 3. Gate obligatorio antes de deploy a prod piloto

Ningún `firebase deploy` (hosting y/o functions y/o rules) a `portal-hospital-v2` sin:

1. Diff revisado: no abre superficies de §2 a roles prohibidos.  
2. **Checklist UAT Etapa 1 en verde** en entorno de prueba alineado, **o** smoke firmado del subset acordado (mínimo: login allowlist + alta 64 + aprobación jefe + TC RRHH + un Cambio de día happy path).  
3. Registro breve de release (ver §5).

Excepción: hotfix de seguridad/disponibilidad con aprobación explícita (tech lead) y smoke mínimo post-deploy en ≤15 min.

## 4. Qué se puede desplegar a prod piloto

**Permitido**

- Fixes de bugs Etapa 1 (auth, ticketera 64/63.j/CAMBIO-DIA, bandejas jefe/RRHH, allowlist/filtro catálogo).  
- Mejoras de copy/UX dentro de superficies permitidas.  
- Seeds/ops de datos del piloto (altas, check-in) bajo procedimiento RRHH — no “feature dump”.

**Prohibido (solo-dev)**

- Abrir menú GSO a jefes.  
- Publicar arts. LAO/médicas en catálogo visible Etapa 1.  
- Resets masivos / seeds experimentales sobre datos de usuarios reales.  
- Cambios de rules que aflojen acceso fuera de allowlist.

## 5. Quién autoriza y cómo se registra

| Rol | Responsabilidad |
|-----|-----------------|
| Tech lead / responsable deploy | Ejecuta deploy; adjunta commit SHA + proyectos afectados |
| Producto / RRHH piloto | Firma Go/No-Go UAT o smoke |
| Ambos | Confirman que §2 sigue intacto |

**Registro mínimo (tabla o acta):** fecha · commit · componentes (hosting/functions/firestore) · UAT/smoke link o checklist tildado · autorizantes · notas rollback.

## 6. Rollback

1. Hosting: volver a release anterior de Firebase Hosting.  
2. Functions: redeploy del commit anterior estable Etapa 1.  
3. Datos: **no** borrar solicitudes reales salvo incidente acordado; preferir feature off (allowlist / despublicar art.) + remediación RRHH.  
4. Comunicar a canal de soporte del piloto.

## 7. Relación con Soft Launch y oleadas

- Soft launch (5–10 usuarios): requiere Go/No-Go UAT § completo.  
- Oleada hasta ~70–80: misma política de deploy; no relajar §2.  
- Apertura futura de GSO a jefes = **nueva etapa**/acta UAT distinta, no un deploy “de pasada”.

## 8. Checklist rápida pre-deploy (prod piloto)

- [ ] Branch/commit identificados  
- [ ] Diff no viola superficie §2  
- [ ] UAT o smoke Etapa 1 firmado  
- [ ] Backup/export reciente si el cambio toca datos masivos  
- [ ] Plan de rollback §6 conocido  
- [ ] Autorizantes §5 OK  

---


---

---

**Estado:** aceptado · 2026-07-08
