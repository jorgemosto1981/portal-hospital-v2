# Handoff sesión 2026-05-05

## Resumen
- Se consolidó el flujo DDJJ (perfil + onboarding) con servicio compartido backend.
- Se rediseñó UX DDJJ en datos personales (solapas, revisión, presentación final y consentimiento unificado).
- Se creó perfil resumido de rol usuario con notificación auditada a bandeja RRHH.
- Se movió contenido técnico de inicio a nueva pantalla RRHH `Sistemas web`.
- Se mejoró bandeja RRHH de notificaciones (filtros por estado/acción/fechas y buscador).
- Se incorporó fecha y hora en visualización de eventos (`DD-MM-AAAA HH:mm`).

## Cambios funcionales principales
- `Datos personales`:
  - Selector de persona con formato legible (nombre/apellido/dni + id complementaria).
  - Botón de actualización restituido para DDJJ.
  - Ajustes visuales de labels (nombre + id en cursiva en vistas RRHH).
- `Perfil Usuario`:
  - Vista resumida con campos de solo lectura y modificables.
  - Confirmación obligatoria para notificar actualización.
  - Alertas legales por cambios de estado civil y domicilio.
  - Módulo `Seguridad de la cuenta`:
    - cambio de correo con reautenticación + verificación;
    - cambio de contraseña con reautenticación;
    - notificación automática a bandeja RRHH.
- `RRHH Notificaciones`:
  - Filtros Pendientes/Vistos/Todos.
  - Filtro por acción.
  - Rango de fechas desde/hasta.
  - Buscador por nombre/apellido/dni/persona_id/evento_id.

## Backend / auditoría
- Se incorporó acción de evento específica para perfil usuario:
  - `notificar_actualizacion_perfil_usuario`.
- Se agregaron callables para seguridad auth:
  - `notificarCambioEmailAuth`
  - `notificarCambioPasswordAuth`
- Ambos generan evento auditable con estado de bandeja:
  - `estado_bandeja_rrhh_id = cfg_ebr_pend_rev`.

## Seeds
- Se agregaron tipos de evento en `cfg_tipo_evento`:
  - `cfg_tev_auth_email_cambio_solicitado`
  - `cfg_tev_auth_email_cambio_confirmado`
  - `cfg_tev_auth_password_cambio`

## Pendientes sugeridos (siguiente sesión)
- Aplicar seed de catálogos para asegurar disponibilidad de los nuevos `cfg_tev_auth_*`.
- Verificar flujo de confirmación de email en entorno real (paso confirmado con evento correspondiente).
- Evaluar pantalla RRHH dedicada para eventos de autenticación (opcional, separada de datos personales).

