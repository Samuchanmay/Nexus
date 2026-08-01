-- El campo "title" se usa en toda la app como "Cargo" (texto libre, ej.
-- "Coordinador de Video"), pero tenía un CHECK heredado que solo permitía
-- títulos académicos (Dr./Dra./Mtro./Mtra./Otro). Cualquier admin que
-- escribiera un cargo real en Editar Empleado o Agregar Personal recibía
-- "No se pudo actualizar" sin explicación — el INSERT/UPDATE violaba el
-- constraint silenciosamente para el usuario.
alter table public.users drop constraint if exists users_title_check;
