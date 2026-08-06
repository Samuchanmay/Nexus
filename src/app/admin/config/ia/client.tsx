"use client";
import { useState } from "react";
import { Icon } from "@/components/os/icons";
import { useToast } from "@/components/ui";

type AIConfig = {
  ai_openai_api_key: string;
  ai_openai_model: string;
  ai_openai_embeddings_model: string;
  ai_anthropic_api_key: string;
  ai_anthropic_model: string;
  ai_openrouter_api_key: string;
  ai_openrouter_model: string;
  ai_provider: "openai" | "anthropic" | "openrouter";
};

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "sparkle", desc: "GPT-4, GPT-3.5, embeddings" },
  { id: "anthropic", name: "Anthropic", icon: "brain", desc: "Claude 3.5 Sonnet, Claude 3 Opus" },
  { id: "openrouter", name: "OpenRouter", icon: "layers", desc: "Proxy unificado (múltiples modelos)" },
];

const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o (recomendado)" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (rápido y económico)" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo (económico)" },
];

const ANTHROPIC_MODELS = [
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (recomendado)" },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus (más potente)" },
  { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (rápido)" },
];

export default function AIConfigClient({ initialConfig }: { initialConfig: AIConfig }) {
  const [config, setConfig] = useState<AIConfig>(initialConfig);
  const [saving, setSaving] = useState<string | null>(null);
  const toast = useToast();

  const updateConfig = async (key: keyof AIConfig, value: string) => {
    setSaving(key);
    setConfig((prev) => ({ ...prev, [key]: value }));
    
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      
      toast("Configuración guardada", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar", "danger");
      // Revertir en caso de error
      setConfig((prev) => ({ ...prev, [key]: initialConfig[key] }));
    } finally {
      setSaving(null);
    }
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      {/* Provider activo */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface-2)" }}>
        <h3 className="text-[15px] font-bold text-text-1 mb-3">Proveedor activo</h3>
        <p className="text-[13px] text-text-2 mb-4">
          Qué proveedor de IA se usa para resúmenes de conversación y búsqueda semántica.
        </p>
        <div className="grid gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => updateConfig("ai_provider", p.id)}
              disabled={saving === "ai_provider"}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
              style={{
                background: config.ai_provider === p.id ? "var(--accent-tint)" : "var(--surface)",
                border: config.ai_provider === p.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                opacity: saving === "ai_provider" ? 0.6 : 1,
              }}
            >
              <Icon name={p.icon} size={18} style={{ color: config.ai_provider === p.id ? "var(--accent)" : "var(--text-3)" }} />
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold" style={{ color: config.ai_provider === p.id ? "var(--accent)" : "var(--text-1)" }}>
                  {p.name}
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{p.desc}</p>
              </div>
              {config.ai_provider === p.id && (
                <Icon name="check" size={16} style={{ color: "var(--accent)" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* OpenAI */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="sparkle" size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-[15px] font-bold text-text-1">OpenAI</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="ai-openai-key" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">API Key</label>
            <input
              id="ai-openai-key"
              type="password"
              value={config.ai_openai_api_key}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai_openai_api_key: e.target.value }))}
              onBlur={(e) => {
                if (e.target.value !== initialConfig.ai_openai_api_key) {
                  updateConfig("ai_openai_api_key", e.target.value);
                }
              }}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={saving === "ai_openai_api_key"}
            />
            {config.ai_openai_api_key && (
              <p className="text-[11px] text-text-3 mt-1">
                Guardada: {maskKey(config.ai_openai_api_key)}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ai-openai-summary-model" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">Modelo para resúmenes</label>
            <select
              id="ai-openai-summary-model"
              value={config.ai_openai_model}
              onChange={(e) => updateConfig("ai_openai_model", e.target.value)}
              disabled={saving === "ai_openai_model"}
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {OPENAI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ai-openai-embeddings-model" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">Modelo para embeddings</label>
            <select
              id="ai-openai-embeddings-model"
              value={config.ai_openai_embeddings_model}
              onChange={(e) => updateConfig("ai_openai_embeddings_model", e.target.value)}
              disabled={saving === "ai_openai_embeddings_model"}
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="text-embedding-3-small">text-embedding-3-small (recomendado)</option>
              <option value="text-embedding-3-large">text-embedding-3-large (más preciso)</option>
              <option value="text-embedding-ada-002">text-embedding-ada-002 (legacy)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Anthropic */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="brain" size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-[15px] font-bold text-text-1">Anthropic</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="ai-anthropic-key" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">API Key</label>
            <input
              id="ai-anthropic-key"
              type="password"
              value={config.ai_anthropic_api_key}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai_anthropic_api_key: e.target.value }))}
              onBlur={(e) => {
                if (e.target.value !== initialConfig.ai_anthropic_api_key) {
                  updateConfig("ai_anthropic_api_key", e.target.value);
                }
              }}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={saving === "ai_anthropic_api_key"}
            />
            {config.ai_anthropic_api_key && (
              <p className="text-[11px] text-text-3 mt-1">
                Guardada: {maskKey(config.ai_anthropic_api_key)}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ai-anthropic-summary-model" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">Modelo para resúmenes</label>
            <select
              id="ai-anthropic-summary-model"
              value={config.ai_anthropic_model}
              onChange={(e) => updateConfig("ai_anthropic_model", e.target.value)}
              disabled={saving === "ai_anthropic_model"}
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {ANTHROPIC_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* OpenRouter */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="layers" size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-[15px] font-bold text-text-1">OpenRouter</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="ai-openrouter-key" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">API Key</label>
            <input
              id="ai-openrouter-key"
              type="password"
              value={config.ai_openrouter_api_key}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai_openrouter_api_key: e.target.value }))}
              onBlur={(e) => {
                if (e.target.value !== initialConfig.ai_openrouter_api_key) {
                  updateConfig("ai_openrouter_api_key", e.target.value);
                }
              }}
              placeholder="sk-or-..."
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={saving === "ai_openrouter_api_key"}
            />
            {config.ai_openrouter_api_key && (
              <p className="text-[11px] text-text-3 mt-1">
                Guardada: {maskKey(config.ai_openrouter_api_key)}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ai-openrouter-model" className="text-[12.5px] font-semibold text-text-2 mb-1.5 block">Modelo</label>
            <input
              id="ai-openrouter-model"
              type="text"
              value={config.ai_openrouter_model}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai_openrouter_model: e.target.value }))}
              onBlur={(e) => {
                if (e.target.value !== initialConfig.ai_openrouter_model) {
                  updateConfig("ai_openrouter_model", e.target.value);
                }
              }}
              placeholder="openai/gpt-4o-mini"
              className="w-full px-3 py-2 rounded-lg text-[13.5px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={saving === "ai_openrouter_model"}
            />
            <p className="text-[11px] text-text-3 mt-1">
              Ver modelos disponibles en openrouter.ai/models
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl p-4 border border-border" style={{ background: "var(--surface)" }}>
        <div className="flex items-start gap-3">
          <Icon name="info" size={16} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 2 }} />
          <div className="text-[12.5px] text-text-2 space-y-1">
            <p className="font-semibold text-text-1">¿Cómo funciona?</p>
            <p>Las API keys se guardan cifradas en la base de datos. Solo los administradores pueden verlas y modificarlas.</p>
            <p>Si no configuras una API key, las features de IA (resúmenes, búsqueda semántica) simplemente no estarán disponibles, pero el resto del chat funciona normalmente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
