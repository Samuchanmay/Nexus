"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PersonRow, EmptyState } from "@/components/shared";
import { useToast, Sheet, CheckBox } from "@/components/ui";
import { Button, Input } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import type { EnlaceConversation } from "@/lib/types";

export type ParticipantLite = { id: string; display_name: string; avatar_url: string | null; nexus_color: string | null };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function conversationDisplay(c: EnlaceConversation, myId: string, participants: ParticipantLite[]) {
  if (c.type === "group") {
    return { name: c.name ?? "Grupo", avatarUrl: c.avatar_url, color: "#5856D6" };
  }
  const other = participants.find((p) => p.id !== myId);
  return { name: other?.display_name ?? "Conversación", avatarUrl: other?.avatar_url ?? null, color: other?.nexus_color ?? "#0066FF" };
}

// ChatShell — panel de lista (izquierda) + conversación abierta (derecha),
// visibles al mismo tiempo en escritorio (como WhatsApp Web). En celular
// solo se ve un panel a la vez: la lista en /chat, la conversación en
// /chat/[id] — igual que hoy, sin romper esa navegación.
//
// Vive en el layout (no en page.tsx) para que NO se vuelva a montar ni
// recargar al abrir/cerrar una conversación: la lista, su suscripción de
// tiempo real y el estado de scroll quedan intactos.
export default function ChatShell({
  myId, initialConversations, participantsByConv, children,
}: {
  myId: string;
  initialConversations: EnlaceConversation[];
  participantsByConv: Record<string, ParticipantLite[]>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [conversations, setConversations] = useState(initialConversations);
  const [participants, setParticipants] = useState(participantsByConv);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");

  const atRoot = pathname === "/chat";
  const selectedId = !atRoot ? pathname.split("/")[2] : undefined;

  // Realtime: RLS ya limita qué conversaciones puede ver este usuario, así
  // que no hace falta un filtro adicional aquí — cualquier INSERT/UPDATE
  // que le llegue es, por definición, suyo (mismo criterio que notifications.tsx).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`enlace-list-${myId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as EnlaceConversation;
        setConversations((cur) => {
          const exists = cur.some((c) => c.id === row.id);
          const next = exists ? cur.map((c) => (c.id === row.id ? row : c)) : [row, ...cur];
          return [...next].sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as EnlaceConversation;
        setConversations((cur) => (cur.some((c) => c.id === row.id) ? cur : [row, ...cur]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId]);

  // Conversaciones nuevas (llegadas por realtime) todavía no tienen sus
  // participantes en memoria — se resuelven bajo demanda.
  useEffect(() => {
    const missing = conversations.filter((c) => !participants[c.id]).map((c) => c.id);
    if (missing.length === 0) return;
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data: rows } = await supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", missing);
      const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      if (userIds.length === 0) return;
      const { data: people } = await supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color").in("id", userIds);
      if (!active) return;
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      setParticipants((cur) => {
        const next = { ...cur };
        for (const r of rows ?? []) {
          const person = peopleById.get(r.user_id);
          if (!person) continue;
          next[r.conversation_id] = [...(next[r.conversation_id] ?? []), person];
        }
        return next;
      });
    })();
    return () => { active = false; };
  }, [conversations, participants]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const { name } = conversationDisplay(c, myId, participants[c.id] ?? []);
      return name.toLowerCase().includes(q);
    });
  }, [conversations, participants, myId, search]);

  return (
    // Altura fija reservada bajo el header del Shell (y la tab bar inferior
    // en celular) — la única franja de la app donde el layout normal de
    // Nexus se rompe a propósito: aquí ambos paneles (o el único visible en
    // celular) ocupan toda esa altura, sin que la página entera se desplace.
    <div className="flex h-[calc(100dvh-12rem)] md:h-[calc(100dvh-8.5rem)] min-h-[420px] -mx-4 md:mx-0">
      {/* Panel izquierdo — lista de conversaciones */}
      <div className={`w-full md:w-[340px] shrink-0 md:border-r md:border-border flex-col ${atRoot ? "flex" : "hidden md:flex"}`}>
        <div className="flex items-center justify-between gap-2 px-4 md:px-0 md:pr-4 pb-3 shrink-0">
          <div>
            <p className="text-[20px] font-bold tracking-tight">Chat</p>
            <p className="text-[12px]" style={{ color: "var(--text-2)" }}>Mensajes con tu equipo</p>
          </div>
          <Button variant="primary" icon="plus" size="sm" onClick={() => setNewOpen(true)}>Nuevo</Button>
        </div>

        <div className="px-4 md:px-0 md:pr-4 pb-3 shrink-0">
          <Input icon="search" placeholder="Buscar en chats..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-0 md:pr-2">
          {conversations.length === 0 ? (
            <div className="px-2 md:px-0">
              <EmptyState
                icon={<Icon name="message" size={22} />}
                title="Sin conversaciones todavía"
                hint="Escribe a un compañero o crea un grupo para empezar."
                action={<Button variant="primary" onClick={() => setNewOpen(true)}>Escribir a alguien</Button>}
              />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>
              Nadie coincide con &ldquo;{search}&rdquo;
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((c) => {
                const { name, avatarUrl, color } = conversationDisplay(c, myId, participants[c.id] ?? []);
                const mine = c.last_message_sender_id === myId;
                const preview = c.last_message_preview ? `${mine ? "Tú: " : ""}${c.last_message_preview}` : "Sin mensajes todavía";
                return (
                  <PersonRow
                    key={c.id}
                    name={name}
                    avatarUrl={avatarUrl}
                    color={color}
                    meta={preview}
                    active={c.id === selectedId}
                    onClick={() => router.push(`/chat/${c.id}`)}
                    right={c.last_message_at ? (
                      <span className="text-[11px] shrink-0" style={{ color: "var(--text-3)" }}>{timeAgo(c.last_message_at)}</span>
                    ) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho — conversación abierta (o estado vacío en /chat) */}
      <div className={`flex-1 min-w-0 flex-col md:pl-4 ${atRoot ? "hidden md:flex" : "flex"}`}>
        {children}
      </div>

      <NewConversationSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => { setNewOpen(false); router.push(`/chat/${id}`); }}
        myId={myId}
        onToast={(msg) => toast(msg, "danger")}
      />
    </div>
  );
}

function NewConversationSheet({
  open, onClose, onCreated, myId, onToast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  myId: string;
  onToast: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [people, setPeople] = useState<ParticipantLite[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("direct"); setSearch(""); setSelected(new Set()); setGroupName("");
    const supabase = createClient();
    // Solo equipo interno (admin/empleado) — coordinador/departamento/rh no
    // deben aparecer como destino de chat. El filtro real (que no se puede
    // saltar) vive en las funciones nx_enlace_* (ver migración 0012);
    // este es el filtro de UI para no ni mostrarlos como opción.
    supabase
      .from("users_directory")
      .select("id, display_name, avatar_url, nexus_color, role")
      .eq("active", true)
      .in("role", ["admin", "empleado"])
      .neq("id", myId)
      .order("display_name")
      .then(({ data }) => setPeople((data ?? []) as ParticipantLite[]));
  }, [open, myId]);

  const filtered = useMemo(
    () => people.filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase())),
    [people, search]
  );

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickDirect = async (otherId: string) => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_get_or_create_direct", { p_other_user_id: otherId });
    setBusy(false);
    if (error) { onToast(error.message); return; }
    onCreated(data as string);
  };

  const createGroup = async () => {
    if (!groupName.trim()) { onToast("Ponle un nombre al grupo"); return; }
    if (selected.size === 0) { onToast("Selecciona al menos un integrante"); return; }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_create_group", {
      p_name: groupName.trim(),
      p_member_ids: Array.from(selected),
    });
    setBusy(false);
    if (error) { onToast(error.message); return; }
    onCreated(data as string);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo mensaje">
      <div className="flex gap-2 mb-4">
        <Button variant={mode === "direct" ? "primary" : "subtle"} size="sm" onClick={() => setMode("direct")}>Directo</Button>
        <Button variant={mode === "group" ? "primary" : "subtle"} size="sm" onClick={() => setMode("group")}>Grupo</Button>
      </div>

      {mode === "group" && (
        <Input
          placeholder="Nombre del grupo"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="mb-3"
        />
      )}

      <Input icon="search" placeholder="Buscar compañero..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />

      <div className="max-h-[42vh] overflow-y-auto -mx-1">
        {filtered.map((p) => (
          <PersonRow
            key={p.id}
            name={p.display_name}
            avatarUrl={p.avatar_url}
            color={p.nexus_color}
            onClick={() => (mode === "direct" ? pickDirect(p.id) : toggleSelect(p.id))}
            right={mode === "group" ? <CheckBox checked={selected.has(p.id)} /> : undefined}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>
            Nadie coincide con &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {mode === "group" && (
        <div className="pt-4">
          <Button variant="primary" onClick={createGroup} disabled={busy} className="w-full">
            Crear grupo{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
