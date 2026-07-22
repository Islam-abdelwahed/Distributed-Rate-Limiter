import { RateLimitPolicy } from '../entities/rate-limit-policy.entity';
import { RateLimitAlgorithm, RateLimitDecision } from './rate-limit-algorithm.interface';

export interface LeakyBucketState {
  level: number;
  lastLeakMs: number;
}

export class LeakyBucketAlgorithm implements RateLimitAlgorithm<LeakyBucketState> {
  readonly type = 'LEAKY_BUCKET' as const;

  initialState(_policy: RateLimitPolicy, nowMs: number): LeakyBucketState {
    return { level: 0, lastLeakMs: nowMs };
  }

  evaluate(
    state: LeakyBucketState | null,
    policy: RateLimitPolicy,
    nowMs: number,
    cost: number,
  ): RateLimitDecision<LeakyBucketState> {
    const effectiveCost = cost;
    const current = state ?? this.initialState(policy, nowMs);
    const leakPerMs = policy.leakRate / (policy.windowSeconds * 1000);

    const elapsedMs = Math.max(0, nowMs - current.lastLeakMs);
    const leaked = elapsedMs * leakPerMs;
    const levelAfterLeak = Math.max(0, current.level - leaked);

    const resetAtUnix = Math.ceil(nowMs / 1000) + policy.windowSeconds;

    if (levelAfterLeak + effectiveCost <= policy.limit) {
      const nextLevel = levelAfterLeak + effectiveCost;
      return {
        allowed: true,
        remaining: Math.floor(policy.limit - nextLevel),
        resetAtUnix,
        retryAfterMs: 0,
        nextState: { level: nextLevel, lastLeakMs: nowMs },
      };
    }
    const overFlow = levelAfterLeak + effectiveCost - policy.limit;
    const retryAfterMs =
      leakPerMs > 0
        ? Math.ceil(overFlow / leakPerMs)
        : policy.windowSeconds * 1000;

    return {
      allowed: false,
      remaining: Math.max(0, Math.floor(policy.limit - levelAfterLeak)),
      resetAtUnix,
      retryAfterMs,
      nextState: { level: levelAfterLeak, lastLeakMs: nowMs },
    };
  }
}
