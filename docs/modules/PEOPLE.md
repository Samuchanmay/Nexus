# Módulo · Personas

Rutas: hub "Personas" — `Lista` · `Carga` · Roles: admin, rh, departamento, coordinador (limitado a su equipo).

## Qué es

Directorio y administración de **colaboradores**: alta, roles, áreas, especialidades, contacto y saldos. Es la fuente de identidad que alimenta a todos los demás módulos (fichaje, chat, solicitudes, reportes).

## Vistas

### Lista
- Directorio en tarjetas (avatar con `nexus_color`, nombre, rol como píldora, área).
- Detalle de persona: datos de contacto, especialidades, saldo de vacaciones, historial de incidencias y accesos.
- Edición de perfil (formulario de `docs/design/FORMS.md`).

### Carga
- Alta de empleados: nombre, correo, rol (`admin`/`empleado`/`coordinador`/`departamento`/`rh`), área, especialidades, color de avatar, saldo inicial de vacaciones y fecha de ingreso.
- La cuenta se crea con invitación/login MFA (ver `modules/ONBOARDING.md`).

## Modelo de datos (resumen)

- `personas` (tabla de empleados: `persona_id`, `nombre`, `rol`, `area`, `especialidades`, `nexus_clave`/`nexus_color`, `telefono`, `email`).
- `accesos`/`usuarios` — credenciales y sesión (`@supabase/ssr`).
- `especialidades` — catálogo de especialidades asignables.
- `saldo_vacaciones` por persona (ver `modules/TIME.md`).

## Reglas

1. El color de avatar (`nexus_color`) es identidad personal y aparece en fichas, chat y calendario.
2. El rol define el alcance (RLS): nadie ve datos fuera de su jerarquía (admin y rh ven todo; coordinador su equipo; empleado solo su perfil y datos públicos del equipo).
3. La baja de una persona no elimina su historial (asistencia, solicitudes, mensajes): se desactiva la cuenta, se conservan los datos.
4. Correo institucional `@cert.edu.mx` en el alta; el dominio de correo de la app es `nexus@cert.edu.mx` (pendiente de hacer configurable, ver `DECISIONES-PENDIENTES.md` P-006).

## Ver también

- `docs/architecture/PERMISSIONS.md` — matriz RLS por rol
- `docs/modules/ONBOARDING.md` — alta + MFA
- `docs/modules/SETTINGS.md` — configuración global
