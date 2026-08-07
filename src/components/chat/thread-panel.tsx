"use client";
/**
 * FASE W7 — Hilos (respuestas), alcance "simple estilo Slack" confirmado por
 * el usuario: panel lateral con el mensaje raíz + sus respuestas, contador
 * de respuestas en el mensaje original (reply_count, migración 0045),
 * composer propio que reutiliza el mismo `send()` del outbox principal —
 * las respuestas del hilo SIGUEN apareciendo en la línea de tiempo general
 * (mismo criterio que ya tenía reply_to_id para la cita en línea), esto
 * solo agrega una vista enfocada en un mensaje + sus respuestas.
 *
 * No reusa el estado paginado de la conversación (messages, en
 * chat/[id]/client.tsx) porque ese array se recorta (ver
 * MAX_MESSAGES_BEFORE_TRIM) y un hilo viejo podría tener respuestas que ya
 * salieron de esa ventana — el panel trae su propio historial completo del
 * hilo directo de Supabase + su propia suscripción Realtime mientras está
 * abierto.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { Button } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import type { EnlaceMessage } from "@/lib/types";
import type { ParticipantLite } from "@/app/chat/client";

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

export function ThreadPanel({ open, onClose, root, myId, peopleById, onSend }: {
  open: boolean;
  onClose: () => void;
  /** Mensaje raíz del hilo — null cuando el panel está cerrado. */
  root: EnlaceMessage | null;
  myId: string;
  peopleById: Map<string, ParticipantLite>;
  /** Reutiliza el send() del outbox principal — la respuesta entra por el
      mismo camino optimista/reintento que cualquier mensaje normal. */
  onSend: (content: string, replyToId: string) => void;
}) {
  const [replies, setReplies] = useState<EnlaceMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !root) { setReplies([]); return; }
    let active = true;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at, sticker_image_path, reply_count")
        .eq("reply_to_id", root.id)
        .order("created_at", { ascending: true });
      if (!active) return;
      setReplies((data ?? []) as EnlaceMessage[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`thread-${root.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `reply_to_id=eq.${root.id}` },
        (payload) => {
          const row = payload.new as EnlaceMessage;
          setReplies((cur) => (cur.some((m) => m.id === row.id) ? cur : [...cur, row]));
        }
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [open, root]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [replies]);

  if (!open || !root) return null;

  const rootSender = peopleById.get(root.sender_id);

  const enviar = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text, root.id);
    setDraft("");
  };

  return (
    <div
      className="fixed inset-y-0 right-0 w-full sm:w-[380px] z-[70] flex flex-col"
      style={{ background: "var(--panel)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-2)" }}
      role="complementary" aria-label="Hilo de respuestas"
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-[15px] font-bold">Hilo</p>
        <button
          onClick={onClose}
          aria-label="Cerrar hilo"
          className="grid w-7 h-7 place-items-center rounded-full transition-colors hover:bg-surface-2"
        >
          <Icon name="close" size={15} style={{ color: "var(--text-2)" }} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto nx-scroll px-4 py-3 flex flex-col gap-3">
        {/* Mensaje raíz — mismo look que un mensaje normal, sin acciones. */}
        <div className="flex items-start gap-2">
          <Avatar name={rootSender?.display_name ?? "?"} avatarUrl={rootSender?.avatar_url} color={rootSender?.nexus_color} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold" style={{ color: rootSender?.nexus_color ?? "var(--accent)" }}>
              {root.sender_id === myId ? "Tú" : (rootSender?.display_name ?? "Alguien")}
              <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-3)" }}>{timeOnly(root.created_at)}</span>
            </p>
            <p className="text-[13.5px] mt-0.5 whitespace-pre-wrap break-words">
              {root.deleted_at ? "Mensaje eliminado" : (root.content ?? (root.type === "sticker" ? "Sticker" : ""))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
            {loading ? "Cargando…" : `${replies.length} ${replies.length === 1 ? "respuesta" : "respuestas"}`}
          </span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        {replies.map((m) => {
          const sender = peopleById.get(m.sender_id);
          return (
            <div key={m.id} className="flex items-start gap-2">
              <Avatar name={sender?.display_name ?? "?"} avatarUrl={sender?.avatar_url} color={sender?.nexus_color} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold" style={{ color: sender?.nexus_color ?? "var(--accent)" }}>
                  {m.sender_id === myId ? "Tú" : (sender?.display_name ?? "Alguien")}
                  <span className="ml-2 text-[10.5px] font-normal" style={{ color: "var(--text-3)" }}>{timeOnly(m.created_at)}</span>
                </p>
                <p className="text-[13.5px] mt-0.5 whitespace-pre-wrap break-words">
                  {m.deleted_at ? "Mensaje eliminado" : (m.content ?? (m.type === "sticker" ? "Sticker" : ""))}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <input
          className="field-input flex-1" placeholder="Responder en el hilo…"
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
        />
        <Button variant="primary" size="sm" disabled={!draft.trim()} onClick={enviar} aria-label="Enviar">
          <Icon name="send" size={14} />
        </Button>
      </div>
    </div>
  );
}
