export type AlgorithmType =
  "TOKEN_BUCKET" | "SLIDING_WINDOW_COUNTER" | "LEAKY_BUCKET";

/**
 * A RateLimitPolicy is a pure value object describing the rules for a
 * given policy name. It carries no behavior — the behavior lives in the
 * algorithm implementations that consume it.
 */
export class RateLimitPolicy {
  readonly name: string;
  readonly algorithm: AlgorithmType;
  readonly limit: number; // capacity: max tokens / max requests per window / bucket capacity
  readonly windowSeconds: number; // window size (sliding window) or refill period (token bucket / leaky bucket)
  readonly refillRate: number; // tokens added per windowSeconds (token bucket)
  readonly leakRate: number; // requests drained per windowSeconds (leaky bucket)

  constructor(params: {
    name: string;
    algorithm: AlgorithmType;
    limit: number;
    windowSeconds: number;
    refillRate?: number;
    leakRate?: number;
  }) {
    if (!params.name || params.name.trim().length === 0) {
      throw new Error("RateLimitPolicy: name is required");
    }

    if (params.limit <= 0) {
      throw new Error(`RateLimitPolicy "${params.name}": limit must be > 0`);
    }

    if (params.windowSeconds <= 0) {
      throw new Error(
        `RateLimitPolicy "${params.name}": windowSeconds must be > 0`,
      );
    }
    this.name = params.name;
    this.algorithm = params.algorithm;
    this.leakRate = params.leakRate ?? params.limit;
    this.refillRate = params.refillRate ?? params.limit;
    this.limit = params.limit;
    this.windowSeconds = params.windowSeconds;
  }
}
