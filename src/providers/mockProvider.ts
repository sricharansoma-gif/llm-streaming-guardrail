import type { LlmProvider } from "./provider.js";

export interface MockProviderOptions {
  chunks?: readonly string[];
  delayMs?: number;
}

const defaultChunks = [
  "Hello from ",
  "a synthetic ",
  "streamed response.",
] as const;

const piiDemoChunks = [
  "Email: test@exa",
  "mple.com, SSN: 123-45-",
  "6789, Card: 4111 1111 ",
  "1111 1111",
] as const;

export class MockProvider implements LlmProvider {
  private readonly configuredChunks: readonly string[] | undefined;
  private readonly delayMs: number;

  constructor(options: MockProviderOptions = {}) {
    this.configuredChunks = options.chunks;
    this.delayMs = options.delayMs ?? 10;
  }

  async *stream(prompt: string): AsyncGenerator<string> {
    const chunks =
      this.configuredChunks ??
      (prompt === "pii-demo" ? piiDemoChunks : defaultChunks);

    for (const chunk of chunks) {
      if (this.delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
      }

      yield chunk;
    }
  }
}
