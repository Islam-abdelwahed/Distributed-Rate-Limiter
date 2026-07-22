import { policyProviderPort } from "@application/ports/policy-provider.port";
import { RatelimitStorePort } from "@application/ports/rate-limit-store.port";
import {
  InvalidRateLimitKeyError,
  PolicyNotFoundError,
} from "@domain/errors/domain.errors";

export interface GetLimitStatusInput {
  key: string;
  policyName: string;
}

export interface GetLimitStatusOutput {
  remaining: number;
  limit: number;
  resetAtUnix: number;
  algorithmUsed: string;
}

export class GetLimitStatusUseCase {
  constructor(
    private readonly store: RatelimitStorePort,
    private readonly policies: policyProviderPort,
  ) {}

  async execute(input: GetLimitStatusInput): Promise<GetLimitStatusOutput> {
    if (!input.key || input.key.trim().length === 0) {
      throw new InvalidRateLimitKeyError(input.key);
    }
    const policy = this.policies.getPolicy(input.policyName);
    if (!policy) {
      throw new PolicyNotFoundError(input.policyName);
    }
    const decision = await this.store.peek(input.key, policy);

    return {
      remaining: decision ? decision.remaining : policy.limit,
      algorithmUsed: policy.algorithm,
      resetAtUnix: decision
        ? decision.resetAtUnix
        : Math.ceil(Date.now() / 1000) + policy.windowSeconds,
      limit: policy.limit,
    };
  }
}
