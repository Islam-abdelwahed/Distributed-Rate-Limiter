import {
  AlgorithmType,
  RateLimitPolicy,
} from "@domain/entities/rate-limit-algorithm.entity";

export interface RateLimitDecision<TState> {
  allowed: boolean;
  remaining: number;
  resetAtUnix: number;
  retryAfterMs: number;
  nextState: TState;
}

export interface RateLimitAlgorithm<TState = unknown> {
  readonly type: AlgorithmType;

  evaluate(
    state: TState | null,
    policy: RateLimitPolicy,
    nowMs: number,
    cost: number,
  ): RateLimitDecision<TState>;

  initialState(policy: RateLimitPolicy, nowMs: number): TState;
}
