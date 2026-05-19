# Plan — Ticketera slice 64-B (Patrón B, sin goce)

**Estado:** plan de trabajo post-cierre matriz **64-A** (2026-05-19)  
**Prerequisito:** [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md) cerrada · [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md)  
**Catálogo:** [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) § 64-B

---

## 1. Objetivo

Mismo flujo agente que **64-A** (listar → elegir fecha → enviar 1 día → trigger Patrón B → revisión jefe), para:

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` |
| `version_id` (piloto) | `ver_01KRYEX13QN7VBPMFQFES1QHB4` |
| Diferencia normativa | `es_sin_goce: true`, `justifica_sueldo_id: cfg_js_no` |
| Bolsa | `sal_{A}_per_*` — pestaña B check-in (misma que 64-A, bolsa distinta) |

**No** es nueva versión del 64-A: artículo **independiente** en configurador.

---

## 2. Alcance técnico (oleada única, ~1–2 días)

### Backend (mínimo)

1. Ampliar whitelist MVP en `listarArticulosIngresoAgente` (o sustituir por “todos los Patrón B publicados” con flag de entorno).
   - Hoy: solo `art_01KRNK10…` (64-A).
   - Objetivo: incluir `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ`.
2. **Sin cambio** de trigger `onSolicitudArticuloPatronBOnCreate` si `articulo_id` ya dispara motor genérico Patrón B (verificar en código).
3. Reglas Firestore: ya cubren `solicitudes_articulo` Patrón B; sin cambio salvo prueba.

### Web (mínimo)

1. Constante `ARTICULO_64B_ID` en `web/src/constants/solicitudesArticuloV2.js`.
2. **Opción A (recomendada):** generalizar pantalla `Solicitud64AAlta` → “Asuntos particulares” con **selector** si `articulos.length > 1` (64-A + 64-B), reutilizando `useSolicitud64AAlta` / callable listado.
3. **Opción B:** ruta duplicada `/portal/solicitudes/asuntos-particulares-sin-goce` + `articuloIngresoId` en menú (más ítems de menú).
4. Menú / Inicio: segundo `articuloIngresoId` en `MODULOS_PORTAL` o un solo ítem “Asuntos particulares” que abre pantalla multi-artículo (coherente con `ArticulosIngresoProvider`).
5. Copy UI: distinguir **con goce** vs **sin goce** (nombre versión / `es_sin_goce` en DTO listado si se expone).

### No incluido en slice 64-B

- Bandeja jefe (aprobación).
- Múltiples días por evento.
- 68-B (Patrón C distinto).

---

## 3. Matriz de pruebas (borrador)

Clonar filas T1–T8 de 64-A sustituyendo artículo y mensajes esperados iguales (mismo motor). Piloto: **28914247** (ADMIN + bolsa 64-B en check-in).

| # | Caso | Notas 64-B |
|---|------|------------|
| B1 | Alta OK 1 día | `sol_*` + bolsa `bol_art_01KRYEX0…` consumido |
| B2 | Agente sin escalafón | Igual 64-A / T2 |
| B5–B7 | Saldo ciclo / mes | Misma lógica Patrón B |
| BR1 | 64-A sigue OK | Regresión obligatoria |

Documento final sugerido: `TICKETERA_SLICE_64B_MATRIZ_PRUEBAS.md` (crear al empezar).

---

## 4. Orden de implementación

1. Backend: whitelist / listado incluye 64-B.
2. Web: listado muestra dos artículos si ambos pasan elegibilidad; envío con `articulo_id` correcto.
3. Piloto: una solicitud OK + verificar Firestore `sal_2026_per_*` bolsa 64-B.
4. Regresión: una 64-A más en otro mes o legajo (T7 ya cubierto en 64-A).
5. Deploy Functions + Hosting; doc matriz 64-B.

---

## 5. Comandos

```bash
node scripts/diagnostico-listar-64a.mjs --dni=28914247
# Tras ampliar callable, añadir script o flag --articulo=64B si hace falta
npm run firebase:deploy:functions
```

---

## 6. Referencias

- [`HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md`](./HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md) § 64-B opcional
- [`HANDOFF_SESION_2026-05-18_ARTICULOS_BASICOS_Y_CONTINUIDAD.md`](./HANDOFF_SESION_2026-05-18_ARTICULOS_BASICOS_Y_CONTINUIDAD.md) — Slice 2
