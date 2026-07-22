"use client";
import { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   ImageCropper — recorte circular de foto de perfil antes de subir.
   Sin librerías externas: arrastrar para mover + control para hacer
   zoom, luego se recorta a un canvas cuadrado fijo (OUTPUT px) y se
   exporta como Blob JPEG. Antes toda foto subida se guardaba tal
   cual y el <Avatar> (object-cover) recortaba el centro sin dejar
   elegir qué parte de la foto se conserva — con esto la persona
   decide antes de guardar. Se usa igual en ProfileModal (foto
   propia) y en Equipo (foto que el admin sube por alguien más).
   ═══════════════════════════════════════════════════════════════ */

const FRAME = 260; // px — tamaño visible del recorte circular en pantalla
const OUTPUT = 480; // px — resolución final del avatar exportado

export function ImageCropper({ file, onCancel, onSave }: {
  file: File; onCancel: () => void; onSave: (blob: Blob) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      setNatural({ w, h });
      const s = FRAME / Math.min(w, h); // escala mínima que cubre todo el marco
      setMinScale(s);
      setScale(s);
      setPos({ x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /** Evita que se pueda arrastrar/hacer zoom hasta dejar franjas vacías dentro del marco. */
  const clamp = (x: number, y: number, s: number) => {
    const w = natural.w * s, h = natural.h * s;
    const maxX = Math.max(0, (w - FRAME) / 2);
    const maxY = Math.max(0, (h - FRAME) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp(dragRef.current.origX + dx, dragRef.current.origY + dy, scale));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onZoom = (v: number) => {
    setScale(v);
    setPos((p) => clamp(p.x, p.y, v));
  };

  const save = () => {
    if (!imgUrl || !natural.w) return;
    setSaving(true);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setSaving(false); return; }
      // El cuadro visible (FRAME x FRAME en pantalla) equivale, en píxeles
      // reales de la imagen, a un cuadro de lado FRAME/scale centrado en el
      // punto que el drag/zoom dejó bajo el centro del marco.
      const srcSize = FRAME / scale;
      const srcX = natural.w / 2 - pos.x / scale - srcSize / 2;
      const srcY = natural.h / 2 - pos.y / scale - srcSize / 2;
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);
      canvas.toBlob((blob) => {
        setSaving(false);
        if (blob) onSave(blob);
      }, "image/jpeg", 0.92);
    };
    img.src = imgUrl;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 nx-fade" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[360px] rounded-lg bg-panel border border-border shadow-nx overflow-hidden nx-pop"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 text-center">
          <p className="text-[15px] font-bold">Ajustar foto</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-3)" }}>
            Arrastra para mover · usa la barra para hacer zoom
          </p>
        </div>

        <div className="flex items-center justify-center py-4" style={{ background: "var(--surface-2)" }}>
          <div
            className="relative overflow-hidden rounded-full touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: FRAME, height: FRAME, boxShadow: "0 0 0 3px var(--panel), 0 0 0 4px var(--border)" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          >
            {imgUrl && natural.w > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl} alt="" draggable={false}
                style={{
                  position: "absolute", left: "50%", top: "50%",
                  width: natural.w * scale, height: natural.h * scale,
                  transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
                  maxWidth: "none", pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>

        <div className="px-6 py-4 flex items-center gap-3">
          <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--text-3)" }}>Zoom</span>
          <input
            type="range" min={minScale} max={minScale * 3} step={0.01} value={scale}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="flex-1" style={{ accentColor: "var(--accent)" }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-border">
          <button onClick={onCancel} className="btn-secondary h-9 px-4 text-[13px]">Cancelar</button>
          <button onClick={save} disabled={saving || !imgUrl} className="btn-primary h-9 px-4 text-[13px]">
            {saving ? "Procesando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
