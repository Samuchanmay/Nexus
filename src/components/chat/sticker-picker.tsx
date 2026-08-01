"use client";
/**
 * Selector de stickers (FASE cierre) — los stickers son emoji grandes,
 * sin archivos en Storage: el mensaje se inserta con type='sticker' y el
 * emoji en `content`, y la burbuja lo renderiza como glyph de ~84px.
 *
 * Al no depender de assets, funciona igual en desktop, tablet y celular
 * sin peso extra ni latencia de descarga. El set está curado de emoji
 * "de cara" + algunos de apoyo, en un solo paquete (no hay categorías
 * todavía; si el paquete crece, se agrupa igual que un Sheet con tabs).
 */
import { Sheet } from "@/components/ui";

const STICKER_SET = [
  "😂", "😍", "😎", "🤩", "😭", "🥳", "😴", "🤯",
  "😱", "🤔", "🙃", "😉", "🥺", "😅", "🤗", "🤠",
  "💪", "👏", "👍", "🙌", "🤝", "🙏", "💜", "🔥",
  "❤️", "💯", "🚀", "✨", "🎉", "🎯", "🍕", "☕",
];

export function StickerPicker({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Stickers" subtitle="Toca uno para enviarlo">
      <div className="grid grid-cols-5 gap-2 pb-2">
        {STICKER_SET.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onPick(emoji)}
            aria-label={`Enviar sticker ${emoji}`}
            className="aspect-square grid place-items-center rounded-[14px] text-[34px] leading-none transition-transform hover:scale-110 active:scale-95"
            style={{ background: "var(--surface-2)" }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
