"use client";
import { useRef } from "react";
import { Sheet } from "@/components/ui";

type Kind = "gallery" | "document";

/**
 * Hoja inferior del botón "+" del compositor — reemplaza la fila de
 * botones sueltos por un solo punto de entrada, como pedía la referencia
 * de Signal. Reusa el componente `Sheet` que ya existe en todo Nexus, no
 * se inventó un overlay nuevo.
 *
 * Cámara, Ubicación y Nota de audio quedan visibles pero deshabilitadas
 * ("Próximamente"): cada una requiere su propio flujo de permisos del
 * navegador (getUserMedia, Geolocation, MediaRecorder) que necesita
 * probarse en un dispositivo real antes de poder llamarse terminado — se
 * deja preparado el punto de entrada en la UI, no la funcionalidad.
 */
export function AttachmentSheet({
  open, onClose, onPickGallery, onPickDocument,
}: {
  open: boolean;
  onClose: () => void;
  onPickGallery: (file: File) => void;
  onPickDocument: (file: File) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);

  const options: { key: Kind | "camera" | "location" | "audio"; icon: string; label: string; disabled?: boolean; onClick?: () => void }[] = [
    { key: "camera", icon: "📷", label: "Cámara", disabled: true },
    { key: "gallery", icon: "🖼️", label: "Galería", onClick: () => galleryRef.current?.click() },
    { key: "document", icon: "📄", label: "Documento", onClick: () => documentRef.current?.click() },
    { key: "location", icon: "📍", label: "Ubicación", disabled: true },
    { key: "audio", icon: "🎤", label: "Nota de audio", disabled: true },
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
              disabled={opt.disabled}
              onClick={opt.onClick}
              className="flex flex-col items-center gap-1.5 rounded-[14px] py-4 transition-colors"
              style={{
                background: "var(--surface-2)",
                opacity: opt.disabled ? 0.45 : 1,
                cursor: opt.disabled ? "not-allowed" : "pointer",
              }}
            >
              <span className="text-[26px] leading-none" aria-hidden>{opt.icon}</span>
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>{opt.label}</span>
              {opt.disabled && <span className="text-[9.5px]" style={{ color: "var(--text-3)" }}>Próximamente</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
