/** Errors raised by provider adapters, with enough context to debug a feed. */
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly url: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderRequestError";
  }
}
