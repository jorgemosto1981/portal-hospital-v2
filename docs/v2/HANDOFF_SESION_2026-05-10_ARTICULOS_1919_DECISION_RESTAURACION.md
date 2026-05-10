# Handoff de sesión — Implementación plan artículos 1919 y decisión pendiente

**Fecha:** 10 de mayo de 2026.  
**Rama de trabajo:** `feature/articulos-motor-plazos`.  
**Remoto:** `origin` → `https://github.com/jorgemosto1981/portal-hospital-v2.git`.

---

## 1. Registro de la sesión (estado de satisfacción)

**El plan adjunto** («bajar a tierra elegibilidad, cadencia, evidencia, incompatibilidad y workflow — 1919 / gestión hospitalaria») **fue implementado en código**, pero el resultado **no es considerado satisfactorio** por el equipo / responsable del producto.

**Motivos declarados (resumen):**

- Hay **demasiadas fallas** (calidad, coherencia de modelo, fricción operativa o bugs en la práctica — detalle a cerrar en la próxima reunión).
- El modelo resultante presenta **superposiciones y tensiones** entre campos/colecciones (evaluación previa en chat: unidades temporales duplicadas, workflow duplicado lista vs booleanos, vínculo laboral vs situación de revista, políticas de interrupción vs incompatibilidad, etc.), lo que encarece operación y futuro mantenimiento.

Este documento **no juzga el código línea a línea**: deja constancia del **criterio producto** para la siguiente sesión.

---

## 2. Opción explícita: restaurar backup y volver al código anterior

Queda **registrada la posibilidad** de:

1. **Restaurar un backup** que el responsable tenga del proyecto y/o del entorno (fecha anterior a esta implementación).
2. **Revertir el repositorio** al estado **anterior al merge/commit masivo** de la implementación 1919 (estrategia concreta: `git revert`, `git reset` a un SHA conocido, o nueva rama desde un punto estable — **a definir** con cuidado si ya hay push compartido).

**Importante:** La decisión **restaurar vs mantener y corregir** **no está tomada** en esta fecha; se pospone para trabajar **desde otro equipo** y definir con calma.

---

## 3. Punto de control en Git (para trabajar mañana desde otra PC)

Para poder comparar, revertir o continuar desde cualquier máquina:

1. Hacer **`git fetch`** y **`git pull`** en la rama `feature/articulos-motor-plazos` después del push asociado a este handoff.
2. El **mensaje de commit** del checkpoint incluirá referencia a este archivo para ubicar el estado en el historial.
3. Anotar aquí el **hash del commit** una vez hecho el push (completar manualmente si hace falta):

   - **Commit checkpoint post-handoff:** _(completar tras `git log -1` en la rama)_.

---

## 4. Referencias de diseño tocadas por la implementación (inventario alto nivel)

Sin listar cada archivo: RFC `RFC_CFG_ARTICULOS_PARAMETROS_1919_V2.md`, extensiones en `web/src/schemas/articulo.schema.js`, seeds bajo `scripts/seed-v2/`, callable `validarReglasArticuloV2` en `functions/modules/rrhh.js`, UI de configuración de artículos (pestaña Cadencia, subsecciones Elegibilidad/Plazos/Workflow), catálogos nuevos (`cfg_situacion_revista`, `cfg_unidad_intervalo_tiempo`, ampliaciones en acción vencimiento y política superposición), diccionario `DICCIONARIO_CFG_ARTICULOS_V2.md`.

---

## 5. Próximos pasos sugeridos (mañana / otra PC)

1. Leer este handoff y la evaluación de solapes (sesión previa en Cursor).
2. Decidir: **corregir incrementalmente**, **revertir rango de commits**, o **restaurar backup** + alinear remoto.
3. Si se restaura backup: volver a ejecutar solo los cambios que se quieran conservar, con RFC acotado.

---

**Firma del registro:** sesión 2026-05-10, portal-hospital-v2, implementación plan 1919 — **insatisfactoria** — decisión de restauración **pendiente**.
