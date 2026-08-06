"use client";
/**
 * FASE W7 — Encuestas en el chat, alcance "simple" confirmado por el
 * usuario: opción única o múltiple, resultados en vivo (barra de progreso
 * por opción, se actualiza por Realtime sobre chat_poll_votes). No hay
 * fecha de cierre ni encuestas anónimas — cualquiera ve quién ganó, nadie
 * ve por separado quién votó qué (solo el conteo), que es lo que pide un
 * chat interno de equipo.
 *
 * Este componente es puramente de presentación + un callback onVote: toda
 * la lógica de "cuál era mi voto anterior en single-choice" vive en el
 * padre (chat/[id]/client.tsx), que es quien tiene pollsByMessage y hace
 * los inserts/deletes contra chat_poll_votes.
 */
import type { ChatPollFull } from "@/lib/types";
import { Icon } from "@/components/os/icons";

export function PollMessage({ full, myId, mine, onVote }: {
  full: ChatPollFull;
  myId: string;
  /** Burbuja propia — solo cambia el tinte, la interacción es la misma. */
  mine: boolean;
  onVote: (optionId: string) => void;
}) {
  const { poll, options, votes } = full;
  const totalVotes = votes.length;
  const myVoteOptionIds = new Set(votes.filter((v) => v.user_id === myId).map((v) => v.option_id));
  const sorted = [...options].sort((a, b) => a.position - b.position);

  return (
    <div className="min-w-[240px] max-w-[280px] mb-1">
      <p className="text-[13.5px] font-bold mb-2 flex items-center gap-1.5">
        <Icon name="chart" size={14} aria-hidden style={{ opacity: 0.8 }} />
        {poll.question}
      </p>
      <div className="flex flex-col gap-1.5">
        {sorted.map((opt) => {
          const optVotes = votes.filter((v) => v.option_id === opt.id).length;
          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
          const mineVoted = myVoteOptionIds.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onVote(opt.id)}
              className="relative w-full text-left rounded-[10px] overflow-hidden transition-transform active:scale-[.98]"
              style={{
                background: mine ? "rgba(255,255,255,0.14)" : "var(--chat-card-inner)",
                border: mineVoted ? "1.5px solid currentColor" : "1.5px solid transparent",
              }}
            >
              {/* Barra de progreso — ancho proporcional al % de votos. */}
              <div
                className="absolute inset-y-0 left-0 transition-all duration-300"
                style={{ width: `${pct}%`, background: mine ? "rgba(255,255,255,0.16)" : "var(--accent-tint)" }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2 px-2.5 py-1.5">
                <span className="text-[12.5px] font-semibold flex items-center gap-1.5 min-w-0">
                  {mineVoted && <Icon name="check" size={12} className="shrink-0" aria-hidden />}
                  <span className="truncate">{opt.label}</span>
                </span>
                <span className="text-[11px] font-bold shrink-0 opacity-80">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10.5px] mt-1.5 opacity-70">
        {totalVotes} {totalVotes === 1 ? "voto" : "votos"} · {poll.multiple_choice ? "opción múltiple" : "opción única"}
      </p>
    </div>
  );
}
