"use client";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnlaceAttachment, EnlaceMessage } from "@/lib/types";

const BUCKET = "chat-files";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type AttachmentUploadStatus = "idle" | "uploading" | "done" | "error";

type UploadResult = { message: EnlaceMessage; attachment: EnlaceAttachment };

/**
 * Toda la lógica de subir un adjunto, aislada de la UI — antes vivía
 * completa dentro de `onFileSelected` en el componente de la conversación.
 * El componente solo llama `upload(file)` y lee `status`/`progress`.
 *
 * Nota honesta sobre `progress`: el cliente de Storage de Supabase no
 * expone progreso real por bytes en `upload()` (usa fetch, no XHR). Lo que
 * se reporta aquí son hitos de la tubería (subida de archivo → mensaje →
 * adjunto), no bytes transferidos — es la información real disponible,
 * no una barra simulada con setInterval.
 */
export function useAttachmentUpload(conversationId: string, myId: string) {
  const [status, setStatus] = useState<AttachmentUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    lastFileRef.current = file;
    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setStatus("error");
      setError(`"${file.name}" pesa más de 25 MB — no se puede adjuntar.`);
      return null;
    }

    setStatus("uploading");
    setProgress(10);

    const supabase = createClient();
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
    const mime = file.type || "application/octet-stream";

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime });
    if (upErr) {
      setStatus("error");
      setError("No se pudo subir el archivo. Intenta de nuevo.");
      return null;
    }
    setProgress(60);

    const { data: msgRow, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: myId,
        type: mime.startsWith("image/") ? "image" : "file",
        content: file.name,
      })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id")
      .single();
    if (msgErr || !msgRow) {
      setStatus("error");
      setError("No se pudo enviar el archivo. Intenta de nuevo.");
      return null;
    }
    setProgress(85);

    const { data: attRow, error: attErr } = await supabase
      .from("message_attachments")
      .insert({ message_id: msgRow.id, file_name: file.name, file_path: path, file_size: file.size, mime_type: mime })
      .select("id, message_id, file_name, file_path, file_size, mime_type, created_at")
      .single();
    if (attErr) {
      setStatus("error");
      setError("El archivo se envió pero no se pudo vincular. Intenta de nuevo.");
      return null;
    }

    setProgress(100);
    setStatus("done");
    return { message: msgRow as EnlaceMessage, attachment: attRow as EnlaceAttachment };
  }, [conversationId, myId]);

  const retry = useCallback(() => {
    if (lastFileRef.current) return upload(lastFileRef.current);
    return Promise.resolve(null);
  }, [upload]);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    lastFileRef.current = null;
  }, []);

  return { status, progress, error, upload, retry, reset };
}
