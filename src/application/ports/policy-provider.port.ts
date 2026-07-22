import { RateLimitPolicy } from "@domain/entities/rate-limit-policy.entity";

export interface policyProviderPort {
  getPolicy(name: string): RateLimitPolicy | undefined;

  listPolicies(): RateLimitPolicy[];
}
