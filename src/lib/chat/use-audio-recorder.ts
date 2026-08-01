"use client";
/**
 * Grabadora de notas de audio (FASE 3) — envuelve MediaRecorder en un hook
 * pequeño para que la conversación solo maneje estados (recording/seconds)
 * y un callback `onDone(file)` que recibe el archivo ya listo para subir.
 *
 * El flujo es explícito, no press-and-hold (que requiere touch+gestos y no
 * funciona igual en escritorio): tocar el 🎤 inicia la grabación, y la
 * franja que aparece tiene su propio botón de enviar y de cancelar.
 *
 * Formato: webm/opus cuando el navegador lo soporta (Chrome/Edge/Firefox)
 * — el reproductor HTML5 lo reproduce sin transcodificar.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioRecorder(onDone: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSeconds(0);
  };

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;
      streamRef.current = stream;
      mediaRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        stopTracks();
        clearTimer();
        setRecording(false);
        if (!cancelledRef.current && blob.size > 0) {
          const file = new File([blob], "Nota de audio.webm", { type: blob.type || "audio/webm" });
          onDoneRef.current(file);
        }
      };

      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
      setRecording(false);
    }
  }, []);

  /** Detener y entregar la nota (si hay audio grabado). */
  const stop = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
  }, []);

  /** Descartar la grabación en curso sin generar archivo. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    else { stopTracks(); clearTimer(); setRecording(false); }
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        cancelledRef.current = true;
        mediaRef.current.stop();
      } else {
        stopTracks();
      }
    };
  }, []);

  return { recording, seconds, error, start, stop, cancel };
}
