# Smoke — Hosting C2c + C2d (calendario licencias unificado)

**Estado:** **OK en prod** · evidencia 2026-05-21 (Oficina PERSONAL, 4 personas, `64-A` día 21).  
**URL:** https://portal-hospital-v2.web.app  
**Ruta:** Portal → Grilla operativa → pestaña **Calendario licencias (MDC)**

## Checklist

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| 1 | **TITULAR** | Vista *Titular (mi caso)* · mes **2026-03** · Cargar | Calendario tipo rejilla; día **21** con `64-A` si hay `vis_*` piloto | ✅ |
| 2 | **EQUIPO** | Vista *Equipo (mi grupo)* · mismo mes · grupo del resolver · Cargar | Select de grupo poblado (sin `undefined`); tabla con ≥1 fila | ✅ (4 filas, Oficina PERSONAL) |
| 3 | **Período persistente** | Cargar en TITULAR → cambiar a EQUIPO sin tocar mes | El `input type=month` conserva **2026-03** (o el elegido) | ✅ (validación manual) |
| 4 | **Detalle C3** | Clic celda con licencia | Modal + nombres jefe/RRHH + enlace bandeja | ✅ (flujo C3 previo) |
| 5 | **RRHH SECTOR** (si aplica) | Perfil RRHH · *Sector* · elegir `gdt_*` · Cargar | Tabla multipersona sin error de permisos | ⏳ pendiente perfil RRHH |

## Notas deploy

- Primera subida del día pudo ir con `dist` viejo; **rebuild + redeploy** obligatorio tras C2d.
- **EQUIPO `internal`:** Firestore `getAll` admite máx. **10** refs por llamada; fix en `grillaMesAgenteCore` (chunks) + deploy `listarVistaGrillaMesPorGrupo`.

---

*2026-05-21*
