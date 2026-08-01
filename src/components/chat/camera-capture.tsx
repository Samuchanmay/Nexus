"use client";
/**
 * Captura de cámara (FASE cierre) — fotografía en vivo vía getUserMedia,
 * sin archivo previo: la foto se saca del stream con un canvas y se manda
 * por la tubería de adjuntos existente (useAttachmentUpload → image).
 *
 * · Permisos: getUserMedia pide el permiso al abrir; si se deniega o no
 *   hay cámara, se muestra el error dentro de la hoja (nunca un throw).
 * · Requiere contexto seguro (https o localhost) — en la PWA de Nexus se
 *   cumple; en un entorno de prueba http://LAN hay que usar la app con
 *   https para que el navegador permita el stream.
 * · El stream se libera (stop de tracks) al cerrar o desmontar.
 */
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { Sheet } from "@/components/ui";

type CaptureState = "starting" | "live" | "denied" | "unavailable" | "error";

export function CameraCapture({ open, onClose, onCapture }: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CaptureState>("starting");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [busy, setBusy] = useState(false);

  const stopStream = () => {
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const start = async (mode: "user" | "environment") => {
    stopStream();
    setState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 } },
        audio: false,
      });
      if (!open) { for (const t of stream.getTracks()) t.stop(); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState("live");
    } catch (err) {
      const e = err as { name?: string };
      setState(e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError" ? "denied"
        : e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError" ? "unavailable"
        : "error");
    }
  };

  useEffect(() => {
    if (open) { void start(facing); }
    else stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => stopStream(), []);

  const toggleFacing = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    void start(next);
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || state !== "live" || busy) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) { setState("error"); return; }
        stopStream();
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const retry = () => void start(facing);

  return (
    <Sheet open={open} onClose={onClose} title="Cámara">
      <div className="rounded-[14px] overflow-hidden border border-border mb-3" style={{ background: "#000" }}>
        {state === "live" ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[46vh] object-cover" />
        ) : (
          <div className="w-full h-[220px] grid place-items-center text-center px-6">
            <div>
              <p className="text-[30px] mb-1" aria-hidden>📷</p>
              <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                {state === "starting" ? "Encendiendo la cámara…"
                  : state === "denied" ? "Permiso de cámara denegado."
                  : state === "unavailable" ? "No se encontró una cámara."
                  : "No se pudo iniciar la cámara."}
              </p>
              {(state === "denied" || state === "unavailable" || state === "error") && (
                <button
                  onClick={retry}
                  className="mt-2 px-3 h-8 rounded-[8px] text-[12px] font-bold"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 pb-2">
        <IconButton icon="chevron" label="Cambiar cámara" onClick={toggleFacing} disabled={state !== "live"} style={{ transform: "rotate(90deg)" }} />
        <button
          onClick={capture}
          disabled={state !== "live" || busy}
          aria-label="Tomar foto"
          className="w-16 h-16 rounded-full border-4 shrink-0 transition-transform active:scale-95"
          style={{ borderColor: "var(--accent)", background: "rgba(255,255,255,0.12)", opacity: state === "live" ? 1 : 0.4 }}
        >
          <Icon name="camera" size={22} style={{ color: "var(--accent)" }} />
        </button>
        <IconButton icon="close" label="Cancelar" onClick={onClose} />
      </div>
    </Sheet>
  );
}
