import {
  RateLimitPolicy,
} from "@domain/entities/rate-limit-policy.entity";
import {
  RateLimitAlgorithm,
  RateLimitDecision,
} from "./rate-limit-algorithm.interface";

export interface SlidingWindowState {
  previousCount: number;
  currentCount: number;
  currentWindowStarMs: number;
}

export class SLidingWindowAlgorithm implements RateLimitAlgorithm<SlidingWindowState> {
  readonly type = "SLIDING_WINDOW_COUNTER" as const;

  initialState(policy: RateLimitPolicy, nowMs: number): SlidingWindowState {
    return {
      previousCount: 0,
      currentCount: 0,
      currentWindowStarMs: this.windowStart(nowMs, policy),
    };
  }

  private windowStart(nowMs: number, policy: RateLimitPolicy): number {
    const widowMs = policy.windowSeconds * 1000;
    return Math.floor(nowMs / widowMs) * widowMs;
  }

  evaluate(
    state: SlidingWindowState | null,
    policy: RateLimitPolicy,
    nowMs: number,
    cost: number,
  ): RateLimitDecision<SlidingWindowState> {
    const effectiveCost = cost;
    const windowMs = policy.windowSeconds * 1000;

    const thisWindowStart = this.windowStart(nowMs, policy);

    let current = state ?? this.initialState(policy, nowMs);

    if (current.currentWindowStarMs !== thisWindowStart) {
      const windowsElapsed = Math.round(
        (thisWindowStart - current.currentWindowStarMs) / windowMs,
      );
      if (windowsElapsed === 1) {
        current = {
          previousCount: current.currentCount,
          currentCount: 0,
          currentWindowStarMs: thisWindowStart,
        };
      } else {
        current = {
          previousCount: 0,
          currentCount: 0,
          currentWindowStarMs: thisWindowStart,
        };
      }
    }

    const elapsedInWindowsMs = nowMs - thisWindowStart;
    const weightOfPrevious = Math.max(
      0,
      (windowMs - elapsedInWindowsMs) / windowMs,
    );
    const estimatedCount =
      current.previousCount * weightOfPrevious + current.currentCount;
    const resetAtUnix = Math.ceil((thisWindowStart + windowMs) / 1000);

    if (estimatedCount + effectiveCost <= policy.limit) {
      const nextState: SlidingWindowState = {
        previousCount: current.previousCount,
        currentCount: current.currentWindowStarMs + effectiveCost,
        currentWindowStarMs: thisWindowStart,
      };
      const remaining = Math.max(
        0,
        Math.floor(policy.limit - (estimatedCount + effectiveCost)),
      );

      return {
        allowed: true,
        remaining,
        resetAtUnix,
        retryAfterMs: 0,
        nextState,
      };
    }

    const retryAfterMs = Math.max(0, thisWindowStart + windowMs - nowMs);
    return {
      allowed: false,
      remaining: Math.max(0, Math.floor(policy.limit - estimatedCount)),
      resetAtUnix,
      retryAfterMs,
      nextState: current,
    };
  }
}
