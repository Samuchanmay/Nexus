"use client";
import type { EnlaceReaction } from "@/lib/types";

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉"];

/** Franja de reacciones ya puestas en un mensaje, agrupadas por emoji.
    Cápsulas compactas (28px de alto, emoji 16px) pegadas a la burbuja:
    se superponen a su borde inferior con margen negativo para leerse como
    parte del mensaje, no como una fila aparte. */
export function ReactionStrip({
  reactions, myId, onToggle,
}: { reactions: EnlaceReaction[]; myId: string; onToggle?: (emoji: string) => void }) {
  if (reactions.length === 0) return null;
  const byEmoji = new Map<string, EnlaceReaction[]>();
  for (const r of reactions) {
    const list = byEmoji.get(r.emoji) ?? [];
    list.push(r);
    byEmoji.set(r.emoji, list);
  }
  const readOnly = !onToggle;
  return (
    <div className="relative z-[2] flex flex-wrap gap-1 -mt-2.5">
      {Array.from(byEmoji.entries()).map(([emoji, list]) => {
        const mine = list.some((r) => r.user_id === myId);
        const inner = (
          <>
            <span className="text-[16px] leading-none" aria-hidden>{emoji}</span>
            {list.length > 1 && <span style={{ color: mine ? "var(--accent)" : "var(--text-3)" }}>{list.length}</span>}
          </>
        );
        const style = {
          background: mine ? "var(--accent-tint)" : "var(--panel)",
          border: mine ? "1px solid var(--accent)" : "1px solid var(--border)",
          boxShadow: mine ? "0 4px 12px rgba(38,99,255,0.25)" : "0 2px 8px rgba(0,0,0,0.18)",
          color: "var(--text-1)",
        };
        if (readOnly) {
          return (
            <span key={emoji} className="flex items-center gap-1 h-7 px-2 rounded-full text-[12px] font-semibold leading-none" style={style}>
              {inner}
            </span>
          );
        }
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className="flex items-center gap-1 h-7 px-2 rounded-full text-[12px] font-semibold leading-none transition-all duration-150 hover:scale-105 active:scale-95"
            style={style}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/** Picker que aparece al mantener presionado / hacer hover sobre un mensaje.
    Entra con scale + fade (nx-menu-in) y cada emoji hace pop al interactuar. */
export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2 py-1.5 shadow-nx"
      style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-2)", animation: "nx-menu-in .16s var(--ease)" }}
    >
      {REACTION_SET.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onPick(emoji)}
          className="text-[16px] leading-none hover:scale-125 transition-transform"
          style={{ animation: "nx-pop-react .3s var(--ease)" }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
