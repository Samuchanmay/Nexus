-- "honorific" (Dr./Dra./Mtro./Mtra./Lic./Ing./etc.) se muestra AL LADO del
-- nombre; "title" pasa a ser siempre la descripción de rol/función que se
-- muestra DEBAJO del nombre (para todos: equipo, coordinadores, admin).
-- Antes ambos vivían en la misma columna "title", lo que mezclaba honoríficos
-- de coordinadores con funciones de equipo.
alter table public.users add column if not exists honorific text;

-- Migra los honoríficos ya guardados de los coordinadores (Dr./Dra./Mtro./Mtra.)
-- a la nueva columna y limpia "title" para que ellos (o el admin) puedan
-- llenarlo después con su rol real, ej. "Coordinador en Enfermería y Nutrición".
update public.users
set honorific = title, title = null
where role = 'coordinador' and title in ('Dr.', 'Dra.', 'Mtro.', 'Mtra.', 'Otro');
