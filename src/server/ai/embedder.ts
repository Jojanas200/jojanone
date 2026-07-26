// Text embeddings for Jova's memory. Pluggable by design: the default runs a
// local transformer (all-MiniLM-L6-v2, 384-dim) via Transformers.js - no API
// key - but any backend (a hosted embedding API, a Supabase Edge Function) can
// implement Embedder and be swapped in. Everything degrades gracefully: when no
// embedder is available, memory is simply skipped and Jova behaves as before.

export const EMBED_DIMS = 384;

export interface Embedder {
  readonly id: string;
  readonly dims: number;
  /** Cheap check; also warms the model. Never throws. */
  isAvailable(): Promise<boolean>;
  /** Embed one or more texts → unit-normalised vectors of length `dims`. */
  embed(texts: string[]): Promise<number[][]>;
}

class NoopEmbedder implements Embedder {
  readonly id = "noop";
  readonly dims = EMBED_DIMS;
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async embed(): Promise<number[][]> {
    throw new Error("embeddings are not available");
  }
}

/**
 * Local Transformers.js embedder. The package is imported lazily via a variable
 * specifier so the app builds/typechecks without it installed; if it's missing
 * at runtime the import fails and isAvailable() reports false (memory off).
 */
class TransformersEmbedder implements Embedder {
  readonly dims = EMBED_DIMS;
  readonly id: string;
  private readonly model: string;
  private readonly pkg: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipe: Promise<any> | null = null;
  private failed = false;

  constructor() {
    this.model = process.env.JOVA_EMBED_MODEL ?? "Xenova/all-MiniLM-L6-v2";
    this.pkg = process.env.JOVA_EMBED_PACKAGE ?? "@huggingface/transformers";
    this.id = this.model;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private load(): Promise<any> {
    if (!this.pipe) {
      const spec = this.pkg; // variable → not resolved at compile time
      this.pipe = import(spec).then((m) =>
        m.pipeline("feature-extraction", this.model),
      );
    }
    return this.pipe;
  }

  async isAvailable(): Promise<boolean> {
    if (this.failed) return false;
    try {
      await this.load();
      return true;
    } catch {
      this.failed = true;
      this.pipe = null;
      return false;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const pipe = await this.load();
    const out: number[][] = [];
    for (const t of texts) {
      const res = await pipe(t, { pooling: "mean", normalize: true });
      out.push(Array.from(res.data as Float32Array));
    }
    return out;
  }
}

/**
 * Supabase Edge Function embedder (recommended for Vercel). Embeddings are
 * generated at the edge by supabase/functions/embed (gte-small, 384-dim), so
 * the heavy model never runs in the Vercel serverless function. Availability is
 * probed once per process and cached; failures degrade to "memory off".
 */
class EdgeFunctionEmbedder implements Embedder {
  readonly dims = EMBED_DIMS;
  readonly id = "supabase-edge:gte-small";
  private probe: Promise<boolean> | null = null;

  private url(): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const fn = process.env.JOVA_EMBED_FUNCTION ?? "embed";
    return `${base}/functions/v1/${fn}`;
  }
  private key(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  private async call(texts: string[]): Promise<number[][]> {
    const key = this.key();
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key)
      throw new Error("edge embedder not configured");
    const res = await fetch(this.url(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) throw new Error(`embed function ${res.status}`);
    const data = (await res.json()) as { embeddings?: number[][] };
    if (!Array.isArray(data.embeddings))
      throw new Error("embed function returned no embeddings");
    return data.embeddings;
  }

  async isAvailable(): Promise<boolean> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !this.key()) return false;
    if (!this.probe)
      this.probe = this.call(["ok"])
        .then((e) => Array.isArray(e) && e[0]?.length === this.dims)
        .catch(() => false);
    return this.probe;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.call(texts);
  }
}

const NOOP = new NoopEmbedder();
let singleton: Embedder | null = null;
let singletonBackend = "";

/**
 * The active embedder. Backends:
 *   edge  (default) - Supabase Edge Function (supabase/functions/embed)
 *   local           - Transformers.js in-process (JOVA_EMBED_BACKEND=local)
 * Set JOVA_EMBEDDINGS=off to disable memory entirely.
 */
export function getEmbedder(): Embedder {
  if ((process.env.JOVA_EMBEDDINGS ?? "on").toLowerCase() === "off")
    return NOOP;
  const backend = (process.env.JOVA_EMBED_BACKEND ?? "edge").toLowerCase();
  if (!singleton || singletonBackend !== backend) {
    singleton =
      backend === "local"
        ? new TransformersEmbedder()
        : new EdgeFunctionEmbedder();
    singletonBackend = backend;
  }
  return singleton;
}

/** Format a vector for a pgvector literal, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
