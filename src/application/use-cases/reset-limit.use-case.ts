import { policyProviderPort } from "@application/ports/policy-provider.port";
import { RatelimitStorePort } from "@application/ports/rate-limit-store.port";
import {
  InvalidRateLimitKeyError,
  PolicyNotFoundError,
} from "@domain/errors/domain.errors";

export interface ResetLimitInput {
  key: string;
  policyName: string;
}

export class ResetLimitUseCase {
  constructor(
    private readonly store: RatelimitStorePort,
    private readonly policies: policyProviderPort,
  ) {}

  async execute(input: ResetLimitInput): Promise<{ success: boolean }> {
    if (!input.key || input.key.trim().length === 0) {
      throw new InvalidRateLimitKeyError(input.key);
    }

    const policy = this.policies.getPolicy(input.policyName);
    if (!policy) {
      throw new PolicyNotFoundError(input.policyName);
    }

    await this.store.reset(input.key, policy);
    return { success: true };
  }
}
