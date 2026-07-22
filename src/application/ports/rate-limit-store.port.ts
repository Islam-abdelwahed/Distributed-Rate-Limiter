import { RateLimitDecision } from "@domain/algorithms";
import { RateLimitPolicy } from "@domain/entities/rate-limit-policy.entity";

export interface RatelimitStorePort {
  checkAndConsume(
    key: string,
    policy: RateLimitPolicy,
    cost: number,
  ): Promise<RateLimitDecision<unknown>>;

  /** Reads current state without consuming, for status queries. */
  peek(
    key: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision<unknown>> | null;

  /** Clears all state for a key+policy. */

  reset(key: string, policy: RateLimitPolicy): Promise<void>;

  /** Health check for the underlying store connection. */
  ping(): Promise<boolean>;
}
