import {
  RateLimitPolicy,
} from "@domain/entities/rate-limit-policy.entity";
import {
  RateLimitAlgorithm,
  RateLimitDecision,
} from "./rate-limit-algorithm.interface";

export interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

export class TokenBucketAlgorithm implements RateLimitAlgorithm<TokenBucketState> {
  readonly type = "TOKEN_BUCKET" as const;

  initialState(policy: RateLimitPolicy, nowMs: number): TokenBucketState {
    return { tokens: policy.limit, lastRefillMs: nowMs };
  }

  evaluate(
    state: TokenBucketState | null,
    policy: RateLimitPolicy,
    nowMs: number,
    cost: number,
  ): RateLimitDecision<TokenBucketState> {
    const effectiveCost = cost;
    const current = state ?? this.initialState(policy, nowMs);

    const elapsedMs = Math.max(0, nowMs - current.lastRefillMs);
    const refillPerMs = policy.refillRate / (policy.windowSeconds * 1000);
    const refilled = Math.min(
      policy.limit,
      current.tokens + elapsedMs * refillPerMs,
    );

    const resetAtUnix = Math.ceil(nowMs / 1000) + policy.windowSeconds;

    if (refilled >= effectiveCost) {
      const remainingTokens = refilled - effectiveCost;

      return {
        allowed: true,
        remaining: Math.floor(remainingTokens),
        resetAtUnix,
        retryAfterMs: 0,
        nextState: { tokens: remainingTokens, lastRefillMs: nowMs },
      };
    }

    const deficit = effectiveCost - refilled;
    const retryAfterMs =
      refillPerMs > 0
        ? Math.ceil(deficit / refillPerMs)
        : policy.windowSeconds * 1000;

    return {
      allowed: false,
      remaining: Math.floor(refilled),
      resetAtUnix,
      retryAfterMs,
      nextState: {
        tokens: refilled,
        lastRefillMs: nowMs,
      },
    };
  }
}
