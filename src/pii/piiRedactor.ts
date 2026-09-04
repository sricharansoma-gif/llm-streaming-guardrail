export type PiiType = "email" | "ssn" | "creditCard";

export interface PiiMatch {
  type: PiiType;
  value: string;
  start: number;
  end: number;
}

const patterns: ReadonlyArray<{
  type: PiiType;
  pattern: RegExp;
}> = [
  {
    type: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: "ssn",
    pattern: /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g,
  },
  {
    type: "creditCard",
    pattern: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
  },
];

const placeholders: Record<PiiType, string> = {
  email: "[REDACTED]",
  ssn: "[REDACTED]",
  creditCard: "[REDACTED]",
};

export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const { type, pattern } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      const start = match.index;

      matches.push({
        type,
        value,
        start,
        end: start + value.length,
      });
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

export function redactPii(text: string): string {
  const matches = detectPii(text);
  let result = "";
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }

    result += text.slice(cursor, match.start);
    result += placeholders[match.type];
    cursor = match.end;
  }

  return result + text.slice(cursor);
}
