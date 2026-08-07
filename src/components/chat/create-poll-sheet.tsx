"use client";
/**
 * FASE W7 — Hoja de creación de encuesta. Alcance "simple" confirmado por
 * el usuario: una pregunta + entre 2 y 8 opciones + un switch de opción
 * única/múltiple. Sin fecha de cierre, sin anonimato — ver poll-message.tsx
 * para el porqué.
 */
import { useState } from "react";
import { Sheet, useToast } from "@/components/ui";
import { Switch } from "@/components/shared";
import { Icon } from "@/components/os/icons";

const MAX_OPTIONS = 8;

export function CreatePollSheet({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  /** El padre hace el insert real (mensaje + poll + opciones) y cierra la
      hoja cuando termina — acá solo se valida la forma del formulario. */
  onCreate: (question: string, options: string[], multipleChoice: boolean) => Promise<void>;
}) {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [creating, setCreating] = useState(false);

  const reset = () => { setQuestion(""); setOptions(["", ""]); setMultipleChoice(false); };

  const updateOption = (i: number, value: string) => {
    setOptions((cur) => cur.map((o, idx) => (idx === i ? value : o)));
  };
  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((cur) => [...cur, ""]);
  };
  const removeOption = (i: number) => {
    setOptions((cur) => (cur.length > 2 ? cur.filter((_, idx) => idx !== i) : cur));
  };

  const crear = async () => {
    const q = question.trim();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!q) { toast("Escribe la pregunta de la encuesta", "danger"); return; }
    if (cleanOptions.length < 2) { toast("Agrega al menos 2 opciones", "danger"); return; }
    setCreating(true);
    try {
      await onCreate(q, cleanOptions, multipleChoice);
      reset();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo crear la encuesta", "danger");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Sheet open={open} onClose={() => { onClose(); }} title="Nueva encuesta" subtitle="Resultados en vivo para todos">
      <div className="flex flex-col gap-3 pb-2">
        <div>
          <label htmlFor="poll-question" className="text-[12px] font-semibold mb-1 block" style={{ color: "var(--text-3)" }}>Pregunta</label>
          <input
            id="poll-question"
            className="field-input w-full" placeholder="¿Qué quieres preguntar?"
            value={question} onChange={(e) => setQuestion(e.target.value)}
            maxLength={200} autoFocus
          />
        </div>

        <div>
          <label className="text-[12px] font-semibold mb-1 block" style={{ color: "var(--text-3)" }}>Opciones</label>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="field-input flex-1" placeholder={`Opción ${i + 1}`}
                  value={opt} onChange={(e) => updateOption(i, e.target.value)}
                  maxLength={80}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    aria-label={`Quitar opción ${i + 1}`}
                    className="shrink-0 h-8 w-8 grid place-items-center rounded-full transition-colors hover:bg-hover"
                    style={{ color: "var(--text-3)" }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button
              onClick={addOption}
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              <Icon name="plus" size={14} /> Agregar opción
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-[12px] px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
          <div>
            <p className="text-[12.5px] font-semibold">Permitir varias respuestas</p>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {multipleChoice ? "Cada persona puede marcar varias opciones" : "Cada persona elige solo una opción"}
            </p>
          </div>
          <Switch checked={multipleChoice} onChange={() => setMultipleChoice((v) => !v)} />
        </div>

        <button
          className="btn-primary w-full h-10 text-[13.5px] font-bold mt-1"
          disabled={creating || !question.trim() || options.filter((o) => o.trim()).length < 2}
          onClick={crear}
        >
          {creating ? "Creando…" : "Crear encuesta"}
        </button>
      </div>
    </Sheet>
  );
}
