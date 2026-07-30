"use client";
import type { EnlaceReaction } from "@/lib/types";

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉"];

/** Franja de reacciones ya puestas en un mensaje, agrupadas por emoji. */
export function ReactionStrip({
  reactions, myId, onToggle,
}: { reactions: EnlaceReaction[]; myId: string; onToggle: (emoji: string) => void }) {
  if (reactions.length === 0) return null;
  const byEmoji = new Map<string, EnlaceReaction[]>();
  for (const r of reactions) {
    const list = byEmoji.get(r.emoji) ?? [];
    list.push(r);
    byEmoji.set(r.emoji, list);
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Array.from(byEmoji.entries()).map(([emoji, list]) => {
        const mine = list.some((r) => r.user_id === myId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className="flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[11px] leading-none transition-colors"
            style={{
              background: mine ? "var(--accent-tint)" : "var(--surface-2)",
              border: mine ? "1px solid var(--accent)" : "1px solid transparent",
            }}
          >
            <span>{emoji}</span>
            {list.length > 1 && <span style={{ color: "var(--text-3)" }}>{list.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Picker que aparece al mantener presionado / hacer hover sobre un mensaje. */
export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2 py-1.5 shadow-nx"
      style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
    >
      {REACTION_SET.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onPick(emoji)}
          className="text-[17px] leading-none hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
