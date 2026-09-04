import { detectPii, redactPii } from "../pii/index.js";

export interface StreamingPiiGuardrailOptions {
  holdbackCharacters?: number;
}

const defaultHoldbackCharacters = 256;

export async function* streamWithPiiGuardrail(
  source: AsyncIterable<string>,
  options: StreamingPiiGuardrailOptions = {},
): AsyncGenerator<string> {
  const holdbackCharacters =
    options.holdbackCharacters ?? defaultHoldbackCharacters;

  if (!Number.isSafeInteger(holdbackCharacters) || holdbackCharacters < 1) {
    throw new RangeError("holdbackCharacters must be a positive integer");
  }

  let buffer = "";

  for await (const chunk of source) {
    buffer += chunk;

    if (buffer.length <= holdbackCharacters) {
      continue;
    }

    let emitThrough = buffer.length - holdbackCharacters;

    for (const match of detectPii(buffer)) {
      if (match.start < emitThrough && match.end > emitThrough) {
        emitThrough = match.start;
        break;
      }
    }

    if (emitThrough === 0) {
      continue;
    }

    const safeChunk = redactPii(buffer.slice(0, emitThrough));
    buffer = buffer.slice(emitThrough);

    if (safeChunk.length > 0) {
      yield safeChunk;
    }
  }

  if (buffer.length > 0) {
    yield redactPii(buffer);
  }
}
