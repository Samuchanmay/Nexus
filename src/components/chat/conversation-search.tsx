"use client";
/**
 * Búsqueda DENTRO de una conversación (FASE 2) — distinta de la caja
 * "Buscar personas, grupos o mensajes" de la lista, que cruza TODAS las
 * conversaciones. Aquí se busca solo en los mensajes de esta conversación
 * y se salta al mensaje (scroll + resaltado) en vez de abrir otra ruta.
 *
 * Se renderiza como un overlay dentro de la columna de conversación
 * (el padre le da `relative`), así no desmonta el realtime ni el scroll.
 * El salto lo resuelve el cliente de la conversación vía onJumpTo(id):
 * si el mensaje aún no está cargado (solo se cargan los últimos 50),
 * el cliente carga más historial hasta encontrarlo.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skel } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";

type Hit = {
  id: string;
  content: string | null;
  sender_id: string;
  sender_name: string;
  created_at: string;
};

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

export function ConversationSearch({
  open, onClose, conversationId, onJumpTo,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  onJumpTo: (messageId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setHits([]); setSearched(false);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); setSearched(false); return; }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select("id, content, sender_id, created_at")
        .eq("conversation_id", conversationId)
        .eq("type", "text")
        .is("deleted_at", null)
        .ilike("content", `%${q}%`)
        .order("created_at", { ascending: true })
        .limit(100);
      if (!active) return;
      const senderIds = Array.from(new Set((data ?? []).map((m) => m.sender_id)));
      const { data: senders } = senderIds.length
        ? await supabase.from("users_directory").select("id, display_name").in("id", senderIds)
        : { data: [] as { id: string; display_name: string }[] };
      if (!active) return;
      const nameById = new Map((senders ?? []).map((s) => [s.id, s.display_name]));
      setHits((data ?? []).map((m) => ({
        id: m.id,
        content: m.content,
        sender_id: m.sender_id,
        sender_name: nameById.get(m.sender_id) ?? "Alguien",
        created_at: m.created_at,
      })));
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query, conversationId]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col rounded-[14px]" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 pb-2.5 shrink-0">
        <button
          onClick={onClose}
          aria-label="Cerrar búsqueda"
          className="grid place-items-center h-9 w-9 rounded-full hover:bg-hover"
          style={{ color: "var(--text-2)" }}
        >
          <Icon name="chevron" size={17} style={{ transform: "scaleX(-1)" }} />
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en esta conversación…"
          className="flex-1 bg-transparent text-[14px] focus:outline-none py-2"
        />
        <button
          onClick={onClose}
          aria-label="Cerrar búsqueda"
          className="grid place-items-center h-9 w-9 rounded-full hover:bg-hover"
          style={{ color: "var(--text-3)" }}
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto nx-scroll">
        {loading && (
          <div className="space-y-1 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2 px-2 py-2.5">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skel className="h-3 w-24" />
                  <Skel className="h-2.5 w-[80%]" />
                </div>
                <Skel className="h-2.5 w-10 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {!loading && query.trim().length < 2 && (
          <p className="text-center text-[12.5px] py-10" style={{ color: "var(--text-3)" }}>
            Escribe al menos 2 letras para buscar en los mensajes.
          </p>
        )}

        {!loading && query.trim().length >= 2 && searched && hits.length === 0 && (
          <p className="text-center text-[12.5px] py-10" style={{ color: "var(--text-3)" }}>
            Nada coincide con &ldquo;{query.trim()}&rdquo; en esta conversación.
          </p>
        )}

        {!loading && hits.length > 0 && (
          <div className="space-y-0.5">
            {hits.map((h) => (
              <button
                key={h.id}
                onClick={() => onJumpTo(h.id)}
                className="w-full flex items-start gap-2 px-2 py-2.5 rounded-[10px] text-left hover:bg-hover transition-colors"
              >
                <span className="shrink-0 pt-0.5" style={{ color: "var(--text-3)" }} aria-hidden>
                  <Icon name="search" size={14} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{h.sender_name}</span>
                  <span className="block text-[12.5px] leading-snug truncate" style={{ color: "var(--text-1)" }}>{h.content}</span>
                </span>
                <span className="text-[10.5px] shrink-0 pt-0.5" style={{ color: "var(--text-3)" }}>{timeOnly(h.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
