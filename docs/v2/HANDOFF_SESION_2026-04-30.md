# Handoff de sesión — 2026-04-30

## Cierre de esta sesión

- Se completó el rediseño del **Paso 2 (DDJJ grupo familiar)** en onboarding:
  - flujo inicial resumido (hacer ahora / hacer después),
  - edición de integrantes,
  - cierre y revisión previa,
  - presentación final con declaración jurada,
  - botón quitar integrante en resumen.
- Se incorporó validación condicional para parentesco **Otros** por id canónico:
  - `CFG_PAR_OTROS` (sin depender de texto de etiqueta).
- Se reforzó la validación de campos:
  - nombre/apellido (texto),
  - DNI (numérico),
  - domicilio si no convive,
  - detalle si dependiente,
  - detalle obligatorio para `CFG_PAR_OTROS`.
- Al presentar DDJJ se registra evento para bandeja RRHH:
  - `tipo_evento_id: EVT_DATOS_NOTIF_CAMBIO_DDJJ`
  - `estado_bandeja_rrhh: pendiente_revision`
  - `payload.accion: presentar_ddjj_grupo_familiar`.

## Estado del caso usuario DNI 1234567

- Mantener como caso de seguimiento de login y onboarding.
- En limpieza de datos test queda **excluido** explícitamente de cualquier borrado automático.

## Limpieza de usuarios test (BD)

- Se agregó script seguro:
  - `scripts/cleanup-usuarios-test.mjs`
- Comando:
  - `npm run db:cleanup-usuarios-test` (dry-run)
  - `npm run db:cleanup-usuarios-test -- --apply` (aplica)
- Criterio:
  - detecta tokens de test en datos de persona/cuenta (`test`, `prueba`, `demo`, `qa`, `fake`, `tmp`, `zzz`),
  - excluye DNI protegido `1234567`.

## Próxima sesión — continuidad pedida

1. Corroborar funcionamiento end-to-end:
   - login,
   - onboarding,
   - pantallas `DatosPersonales` y `DatosLaborales`,
   - visibilidad y accesos por rol (`rrhh` vs usuario).
2. Revisar visualización de datos y guardas de ruta.
3. Confirmar estado de bandeja RRHH para eventos de DDJJ.
4. Continuar depuración de registros reales, evitando datasets de prueba.

## Nota técnica rápida sobre tamaño/alcance de archivos de login

- `web/src/features/auth/RegistroVinculacion.jsx`: flujo unificado de registro + vínculo.
- `web/src/features/auth/VinculacionDni.jsx`: uso excepcional de recuperación.
- `web/src/features/auth/LoginScreen.jsx`: acceso regular con DNI/PIN.
- Recomendación próxima: extraer lógica de validación y mensajes a utilidades compartidas para reducir acoplamiento entre pantallas.
