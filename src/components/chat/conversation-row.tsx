"use client";
import { Avatar } from "@/components/ui";
import { useSwipeGesture } from "@/lib/chat/use-swipe-gesture";

const ACTION_W = 84; // ancho de cada franja de acciones (izq/der)

/**
 * Fila de conversación — deslizable como en Apple Mail. A la izquierda:
 * Silenciar / Fijar. A la derecha: Leído / Archivar. No dispara la acción
 * automáticamente al cruzar un umbral (eso es fácil de disparar sin
 * querer); revela la franja y el usuario toca el botón que quiere, o
 * toca la fila para cerrarla sin hacer nada.
 *
 * Contenido de la fila en reposo: solo avatar, nombre, último mensaje,
 * hora y punto de no leído — nada más, por diseño (ver filosofía Signal
 * del documento de arquitectura).
 */
export function ConversationRow({
  name, avatarUrl, color, preview, time, unread, unreadCount = 0, active, muted, pinned,
  onOpen, onToggleMute, onTogglePin, onMarkRead, onToggleArchive,
}: {
  name: string; avatarUrl: string | null; color: string | null; preview: string; time: string;
  unread: boolean; unreadCount?: number; active: boolean; muted: boolean; pinned: boolean;
  onOpen: () => void; onToggleMute: () => void; onTogglePin: () => void;
  onMarkRead: () => void; onToggleArchive: () => void;
}) {
  const { dx, dragging, reset, bind } = useSwipeGesture({
    maxOffset: ACTION_W,
    threshold: ACTION_W * 0.4,
    stayOpenOnComplete: true,
  });

  const openSide: "left" | "right" | null = dx <= -8 ? "left" : dx >= 8 ? "right" : null;

  return (
    <div className="relative overflow-hidden rounded-[18px] select-none">
      {/* Franja izquierda — visible al deslizar hacia la izquierda (dx negativo) */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_W }}>
        <button
          onClick={() => { onToggleMute(); reset(); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white text-[10.5px] font-semibold"
          style={{ background: "var(--warn)" }}
        >
          <span className="text-[15px] leading-none">{muted ? "🔔" : "🔕"}</span>
          {muted ? "Activar" : "Silenciar"}
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_W * 2, transform: `translateX(${ACTION_W}px)` }}>
        <button
          onClick={() => { onTogglePin(); reset(); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white text-[10.5px] font-semibold"
          style={{ background: "var(--accent)" }}
        >
          <span className="text-[15px] leading-none">📌</span>
          {pinned ? "Desfijar" : "Fijar"}
        </button>
      </div>

      {/* Franja derecha — visible al deslizar hacia la derecha (dx positivo) */}
      <div className="absolute inset-y-0 left-0 flex" style={{ width: ACTION_W * 2 }}>
        <button
          onClick={() => { onMarkRead(); reset(); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white text-[10.5px] font-semibold"
          style={{ background: "var(--ok)" }}
        >
          <span className="text-[15px] leading-none">✓</span>
          Leído
        </button>
        <button
          onClick={() => { onToggleArchive(); reset(); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white text-[10.5px] font-semibold"
          style={{ background: "var(--text-3)" }}
        >
          <span className="text-[15px] leading-none">🗂️</span>
          Archivar
        </button>
      </div>

      {/* Contenido — se desplaza dx px, arrastra consigo el clic normal (abrir).
          El fondo vive en .chat-ws .conv-card (CSS) para tener hover, con el
          estado activo por atributo data-active — inline no permite hover. */}
      <div
        {...bind}
        onClick={() => { if (openSide) { reset(); return; } onOpen(); }}
        data-active={active}
        className="conv-card relative flex items-center gap-3 px-4 py-3 rounded-[18px] cursor-pointer touch-pan-y"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform .25s var(--spring)",
        }}
      >
        <Avatar name={name} avatarUrl={avatarUrl} color={color} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {pinned && <span className="text-[10px] leading-none" aria-hidden>📌</span>}
            <p className={`text-[15px] truncate ${unread ? "font-bold" : "font-semibold"}`}>{name}</p>
          </div>
          <p
            className="text-[13px] leading-snug line-clamp-2"
            style={{ color: unread ? "var(--text-2)" : "var(--text-3)" }}
          >
            {preview}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 self-start pt-0.5">
          <span className="text-[11.5px]" style={{ color: unread ? "var(--accent)" : "var(--text-3)" }}>{time}</span>
          {unread && (
            unreadCount > 0 ? (
              <span
                className="min-w-[24px] h-6 px-2 grid place-items-center rounded-full text-[12px] font-bold text-white"
                style={{ background: muted ? "var(--text-3)" : "var(--accent)", boxShadow: "0 4px 12px rgba(38,99,255,0.30)" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: muted ? "var(--text-3)" : "var(--accent)" }} aria-label="No leído" />
            )
          )}
          {muted && !unread && <span className="text-[11px]" style={{ color: "var(--text-3)" }} aria-label="Silenciado">🔕</span>}
        </div>
      </div>
    </div>
  );
}
