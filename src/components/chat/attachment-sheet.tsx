"use client";
import { useRef } from "react";
import { Sheet } from "@/components/ui";

/**
 * Hoja inferior del botón "+" del compositor — reemplaza la fila de
 * botones sueltos por un solo punto de entrada, como pedía la referencia
 * de Signal. Reusa el componente `Sheet` que ya existe en todo Nexus, no
 * se inventó un overlay nuevo.
 *
 * FASE cierre (0022): ya NO hay opciones deshabilitadas — Cámara (foto en
 * vivo vía getUserMedia, CameraCapture), Galería, Documento, Ubicación
 * (Geolocation → mensaje type=location con mapa), Stickers (emoji grandes)
 * y Nota de audio (MediaRecorder) están todas funcionando. Cada una delega
 * en su propio flujo; esta hoja solo es el menú de entrada.
 */
export function AttachmentSheet({
  open, onClose, onPickGallery, onPickDocument, onPickAudio, onPickCamera, onPickLocation, onPickSticker,
}: {
  open: boolean;
  onClose: () => void;
  onPickGallery: (file: File) => void;
  onPickDocument: (file: File) => void;
  onPickAudio: () => void;
  onPickCamera: () => void;
  onPickLocation: () => void;
  onPickSticker: () => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);

  const options: { key: string; icon: string; label: string; onClick?: () => void }[] = [
    { key: "camera", icon: "📷", label: "Cámara", onClick: onPickCamera },
    { key: "gallery", icon: "🖼️", label: "Galería", onClick: () => galleryRef.current?.click() },
    { key: "document", icon: "📄", label: "Documento", onClick: () => documentRef.current?.click() },
    { key: "location", icon: "📍", label: "Ubicación", onClick: onPickLocation },
    { key: "sticker", icon: "🎨", label: "Stickers", onClick: onPickSticker },
    { key: "audio", icon: "🎤", label: "Nota de audio", onClick: onPickAudio },
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
        <div className="grid grid-cols-3 gap-3 pb-2">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={opt.onClick}
              className="flex flex-col items-center gap-1.5 rounded-[14px] py-4 transition-colors hover:bg-hover"
              style={{ background: "var(--surface-2)", cursor: "pointer" }}
            >
              <span className="text-[26px] leading-none" aria-hidden>{opt.icon}</span>
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
