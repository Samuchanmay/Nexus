"use client";
import { useRef } from "react";
import { Sheet } from "@/components/ui";
import { Icon } from "@/components/os/icons";

/**
 * Hoja inferior del botón "+" del compositor — reemplaza la fila de
 * botones sueltos por un solo punto de entrada, como pedía la referencia
 * de Signal. Reusa el componente `Sheet` que ya existe en todo Emet, no
 * se inventó un overlay nuevo.
 *
 * FASE cierre (0022): ya NO hay opciones deshabilitadas — Cámara (foto en
 * vivo vía getUserMedia, CameraCapture), Galería, Documento, Ubicación
 * (Geolocation → mensaje type=location con mapa), Stickers (emoji grandes)
 * y Nota de audio (MediaRecorder) están todas funcionando. Cada una delega
 * en su propio flujo; esta hoja solo es el menú de entrada.
 *
 * Ronda V2 (diseño): las opciones pasan de emojis a iconos del set nativo
 * de Emet (mismo trazo Lucide del resto de la app), cada una en un círculo
 * tintado del acento — patrón iOS/Signal, con estados hover/pressed/focus.
 */
export function AttachmentSheet({
  open, onClose, onPickGallery, onPickDocument, onPickAudio, onPickCamera, onPickLocation, onPickSticker, onPickPoll,
}: {
  open: boolean;
  onClose: () => void;
  onPickGallery: (file: File) => void;
  onPickDocument: (file: File) => void;
  onPickAudio: () => void;
  onPickCamera: () => void;
  onPickLocation: () => void;
  onPickSticker: () => void;
  /** FASE W7 — abre la hoja de creación de encuesta. */
  onPickPoll: () => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);

  const options: { key: string; icon: string; label: string; onClick?: () => void }[] = [
    { key: "camera", icon: "camera", label: "Cámara", onClick: onPickCamera },
    { key: "gallery", icon: "image", label: "Galería", onClick: () => galleryRef.current?.click() },
    { key: "document", icon: "fileText", label: "Documento", onClick: () => documentRef.current?.click() },
    { key: "location", icon: "pin", label: "Ubicación", onClick: onPickLocation },
    { key: "sticker", icon: "smile", label: "Stickers", onClick: onPickSticker },
    { key: "poll", icon: "chart", label: "Encuesta", onClick: onPickPoll },
    { key: "audio", icon: "mic", label: "Nota de audio", onClick: onPickAudio },
  ];

  return (
    <>
      <input
        ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { onPickGallery(f); onClose(); } }}
      />
      <input
        ref={documentRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { onPickDocument(f); onClose(); } }}
      />
      <Sheet open={open} onClose={onClose} title="Adjuntar">
        <div className="grid grid-cols-3 gap-1.5 pb-3">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={opt.onClick}
              className="flex flex-col items-center gap-2.5 rounded-[18px] px-2 pt-5 pb-4 transition-all duration-150 hover:bg-hover active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{ cursor: "pointer" }}
            >
              <span
                className="grid place-items-center h-12 w-12 rounded-full transition-colors duration-150"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
              >
                <Icon name={opt.icon} size={22} aria-hidden />
              </span>
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
