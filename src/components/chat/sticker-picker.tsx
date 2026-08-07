"use client";
/**
 * Selector de stickers — dos pestañas:
 *  - "Emoji": el set clásico (FASE cierre) — emoji grande como mensaje, sin
 *    archivos en Storage, mensaje type='sticker' con el emoji en `content`.
 *  - "Emu IA" (FASE W7): cualquiera escribe qué quiere que haga la mascota
 *    Emu y se genera una imagen real vía el Edge Function generate-sticker
 *    (OpenAI Images, misma clave que /admin/config/ia). El resultado queda
 *    en una biblioteca compartida (chat_stickers, is_public=true) que
 *    cualquiera puede reusar sin volver a generar — se lista debajo del
 *    generador, más reciente primero.
 */
import { useEffect, useState } from "react";
import { Sheet, SlidingSegments, useToast } from "@/components/ui";
import { Button } from "@/components/os/ui";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/errors";

const STICKER_SET = [
  "😂", "😍", "😎", "🤩", "😭", "🥳", "😴", "🤯",
  "😱", "🤔", "🙃", "😉", "🥺", "😅", "🤗", "🤠",
  "💪", "👏", "👍", "🙌", "🤝", "🙏", "💜", "🔥",
  "❤️", "💯", "🚀", "✨", "🎉", "🎯", "🍕", "☕",
];

type EmuSticker = { id: string; image_path: string; prompt: string };

/** Extrae el mensaje real del cuerpo JSON de un error de Edge Function —
    supabase-js solo da "non-2xx status code" en error.message por defecto;
    el texto útil vive en error.context (la Response cruda). */
async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error && typeof body.error === "string") return body.error;
    } catch { /* cuerpo no era JSON — cae al fallback */ }
  }
  return getErrorMessage(error, fallback);
}

export function StickerPicker({ open, onClose, onPick, onPickImage }: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** FASE W7 — enviar un sticker Emu generado (path en Storage, bucket chat-files). */
  onPickImage: (imagePath: string) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"Emoji" | "Emu IA">("Emoji");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [gallery, setGallery] = useState<EmuSticker[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loadedGallery, setLoadedGallery] = useState(false);

  // Carga la biblioteca pública una sola vez, cuando se abre la pestaña Emu IA.
  useEffect(() => {
    if (tab !== "Emu IA" || loadedGallery) return;
    setLoadedGallery(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("chat_stickers")
        .select("id, image_path, prompt").eq("is_public", true)
        .order("created_at", { ascending: false }).limit(40);
      const rows = (data ?? []) as EmuSticker[];
      setGallery(rows);
      if (rows.length === 0) return;
      // Una sola llamada en lote (createSignedUrls) para toda la galería en
      // vez de una createSignedUrl por sticker — misma respuesta, mismo
      // orden que los paths de entrada.
      const { data: signed } = await supabase.storage.from("chat-files")
        .createSignedUrls(rows.map((r) => r.image_path), 1800);
      const entries = rows.map((r, i) => [r.image_path, signed?.[i]?.signedUrl ?? ""] as const);
      setUrls((u) => ({ ...u, ...Object.fromEntries(entries) }));
    })();
  }, [tab, loadedGallery]);

  const generar = async () => {
    const clean = prompt.trim();
    if (!clean) { toast("Escribe qué quieres que haga Emu", "danger"); return; }
    setGenerating(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("generate-sticker", { body: { prompt: clean } });
    setGenerating(false);
    if (error || !data?.image_path) {
      toast(await edgeFunctionErrorMessage(error, "No se pudo generar el sticker"), "danger");
      return;
    }
    const created: EmuSticker = { id: data.id, image_path: data.image_path, prompt: data.prompt };
    setGallery((g) => [created, ...g]);
    if (data.url) setUrls((u) => ({ ...u, [data.image_path]: data.url }));
    setPrompt("");
    toast("Sticker generado — tócalo para enviarlo");
  };

  return (
    <Sheet open={open} onClose={onClose} title="Stickers" subtitle="Toca uno para enviarlo">
      <div className="mb-3">
        <SlidingSegments options={["Emoji", "Emu IA"]} value={tab} onChange={(v) => setTab(v as "Emoji" | "Emu IA")} />
      </div>

      {tab === "Emoji" ? (
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
      ) : (
        <div className="pb-2">
          <div className="flex items-center gap-2 mb-3">
            <input
              className="field-input flex-1" placeholder="Ej: Emu tomando café, Emu bailando…"
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !generating) generar(); }}
              maxLength={200}
            />
            <Button variant="primary" size="sm" disabled={generating || !prompt.trim()} onClick={generar}>
              {generating ? "Generando…" : "Generar"}
            </Button>
          </div>
          {gallery.length === 0 && !generating && (
            <p className="text-[12.5px] text-center py-6" style={{ color: "var(--text-3)" }}>
              Todavía no hay stickers de Emu — sé el primero en generar uno.
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {gallery.map((s) => (
              <button
                key={s.id}
                onClick={() => onPickImage(s.image_path)}
                aria-label={`Enviar sticker: ${s.prompt}`}
                title={s.prompt}
                className="aspect-square rounded-[14px] overflow-hidden transition-transform hover:scale-105 active:scale-95"
                style={{ background: "var(--surface-2)" }}
              >
                {urls[s.image_path] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[s.image_path]} alt={s.prompt} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full animate-pulse" style={{ background: "var(--surface-3)" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
