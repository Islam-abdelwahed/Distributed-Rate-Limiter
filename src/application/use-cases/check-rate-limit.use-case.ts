import { policyProviderPort } from "@application/ports/policy-provider.port";
import { RatelimitStorePort } from "@application/ports/rate-limit-store.port";
import { RateLimitDecision } from "@domain/algorithms";
import {
  InvalidRateLimitKeyError,
  PolicyNotFoundError,
} from "@domain/errors/domain.errors";

export interface CheckRateLimitInput {
  key: string;
  policyName: string;
  cost?: number;
}

export interface CheckRateLimitOutput {
  allowed: boolean;
  remaining: number;
  resetAtUnix: number;
  algorithmUsed: string;
  retryAfterMs: number;
}

export class CheckRateLimitUseCase {
  constructor(
    private readonly store: RatelimitStorePort,
    private readonly policies: policyProviderPort,
  ) {}

  async execute(input: CheckRateLimitInput): Promise<CheckRateLimitOutput> {
    if (!input.key || input.key.trim().length === 0) {
      throw new InvalidRateLimitKeyError(input.key);
    }

    const policy = this.policies.getPolicy(input.policyName);
    if (!policy) {
      throw new PolicyNotFoundError(input.policyName);
    }
    const cost = input.cost && input.cost > 0 ? input.cost : 1;
    const decision: RateLimitDecision<unknown> =
      await this.store.checkAndConsume(input.key, policy, cost);

    return {
      allowed: decision.allowed,
      remaining: decision.remaining,
      resetAtUnix: decision.resetAtUnix,
      algorithmUsed: policy.algorithm,
      retryAfterMs: decision.retryAfterMs,
    };
  }
}
