# Evidencia — LAO wizard F3a.1 paso 1 (disponibilidad) · 2026-05-22

**Rama:** `feature/ticketera-puente-campos-config`  
**RFC:** [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md) §3  
**Handoff:** [`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md)

---

## Alcance verificado

| Ítem | Estado |
|------|--------|
| Callable `obtenerContextoBolsaLaoAgente` desplegado (southamerica-east1) | OK |
| Hub → `/portal/solicitudes/lao?fecha=&articulo_id=` | OK |
| Paso 1: **Iniciar solicitud** + listado **Disponibles:** | OK (UX sesión tarde) |
| Tests unitarios core FIFO | `node --test functions/test/obtenerContextoBolsaLaoCore.test.js` |

---

## Smoke manual (checklist)

- [ ] Sesión agente con `persona_id` en claims (o RRHH con mismo).
- [ ] Solicitudes → LAO → carga sin error `persona_id`.
- [ ] Bloque Disponibles muestra bolsas con Total / Disponibles.
- [ ] Año calendario = fecha query: línea `Disponibles = proporcional` (sin número inventado).
- [ ] FIFO: si hay saldo año anterior, mensaje y botón deshabilitado hasta consumir ese año.
- [ ] **Iniciar solicitud** avanza a paso 2 placeholder (F3a.2).

---

## Pendiente (no es falla de paso 1)

- Paso 2 rango + `resumen_computo`.
- Paso 3 `simularLaoPreview` en wizard.
- Paso 4 alta borrador.
