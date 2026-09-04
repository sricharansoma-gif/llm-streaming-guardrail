import { describe, expect, it } from "vitest";

import { detectPii, redactPii } from "../src/pii/index.js";

describe("PII redaction", () => {
  it("redacts a single email address", () => {
    const text = "Contact user@example.test for help.";

    expect(detectPii(text).map(({ type }) => type)).toEqual(["email"]);
    expect(redactPii(text)).toBe("Contact [REDACTED] for help.");
  });

  it("redacts a single SSN", () => {
    const text = "Synthetic SSN: 123-45-6789.";

    expect(detectPii(text).map(({ type }) => type)).toEqual(["ssn"]);
    expect(redactPii(text)).toBe("Synthetic SSN: [REDACTED].");
  });

  it("redacts a credit-card-like number without separators", () => {
    expect(redactPii("Card: 4111111111111111.")).toBe(
      "Card: [REDACTED].",
    );
  });

  it("redacts a credit-card-like number with spaces", () => {
    expect(redactPii("Card: 4111 1111 1111 1111.")).toBe(
      "Card: [REDACTED].",
    );
  });

  it("redacts a credit-card-like number with hyphens", () => {
    expect(redactPii("Card: 4111-1111-1111-1111.")).toBe(
      "Card: [REDACTED].",
    );
  });

  it("redacts multiple PII values in one string", () => {
    const text =
      "Email user@example.test, SSN 123-45-6789, card 4111 1111 1111 1111.";

    expect(redactPii(text)).toBe(
      "Email [REDACTED], SSN [REDACTED], card [REDACTED].",
    );
  });

  it("leaves text containing no PII unchanged", () => {
    const text = "This synthetic message has no sensitive values.";

    expect(detectPii(text)).toEqual([]);
    expect(redactPii(text)).toBe(text);
  });
});
