"use client";
// ══════════════════════════════════════════════════════════════════
//  Selector de presencia propia — Activo / Ausente / No molestar / Desconectado
//  ══════════════════════════════════════════════════════════════════
//  Fase 5. Vive en el encabezado de la lista de chats (un solo punto
//  de control, no se repite en cada pantalla). Escribe directo en
//  users.presence_status vía RPC nx_set_presence_status.
//
//  Optimista: cambia el estado local antes de que responda el servidor
//  y revierte + muestra el error real si falla (mismo criterio que el
//  resto de EMET esta sesión — nunca un mensaje genérico que oculte la
//  causa real).
// ══════════════════════════════════════════════════════════════════
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast, Menu, MenuItem } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { PRESENCE_DOT_COLOR } from "@/lib/chat/format-presence";
import { getErrorMessage } from "@/lib/errors";

type ManualStatus = "active" | "away" | "busy" | "offline" | "ausente" | "no_molestar" | null;

const OPTIONS: { value: ManualStatus; label: string; icon: string; hint: string }[] = [
  { value: "active", label: "Activo", icon: "check", hint: "Presencia normal, según tu actividad" },
  { value: "away", label: "Ausente", icon: "clock", hint: "Se muestra a los demás en tus chats" },
  { value: "busy", label: "No molestar", icon: "moon", hint: "Se muestra a los demás en tus chats" },
  { value: "offline", label: "Desconectado", icon: "close", hint: "No recibirás notificaciones" },
];

function labelFor(status: ManualStatus): string {
  return OPTIONS.find((o) => o.value === status)?.label ?? "Activo";
}

function dotFor(status: ManualStatus): string {
  if (status === "away" || status === "ausente") return PRESENCE_DOT_COLOR.away;
  if (status === "busy" || status === "no_molestar") return PRESENCE_DOT_COLOR.dnd;
  if (status === "offline") return "var(--text-3)";
  return PRESENCE_DOT_COLOR.online;
}

export function PresenceStatusMenu({ myId, initialStatus }: { myId: string; initialStatus: ManualStatus }) {
  const toast = useToast();
  const [status, setStatus] = useState<ManualStatus>(initialStatus);
  const [saving, setSaving] = useState(false);

  const choose = async (next: ManualStatus) => {
    if (next === status || saving) return;
    const prev = status;
    setStatus(next); // optimista
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("nx_set_presence_status", { p_status: next ?? "active" });
      if (error) throw error;
    } catch (err) {
      setStatus(prev); // revierte
      toast(getErrorMessage(err, "No se pudo cambiar tu estado."), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Menu
      align="right"
      width={220}
      trigger={({ onClick, open }) => (
        <button
          onClick={onClick}
          data-ripple
          className="flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-full text-[12px] font-semibold cursor-pointer transition-colors hover:bg-hover"
          style={{ border: "1px solid var(--border)", color: "var(--text-2)", opacity: open ? 0.85 : 1 }}
          aria-label="Cambiar mi estado de presencia"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotFor(status) }} />
          {labelFor(status)}
        </button>
      )}
    >
      {OPTIONS.map((opt) => (
        <MenuItem
          key={opt.label}
          onClick={() => choose(opt.value)}
          icon={<Icon name={opt.icon} size={16} aria-hidden style={{ color: opt.value === status ? "var(--accent)" : "var(--text-3)" }} />}
        >
          <span className="flex flex-col items-start">
            <span style={{ color: opt.value === status ? "var(--accent)" : "var(--text-1)" }}>{opt.label}</span>
            <span className="text-[11px] font-normal" style={{ color: "var(--text-3)" }}>{opt.hint}</span>
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}
