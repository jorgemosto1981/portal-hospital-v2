# Handoff — 2026-07-14 Cierre deploy Soft Launch Etapa 1

**Estado:** **PAUSA formal** · Vía A (cupo usuarios) técnica **cerrada y en prod** · pelota en RRHH/Negocio  
**Commit:** `6dee722`  
**Ramas:** `master` = `develop` = `origin/*` @ `6dee722`  
**Prod:** https://portal-hospital-v2.web.app · proyecto `portal-hospital-v2`  
**Guía viva:** [`GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md`](./GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md)

Relacionados: [`HANDOFF_SESION_2026-07-14_SOFT_LAUNCH_UX_RULES_CALENDARIO.md`](./HANDOFF_SESION_2026-07-14_SOFT_LAUNCH_UX_RULES_CALENDARIO.md) (detalle técnico de la oleada) · [`CHECKLIST_UAT_ETAPA1_V2.md`](./CHECKLIST_UAT_ETAPA1_V2.md) · [`ETAPA1_FIREBASE_DEV_SETUP_V2.md`](./ETAPA1_FIREBASE_DEV_SETUP_V2.md)

---

## 1. Hito alcanzado (estado técnico)

| Pieza | Estado |
|-------|--------|
| Soft Launch UX (acuse rechazo, CAMBIO-DIA, calendario consulta, candados hub) | **Desplegado** hosting prod |
| Functions | `registrarAcuseRechazoAgente` + `obtenerContextoAcuseRechazoAgente` en `southamerica-east1` |
| Rules CAMBIO-DIA (≤1000 exprs) | Ya en prod (sesión previa del mismo día) |
| Git | `master`/`develop` alineados y pusheados |
| Working tree | Solo `scripts/_tmp-*` untracked (fuera de versión) |
| Vía A — cupo usuarios | Desarrollo técnico Etapa 1 inicial **CERRADO**; espera negocio |

---

## 2. Bloqueos actuales (pelota RRHH / Negocio)

Pausa de features en `master` hasta:

1. Checklist UAT Soft Launch **en vivo** (web `.web.app`, hard refresh).  
2. Altas restantes: nómina GDT piloto 5–10, jerarquías jefes, check-in saldos 64-A/B.  
3. Veredicto **Go/No-Go** oleada ~70–80 ([Acta](./ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md) §3.1).

GDT piloto: `gdt_01KX107ZZTPKF12A1ED2XVKNMM`.

---

## 3. Retoma técnica — Vía B

**Actualizado:** setup-dev **hecho** en la misma fecha (tarde). Detalle y pendientes (commit wire + smoke Vite):  
[`HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md`](./HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md).

---

## 4. Smoke post-deploy (recordatorio)

Hard refresh en https://portal-hospital-v2.web.app → login Soft Launch → acuse si aplica → hub sin LAO/LM → CAMBIO-DIA → Mis solicitudes → Calendario institucional.

---

**Pausa formal · 2026-07-14 (mañana)** — Vía A en prod. Continuación misma fecha: ver handoff Vía B.
