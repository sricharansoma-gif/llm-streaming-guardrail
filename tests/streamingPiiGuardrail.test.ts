import { describe, expect, it } from "vitest";

import { streamWithPiiGuardrail } from "../src/gateway/index.js";

async function* streamChunks(chunks: readonly string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collectStream(
  chunks: readonly string[],
): Promise<{ chunks: string[]; text: string }> {
  const emittedChunks: string[] = [];

  for await (const chunk of streamWithPiiGuardrail(streamChunks(chunks))) {
    emittedChunks.push(chunk);
  }

  return { chunks: emittedChunks, text: emittedChunks.join("") };
}

describe("streamWithPiiGuardrail", () => {
  it("redacts an email split across streaming chunks", async () => {
    const result = await collectStream([
      "Contact user@exa",
      "mple.test for help.",
    ]);

    expect(result.text).toBe("Contact [REDACTED] for help.");
  });

  it("redacts an SSN split across streaming chunks", async () => {
    const result = await collectStream(["SSN: 123-45", "-6789."]);

    expect(result.text).toBe("SSN: [REDACTED].");
  });

  it("redacts a credit-card-like number split across streaming chunks", async () => {
    const result = await collectStream(["Card: 4111-1111-", "1111-1111."]);

    expect(result.text).toBe("Card: [REDACTED].");
  });

  it("redacts multiple PII values spread across streaming chunks", async () => {
    const result = await collectStream([
      "Email user@exa",
      "mple.test, SSN 123-",
      "45-6789, card 4111 1111 ",
      "1111 1111.",
    ]);

    expect(result.text).toBe(
      "Email [REDACTED], SSN [REDACTED], card [REDACTED].",
    );
  });

  it("safely flushes final buffered content", async () => {
    const result = await collectStream(["Final email: final@example.test"]);

    expect(result.chunks).toEqual(["Final email: [REDACTED]"]);
    expect(result.text).toBe("Final email: [REDACTED]");
  });

  it("never yields a completed raw PII value", async () => {
    const rawEmail = "user@example.test";
    const rawSsn = "123-45-6789";
    const rawCard = "4111-1111-1111-1111";
    const prefix = "safe ".repeat(60);
    const result = await collectStream([
      `${prefix}Email user@exa`,
      "mple.test, SSN 123-45-",
      "6789, card 4111-1111-",
      "1111-1111.",
    ]);

    expect(result.text).toBe(
      `${prefix}Email [REDACTED], SSN [REDACTED], card [REDACTED].`,
    );

    for (const chunk of result.chunks) {
      expect(chunk).not.toContain(rawEmail);
      expect(chunk).not.toContain(rawSsn);
      expect(chunk).not.toContain(rawCard);
    }
  });
});
