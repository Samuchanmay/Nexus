"use client";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnlaceAttachment, EnlaceMessage } from "@/lib/types";
import { triggerChatPush } from "./push";

const BUCKET = "chat-files";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type AttachmentUploadStatus = "idle" | "uploading" | "done" | "error";

type UploadResult = { message: EnlaceMessage; attachment: EnlaceAttachment };

/**
 * Toda la lógica de subir un adjunto, aislada de la UI — antes vivía
 * completa dentro de `onFileSelected` en el componente de la conversación.
 * El componente solo llama `upload(file)` y lee `status`/`progress`.
 *
 * Imágenes (pipeline thumb/medium/original):
 *   · Se redimensionan en un Web Worker (image-resize.worker.ts) a WebP en
 *     dos variantes — thumb (≤384px) y medium (≤1280px) — y se suben los
 *     tres objetos. `file_path` guarda el original; `thumb_path`/`medium_path`
 *     apuntan a las variantes para que el render cargue primero la miniatura
 *     y use medium como vista (el original solo se descarga al hacer clic).
 *   · Si el worker no está disponible, se cae limpio a subir solo el
 *     original (mismo comportamiento que antes de este pipeline).
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
    const isImage = mime.startsWith("image/");

    // Pipeline de imagen: variantes WebP en worker → subida best-effort.
    let thumbPath: string | null = null;
    let thumbSize: number | null = null;
    let mediumPath: string | null = null;
    let mediumSize: number | null = null;
    if (isImage) {
      setProgress(15);
      const resized = await resizeImagesInWorker(file);
      if (resized) {
        const store = supabase.storage.from(BUCKET);
        const uploadVariant = async (
          blob: Blob,
        ): Promise<{ path: string; size: number } | null> => {
          const p = `${conversationId}/${crypto.randomUUID()}.webp`;
          const { error } = await store.upload(p, blob, { contentType: "image/webp" });
          return error ? null : { path: p, size: blob.size };
        };
        const [t, m] = await Promise.all([
          resized.thumb ? uploadVariant(resized.thumb) : Promise.resolve(null),
          resized.medium ? uploadVariant(resized.medium) : Promise.resolve(null),
        ]);
        thumbPath = t?.path ?? null;
        thumbSize = t?.size ?? null;
        mediumPath = m?.path ?? null;
        mediumSize = m?.size ?? null;
      }
    }
    setProgress(35);

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
        type: isImage ? "image" : "file",
        content: file.name,
      })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng")
      .single();
    if (msgErr || !msgRow) {
      setStatus("error");
      setError("No se pudo enviar el archivo. Intenta de nuevo.");
      return null;
    }
    // Push a receptores con la app cerrada (FASE 2) — best-effort.
    void triggerChatPush(msgRow.id);
    setProgress(85);

    const { data: attRow, error: attErr } = await supabase
      .from("message_attachments")
      .insert({
        message_id: msgRow.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: mime,
        thumb_path: thumbPath,
        thumb_size: thumbSize,
        thumb_mime: thumbPath ? "image/webp" : null,
        medium_path: mediumPath,
        medium_size: mediumSize,
        medium_mime: mediumPath ? "image/webp" : null,
      })
      .select("id, message_id, file_name, file_path, file_size, mime_type, created_at, thumb_path, thumb_size, thumb_mime, medium_path, medium_size, medium_mime")
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

/** Redimensiona una imagen en el worker; null si no fue posible. */
function resizeImagesInWorker(file: File): Promise<{ thumb: Blob | null; medium: Blob | null } | null> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    const done = (r: { thumb: Blob | null; medium: Blob | null } | null) => {
      if (timer) clearTimeout(timer);
      worker?.terminate();
      resolve(r);
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      worker = new Worker(new URL("./image-resize.worker.ts", import.meta.url), { type: "module" });
      timer = setTimeout(() => done(null), 20000);
      worker.onmessage = (e: MessageEvent) => {
        const data = e.data as { thumb: ArrayBuffer | null; medium: ArrayBuffer | null };
        done({
          thumb: data.thumb ? new Blob([data.thumb], { type: "image/webp" }) : null,
          medium: data.medium ? new Blob([data.medium], { type: "image/webp" }) : null,
        });
      };
      worker.onerror = () => done(null);
      void file.arrayBuffer().then((buffer) => worker?.postMessage({ id: crypto.randomUUID(), buffer, mime: file.type }, [buffer]));
    } catch {
      done(null);
    }
  });
}
