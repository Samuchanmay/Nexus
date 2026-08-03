"use client";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { useSwipeGesture } from "@/lib/chat/use-swipe-gesture";
import { useTyping } from "@/lib/chat/use-typing";
import { TypingDots } from "@/components/chat/typing-indicator";

/** Ancho fijo de cada acción (spec Signal: 72–80 px). La franja completa
    mide dos acciones; al deslizar la tarjeta se revela entera. */
const ACTION_W = 78;
const STRIP_W = ACTION_W * 2;

/** Paleta de acciones — tonos apagados para que el contenido sea el
    protagonista (spec: Leído gris azulado, Archivar gris medio, Fijar azul
    institucional de Emet, Silenciar ámbar apagado). */
const ACTION_COLORS = {
  read: "#5B6B84",
  archive: "#6E7681",
  pin: "#2663FF",
  mute: "#9A6B2F",
} as const;

/** Botón de acción en la franja inferior: icono SVG centrado + texto debajo,
    ancho fijo (shrink-0) para que nunca se comprima ni corte el texto. */
function ActionButton({ icon, label, background, onClick }: {
  icon: string; label: string; background: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex shrink-0 flex-col items-center justify-center gap-1 text-white cursor-pointer"
      style={{ width: ACTION_W, background }}
    >
      <Icon name={icon} size={20} aria-hidden />
      <span className="text-[11px] font-semibold leading-tight select-none">{label}</span>
    </button>
  );
}

/**
 * Fila de conversación — deslizable como Signal/Apple Mail. La tarjeta es
 * una sola pieza que se traslada con `transform: translateX` (GPU) sobre
 * una capa fija de acciones: nunca se superponen ni se deforman.
 *
 * · Swipe a la derecha → Leído (borde) / Archivar.
 * · Swipe a la izquierda → Fijar / Silenciar (borde).
 * · Swipe completo pasado ~85% del límite ejecuta la acción del borde
 *   (Leído al derecha, Silenciar a la izquierda) y la tarjeta regresa;
 *   un swipe parcial deja la franja abierta y el usuario toca el botón.
 * · Toque en la fila con la franja abierta la cierra sin hacer nada.
 * · Resistencia (rubber band) al final del arrastre + retorno con resorte.
 */
export function ConversationRow({
  name, avatarUrl, color, preview, time, unread, unreadCount = 0, active, muted, pinned, online,
  typingLabel, onOpen, onToggleMute, onTogglePin, onMarkRead, onToggleArchive,
}: {
  name: string; avatarUrl: string | null; color: string | null; preview: string; time: string;
  unread: boolean; unreadCount?: number; active: boolean; muted: boolean; pinned: boolean;
  online?: boolean;
  typingLabel?: string | null;
  onOpen: () => void; onToggleMute: () => void; onTogglePin: () => void;
  onMarkRead: () => void; onToggleArchive: () => void;
}) {
  const { dx, dragging, reset, bind } = useSwipeGesture({
    maxOffset: STRIP_W,
    threshold: Math.round(STRIP_W * 0.45),
    stayOpenOnComplete: true,
    executeOnFullSwipe: true,
    onSwipeLeftComplete: onToggleMute,
    onSwipeRightComplete: onMarkRead,
  });

  const openSide: "left" | "right" | null = dx <= -8 ? "left" : dx >= 8 ? "right" : null;

  return (
    <div className="conv-card-shell relative overflow-hidden rounded-[14px] select-none">
      {/* Capa de acciones — swipe a la derecha (dx>0) revela desde el borde
          izquierdo: Leído primero, Archivar después. */
      }
      <div className="absolute inset-y-0 left-0 flex" style={{ width: STRIP_W }}>
        <ActionButton icon="check" label="Leído" background={ACTION_COLORS.read} onClick={() => { onMarkRead(); reset(); }} />
        <ActionButton icon="archive" label="Archivar" background={ACTION_COLORS.archive} onClick={() => { onToggleArchive(); reset(); }} />
      </div>

      {/* Capa de acciones — swipe a la izquierda (dx<0) revela desde el borde
          derecho: Silenciar (borde) y Fijar a su izquierda. */
      }
      <div className="absolute inset-y-0 right-0 flex" style={{ width: STRIP_W }}>
        <ActionButton icon={pinned ? "pinOff" : "pin"} label={pinned ? "Desfijar" : "Fijar"} background={ACTION_COLORS.pin} onClick={() => { onTogglePin(); reset(); }} />
        <ActionButton icon={muted ? "bell" : "bellOff"} label={muted ? "Activar" : "Silenciar"} background={ACTION_COLORS.mute} onClick={() => { onToggleMute(); reset(); }} />
      </div>

      {/* Contenido — la tarjeta completa se desplaza dx px sobre la capa de
          acciones. El fondo vive en .chat-ws .conv-card (CSS) para tener
          hover, con el estado activo por atributo data-active. */
      }
      <div
        {...bind}
        onClick={() => { if (openSide) { reset(); return; } onOpen(); }}
        data-active={active}
        className="conv-card relative z-[1] flex items-center gap-3 px-4 py-2.5 rounded-[14px] cursor-pointer touch-pan-y"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform .2s var(--spring)",
          willChange: dragging ? "transform" : "auto",
        }}
      >
        <div className="relative shrink-0">
          <Avatar name={name} avatarUrl={avatarUrl} color={color} size={48} />
          {online && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
              style={{ background: "var(--ok)", borderColor: "var(--chat-list-bg)" }}
              aria-label="En línea"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {pinned && <Icon name="pin" size={12} aria-hidden style={{ color: "var(--accent)", flexShrink: 0 }} />}
            <p className={`text-[15px] truncate ${unread ? "font-bold" : "font-semibold"}`}>{name}</p>
          </div>
          {typingLabel ? (
            <p className="text-[13px] leading-snug truncate inline-flex items-center" style={{ color: "var(--accent)" }}>{typingLabel}<TypingDots /></p>
          ) : (
            <p
              className="text-[13px] leading-snug truncate"
              style={{ color: unread ? "var(--text-2)" : "var(--text-3)" }}
            >
              {preview}
            </p>
          )}
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
          {muted && !unread && (
            <span className="grid place-items-center" style={{ color: "var(--text-3)" }} aria-label="Silenciado">
              <Icon name="bellOff" size={13} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper de la lista: suscribe esta conversación al broadcast de "escribiendo…"
 * (mismo canal efímero que usa la conversación abierta) y pinta el indicador
 * en lugar del último mensaje mientras alguien más escribe.
 */
export function ConversationRowWithTyping({ conversationId, myId, ...props }: {
  conversationId: string; myId: string;
} & Parameters<typeof ConversationRow>[0]) {
  const { typingText } = useTyping(conversationId, myId, "");
  return <ConversationRow {...props} typingLabel={typingText} />;
}
