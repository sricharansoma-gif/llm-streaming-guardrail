import express from "express";

import { streamWithPiiGuardrail } from "./gateway/index.js";
import { MockProvider } from "./providers/mockProvider.js";
import type { LlmProvider } from "./providers/provider.js";

export function createApp(provider: LlmProvider = new MockProvider()) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/v1/generate", async (request, response) => {
    const prompt = (request.body as { prompt?: unknown } | undefined)?.prompt;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      response.status(400).json({ error: "prompt must be a non-empty string" });
      return;
    }

    response.status(200);
    response.set({
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    });

    let clientDisconnected = false;
    const handleClose = (): void => {
      clientDisconnected = !response.writableEnded;
    };

    response.once("close", handleClose);

    try {
      const providerStream = provider.stream(prompt);

      for await (const safeChunk of streamWithPiiGuardrail(providerStream)) {
        if (clientDisconnected || response.destroyed) {
          break;
        }

        response.write(safeChunk);
      }

      if (!clientDisconnected && !response.destroyed) {
        response.end();
      }
    } catch {
      if (clientDisconnected || response.destroyed) {
        return;
      }

      if (response.headersSent) {
        response.end();
        return;
      }

      response.status(500).json({ error: "generation failed" });
    } finally {
      response.off("close", handleClose);
    }
  });

  return app;
}

export const app = createApp();
