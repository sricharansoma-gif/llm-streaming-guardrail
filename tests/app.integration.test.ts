import { describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { LlmProvider } from "../src/providers/provider.js";

class ChunkProvider implements LlmProvider {
  constructor(private readonly chunks: readonly string[]) {}

  async *stream(): AsyncGenerator<string> {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }
}

class FailingProvider implements LlmProvider {
  async *stream(): AsyncGenerator<string> {
    throw new Error("provider secret stack detail");
  }
}

describe("HTTP streaming gateway", () => {
  it("returns health status", async () => {
    const response = await request(createApp(new ChunkProvider([]))).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("rejects an empty prompt", async () => {
    const response = await request(createApp(new ChunkProvider([])))
      .post("/v1/generate")
      .send({ prompt: "   " });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "prompt must be a non-empty string" });
  });

  it("redacts PII split across provider chunks before the HTTP response reaches the client", async () => {
    const rawEmail = "user@example.test";
    const rawSsn = "123-45-6789";
    const rawCard = "4111-1111-1111-1111";
    const provider = new ChunkProvider([
      "Email user@exa",
      "mple.test, SSN 123-45-",
      "6789, Card 4111-1111-",
      "1111-1111.",
    ]);

    const response = await request(createApp(provider))
      .post("/v1/generate")
      .send({ prompt: "test" });

    expect(response.status).toBe(200);
    expect(response.text).toBe(
      "Email [REDACTED], SSN [REDACTED], Card [REDACTED].",
    );
    expect(response.text).not.toContain(rawEmail);
    expect(response.text).not.toContain(rawSsn);
    expect(response.text).not.toContain(rawCard);
  });

  it("returns a generic error without exposing provider details", async () => {
    const response = await request(createApp(new FailingProvider()))
      .post("/v1/generate")
      .send({ prompt: "test" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "generation failed" });
    expect(JSON.stringify(response.body)).not.toContain("provider secret stack detail");
  });
});
