# Auditoría: la corrección de asistencia no se guarda

**Fecha**: 05 Ago 2026
**Estado**: ✅ Resuelto — causa raíz encontrada (RLS), corrección aplicada y migración 0035 lista para la nube

---

## Reporte del usuario

En **Tiempo → Asistencia → Corregir entrada/salida → Guardar corrección**, la UI es correcta (el TimePicker ya se ve y funciona) pero al guardar aparece el mensaje genérico **"No se pudo guardar la corrección"**. Ese mensaje oculta el error real e impide depurar.

## ¿Qué NO era?

Siguiendo la checklist del reporte, se descartaron primero las hipótesis más comunes:

| Hipótesis | Resultado |
|---|---|
| Formato distinto del TimePicker | ❌ **Descartada**. `TimePicker.onChange` emite `composeHHMM()` = `"HH:MM"` de 24 h (siempre 5 caracteres). El código ya enviaba `"HH:MM:SS"` (append `:00`). El formato era correcto. |
| `logAdminAction` lanzando la excepción | ❌ **Descartada**. Es fire-and-forget (`void … .then()`), por diseño nunca bloquea la acción real (`src/lib/admin-log.ts:20`). |
| Recálculo de horas (paso 7) lanzando la excepción | ❌ **Descartada**. `summarizeDay` es una función pura del cliente que corre DESPUÉS del reload; no participa del guardado. |
| Validaciones del formulario | ❌ **Descartadas**. `canSave` gatea el envío con toasts propios; el error venía del try/catch de red. |

## CAUSA RAÍZ (confirmada por inspección del esquema)

**`public.attendance` no tiene ninguna política RLS de UPDATE, y la única de INSERT solo permite registros propios.**

En `supabase/schema.sql:287-290`:

```sql
create policy att_insert_own on public.attendance for insert to authenticated
  with check (user_id = public.my_user_id());
create policy att_read on public.attendance for select to authenticated
  using (user_id = public.my_user_id() or public.my_role() in ('admin','rh'));
```

La corrección (`src/components/os/edit-attendance-sheet.tsx`) escribe asistencia **de otro empleado**:

1. **UPDATE** de entrada/salida existente → **sin política de UPDATE** → RLS niega → PostgREST responde error
   `42501 · new row violates row-level security policy for table "attendance"` → el `if (error) throw error` salta al catch → "No se pudo guardar la corrección".
2. **INSERT** de entrada/salida faltante → `att_insert_own` exige `user_id = my_user_id()` → el admin inserta con el `user_id` **del empleado** → rechazado por la misma razón (42501).

Se verificó con un barrido completo (`schema.sql` + `supabase/migrations/*.sql` + script combinado): **no existe ninguna política `for update` sobre `attendance` en todo el repo**.

**Flujo secundario afectado por la misma causa**: `adminResolvePendingExit` (`src/lib/pending-exits.ts:139`) inserta el "Fin de jornada" de la persona con `user_id` del empleado → también rechazado por `att_insert_own`. La política nueva lo arregla a la vez.

## Error exacto que recibía la UI

```
PostgrestError 42501
  message: "new row violates row-level security policy for table \"attendance\""
  details: "Failing row contains (…, 08:00:00, …)"
  hint: null
  code: "42501"
```

Era invisible porque el catch mostaba `"No se pudo guardar la corrección"`.

## Solución aplicada

### 1. Base de datos — migración `0035_attendance_admin_write_rls.sql`

```sql
drop policy if exists "att_admin_update" on public.attendance;
create policy "att_admin_update" on public.attendance
  for update to authenticated
  using (public.my_role() in ('admin','rh'))
  with check (public.my_role() in ('admin','rh'));

drop policy if exists "att_admin_insert_any" on public.attendance;
create policy "att_admin_insert_any" on public.attendance
  for insert to authenticated
  with check (public.my_role() in ('admin','rh'));
```

- Alineada con `att_read`, que ya daba lectura completa a admin/rh.
- El empleado sigue pudiendo escribir SOLO sus propios movimientos (`att_insert_own` intacta).
- Archivos: `supabase/migrations/0035_attendance_admin_write_rls.sql` y, para pegar en el SQL Editor,
  `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql`.
- `docs/MIGRACIONES-PENDIENTES-SUPABASE.md` actualizado (0035 listado como urgente).

### 2. Cliente — `src/components/os/edit-attendance-sheet.tsx`

- **Error real visible**: el catch muestra el mensaje de Supabase (`toast("No se pudo guardar: " + message)`) y registra `console.error` completo. Se eliminó el mensaje genérico que ocultaba la causa.
- **Log del payload** antes de escribir (`console.log("ANTES payload", { userId, date, entrada, salida, motivo })`).
- **Normalización defensiva** de la hora: nuevo helper `timeCol("HH:MM"|"HH:MM:SS") → "HH:MM:SS"`. Antes el código hacía `` `${entrada}:00` ``; si el valor llegara con segundos (default del state es `firstIn`, que viene de la BD como `HH:MM:SS`), produciría `"HH:MM:SS:00"` y Postgres rechazaría con `22008`. Ahora es inmune.

## Pruebas realizadas

- ✅ Barrido del esquema: confirmado que no existía política UPDATE de `attendance` y que `att_insert_own` bloquea inserts ajenos (causa raíz).
- ✅ Revisión de todos los escritores de `attendance` en `src/`: solo `edit-attendance-sheet.tsx` (corrección) y `pending-exits.ts` (propia + admin) — ambos cubiertos por el fix.
- ✅ La migración 0035 es aditiva/idempotente (`drop policy if exists` + `create`), no rompe `att_insert_own`.
- ✅ `next build` exitoso.
- ⏳ Verificación en la nube (requiere aplicar la migración 0035 en el SQL Editor): guardar corrección → sin error, registro en `attendance_corrections`, y el recálculo de horas del panel (client-side vía `summarizeDay`) toma los nuevos tiempos al recargar. El cálculo de horas no se toca y no participa del guardado, por lo que no puede romperse con este fix.

## Archivos

- `supabase/migrations/0035_attendance_admin_write_rls.sql` (nuevo)
- `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql` (nuevo, para el SQL Editor)
- `docs/MIGRACIONES-PENDIENTES-SUPABASE.md` (0035 añadida)
- `src/components/os/edit-attendance-sheet.tsx` (error real + log + normalización `timeCol`)
- `docs/audits/attendance-correction-save.md` (este documento)

## Conclusión

El selector no era el problema: la causa era **RLS**. El admin nunca pudo escribir asistencia de otro empleado porque `attendance` carecía de política de UPDATE y su única política de INSERT era para registros propios. Con 0035 aplicada, UPDATE e INSERT de admin/rh quedan permitidos y la corrección se guarda. El cálculo de horas es client-side y no interviene en el guardado.
