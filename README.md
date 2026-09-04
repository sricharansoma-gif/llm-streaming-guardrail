# LLM Streaming Guardrail

A compact TypeScript and Express gateway that streams LLM output through a PII guardrail before it reaches the client. A provider-independent interface keeps model integrations replaceable; the included mock provider makes the complete flow easy to run and review.

## Architecture

```text
Client
  -> POST /v1/generate
  -> Mock LLM Provider
  -> Streaming PII Guardrail
  -> Safe streamed response
```

The detector recognizes:

- Email addresses
- US Social Security Numbers in `XXX-XX-XXXX` format
- Credit-card-like values containing 13–19 digits, with spaces, hyphens, or no separators

Every detected value is replaced with exactly `[REDACTED]`.

## Streaming safety

The provider returns an `AsyncIterable<string>`. The guardrail consumes those chunks through a rolling buffer, retaining 256 characters by default so PII split across provider chunk boundaries can be recognized. Raw provider chunks are never written directly to the HTTP client: only guardrail output is passed to `res.write()`. At normal completion, the remaining buffer is redacted and flushed.

The holdback window balances latency and safety. A larger window can protect longer boundary-spanning values but delays output; a smaller window reduces latency while providing less look-ahead.

## Setup

```sh
npm install
npm run dev
```

The server listens on port `3000` by default. Set `PORT` to override it.

## API

### `GET /health`

Returns a simple JSON health response:

```json
{
  "status": "ok"
}
```

### `POST /v1/generate`

Accepts JSON containing a non-empty prompt and returns a streamed plain-text response.

```json
{
  "prompt": "hello"
}
```

Normal streaming example:

```sh
curl -N -X POST http://localhost:3000/v1/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"hello"}'
```

Synthetic PII demonstration:

```sh
curl -N -X POST http://localhost:3000/v1/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"pii-demo"}'
```

Expected output:

```text
Email: [REDACTED], SSN: [REDACTED], Card: [REDACTED]
```

The `pii-demo` provider response contains obviously synthetic test values split across chunks. It contains no real personal data.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm audit
```

## Security controls

- JSON request bodies are limited to 16 KB.
- Prompts and generated text are not logged.
- Provider and stream failures return generic errors without internal details.
- Express's `X-Powered-By` header is disabled.
- Raw provider output cannot bypass the streaming guardrail on the generation route.
- `.env`, `node_modules`, `dist`, `coverage`, logs, and `.DS_Store` are ignored by Git.

## Limitations

- Regex-based PII detection is deterministic and easy to test, but it is not exhaustive.
- The fixed holdback window is a practical tradeoff between streaming latency and boundary safety.
- The mock provider is intended for demonstration and can be replaced through the provider interface.
