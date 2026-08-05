// ══════════════════════════════════════════════════════════
//  EMET · Extractor único de mensaje de error para mostrar al usuario.
//
//  Causa raíz del bug "No se pudo guardar: [object Object]" (reportado
//  5 ago 2026): supabase-js lanza errores de Postgrest/RLS como objetos
//  planos `{ message, code, details, hint }` que NO son instancias de
//  `Error`. El patrón `err instanceof Error ? err.message : String(err)`
//  —usado en varios catch blocks— cae al `String(err)` para esos casos,
//  y `String({...})` da literalmente "[object Object]".
//
//  getErrorMessage() es el ÚNICO lugar que debe decidir cómo convertir
//  un `unknown` de un catch en texto para el usuario. Ningún catch block
//  en la app debe volver a escribir su propio `instanceof Error ? ... :
//  String(...)` — todos deben llamar a este helper.
// ══════════════════════════════════════════════════════════

/** Forma de un error de Postgrest/Supabase (RLS, constraint, FK, etc.) —
    no es una clase, es un objeto plano devuelto por supabase-js. */
interface PostgrestLikeError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

function isPostgrestLikeError(x: unknown): x is PostgrestLikeError {
  return !!x && typeof x === "object" && "message" in x
    && typeof (x as { message: unknown }).message === "string"
    && (x as { message: string }).message.length > 0;
}

/**
 * Convierte cualquier valor capturado en un catch (Error real, error de
 * Postgrest/Supabase, string, o cualquier otra cosa) en un mensaje de
 * texto seguro para mostrar al usuario. Nunca devuelve "[object Object]"
 * ni expone JSON crudo — si no puede extraer un mensaje real, cae al
 * `fallback`.
 */
export function getErrorMessage(err: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (err instanceof Error) return err.message || fallback;
  if (isPostgrestLikeError(err)) return err.message;
  if (typeof err === "string" && err.trim().length > 0) return err;
  return fallback;
}
