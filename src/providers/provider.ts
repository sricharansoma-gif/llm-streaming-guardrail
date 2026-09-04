export interface LlmProvider {
  stream(prompt: string): AsyncIterable<string>;
}
