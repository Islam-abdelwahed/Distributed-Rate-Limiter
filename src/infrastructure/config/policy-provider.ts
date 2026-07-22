import { policyProviderPort } from "@application/ports/policy-provider.port";
import {
  AlgorithmType,
  RateLimitPolicy,
} from "@domain/entities/rate-limit-policy.entity";
import { logger } from "@infrastructure/logger/logger";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const policyFileSchema = z.array(
  z.object({
    name: z.string().min(1),
    algorithm: z.enum([
      "TOKEN_BUCKET",
      "SLIDING_WINDOW_COUNTER",
      "LEAKY_BUCKET",
    ]),
    limit: z.number().int().positive(),
    windowSeconds: z.number().int().positive(),
    refillRate: z.number().int().positive().optional(),
    leakRate: z.number().int().positive().optional(),
  }),
);

export class StaticFilePolicyProvider implements policyProviderPort {
  private readonly policies = new Map<string, RateLimitPolicy>();
  constructor(filePath: string) {
    this.load(filePath);
  }

  private load(filePath: string) {
    if (!existsSync(filePath)) {
      logger.warn(
        { filePath },
        "Policies file not found — starting with an empty policy set. Use ResetLimit/CheckLimit with a defined policy name once created.",
      );
      return;
    }

    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    const parsed = policyFileSchema.parse(raw);

    for (const p of parsed) {
      const policy = new RateLimitPolicy({
        name: p.name,
        algorithm: p.algorithm as AlgorithmType,
        limit: p.limit,
        windowSeconds: p.windowSeconds,
        refillRate: p.refillRate,
        leakRate: p.leakRate,
      });
      this.policies.set(policy.name, policy);
    }
    logger.info({ count: this.policies.size, filePath }, "Policies loaded");
  }

  getPolicy(name: string): RateLimitPolicy | undefined {
    return this.policies.get(name);
  }
  
  listPolicies(): RateLimitPolicy[] {
    return Array.from(this.policies.values());
  }
}
