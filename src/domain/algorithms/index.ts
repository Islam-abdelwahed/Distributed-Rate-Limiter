import { AlgorithmType } from "@domain/entities/rate-limit-policy.entity";
import { RateLimitAlgorithm } from "./rate-limit-algorithm.interface";
import { TokenBucketAlgorithm } from "./token-bucket.algorithm";
import { SLidingWindowAlgorithm } from "./sliding-window.algorithm";
import { LeakyBucketAlgorithm } from "./leaky-bucket.algorithm";

export * from "./rate-limit-algorithm.interface";
export * from "./token-bucket.algorithm";
export * from "./sliding-window.algorithm";
export * from "./leaky-bucket.algorithm";

const registry: Record<AlgorithmType, RateLimitAlgorithm<unknown>> = {
  TOKEN_BUCKET: new TokenBucketAlgorithm(),
  SLIDING_WINDOW_COUNTER: new SLidingWindowAlgorithm(),
  LEAKY_BUCKET: new LeakyBucketAlgorithm(),
};

export function getAlgorithm(type: AlgorithmType): RateLimitAlgorithm<unknown> {
  const algorithm = registry[type];
  if (!algorithm) {
    throw new Error(`Unknown algorithm type: ${type}`);
  }
  return algorithm;
}
