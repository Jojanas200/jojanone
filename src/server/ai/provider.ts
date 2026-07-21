// Pluggable LLM provider. Exactly one provider is active at a time, chosen by
// the AI_PROVIDER env flag ("anthropic" | "openrouter"). Both adapters honour
// the same LlmProvider interface, so the Jova chat flow is provider-independent.
//
// Build-now-key-later: if the active provider has no API key, isAiConfigured()
// is false and Jova falls back to its deterministic findings engine - the app
// runs normally with no model calls.

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  /** "answered" when the model produced text; "refused" on a safety refusal. */
  outcome: "answered" | "refused";
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  generate(req: LlmRequest): Promise<LlmResult>;
}

// --- Anthropic (Claude) ------------------------------------------------------

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-8";

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model: string;

  constructor(modelOverride?: string | null) {
    this.model = modelOverride?.trim() || ANTHROPIC_DEFAULT_MODEL;
  }

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async generate(req: LlmRequest): Promise<LlmResult> {
    // Imported lazily so the SDK never loads unless the provider is used.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const response = await client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      thinking: { type: "adaptive" },
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === "refusal")
      return {
        text: "",
        provider: this.name,
        model: this.model,
        outcome: "refused",
      };

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return {
      text,
      provider: this.name,
      model: this.model,
      outcome: "answered",
    };
  }
}

// --- OpenRouter (OpenAI-compatible HTTP) -------------------------------------
// OpenRouter is provider-neutral; we call it over raw HTTP (no OpenAI SDK).

export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-opus-4.8";

class OpenRouterProvider implements LlmProvider {
  readonly name = "openrouter";
  readonly model: string;

  constructor(modelOverride?: string | null) {
    this.model =
      modelOverride?.trim() ||
      process.env.OPENROUTER_MODEL ||
      OPENROUTER_DEFAULT_MODEL;
  }

  isConfigured() {
    return !!process.env.OPENROUTER_API_KEY;
  }

  async generate(req: LlmRequest): Promise<LlmResult> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: req.system },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok)
      throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    const text = (choice?.message?.content ?? "").trim();
    const outcome =
      choice?.finish_reason === "content_filter" ? "refused" : "answered";
    return { text, provider: this.name, model: this.model, outcome };
  }
}

// "deterministic" is a first-class choice: a provider that is never configured,
// so the Jova flow always falls back to its deterministic findings engine.
class DeterministicProvider implements LlmProvider {
  readonly name = "deterministic";
  readonly model = "none";
  isConfigured() {
    return false;
  }
  async generate(): Promise<LlmResult> {
    return {
      text: "",
      provider: this.name,
      model: this.model,
      outcome: "answered",
    };
  }
}

export const AI_PROVIDERS = [
  "anthropic",
  "openrouter",
  "deterministic",
] as const;
export type AiProviderKey = (typeof AI_PROVIDERS)[number];

/** Build a provider instance for a provider key + optional model override. */
export function providerFor(key: string, model?: string | null): LlmProvider {
  switch (key.toLowerCase()) {
    case "openrouter":
      return new OpenRouterProvider(model);
    case "deterministic":
      return new DeterministicProvider();
    case "anthropic":
    default:
      return new AnthropicProvider(model);
  }
}

/** Env-based provider (fallback when no platform settings are available). */
export function getProvider(): LlmProvider {
  return providerFor(process.env.AI_PROVIDER ?? "anthropic");
}

/**
 * The live active provider, honouring the platform admin's choice (provider +
 * model) from platform_settings, with the env provider as fallback. Imported
 * lazily to avoid a cycle (settings service reads the DB, not the AI layer).
 */
export async function getActiveProvider(): Promise<LlmProvider> {
  try {
    const { getActiveAiConfig } = await import("../services/platform-settings");
    const cfg = await getActiveAiConfig();
    return providerFor(cfg.provider, cfg.model);
  } catch {
    return getProvider();
  }
}

/** True when the active provider has credentials (else deterministic fallback). */
export function isAiConfigured(): boolean {
  return getProvider().isConfigured();
}
