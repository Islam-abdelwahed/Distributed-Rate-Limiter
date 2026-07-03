export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PolicyNotFoundError extends DomainError {
  constructor(policyName: string) {
    super(`Policy "${policyName}" is not configured`);
  }
}

export class InvalidRateLimitKeyError extends DomainError {
  constructor(key: string) {
    super(`Invalid rate limit key: "${key}"`);
  }
}

export class StoreUnavailableError extends DomainError {
  constructor(cause?: string) {
    super(`Rate limit store is unavailable${cause ? `: ${cause}` : ''}`);
  }
}