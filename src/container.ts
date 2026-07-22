import { CheckRateLimitUseCase } from "@application/use-cases/check-rate-limit.use-case";
import { GetLimitStatusUseCase } from "@application/use-cases/get-limit-status.use-case";
import { ResetLimitUseCase } from "@application/use-cases/reset-limit.use-case";
import { env } from "@infrastructure/config/config";
import { StaticFilePolicyProvider } from "@infrastructure/config/policy-provider";
import { createRedisClient } from "@infrastructure/redis/redis-client";
import { RedisRateLimitStore } from "@infrastructure/redis/redis-rate-limit-store.adapter";
import { GrpcServerDeps } from "@interface/grpc/server";
import { isAbsolute, join } from "node:path";

export interface Container extends GrpcServerDeps {
  shutdown: () => Promise<void>;
}

export function buildContainer(): Container {
  const redis = createRedisClient(env.REDIS_URL);
  const store = new RedisRateLimitStore(redis, {
    keyPrefix: env.REDIS_KEY_PREFIX,
  });

  const policiesPath = isAbsolute(env.POLICIES_FILE)
    ? env.POLICIES_FILE
    : join(process.cwd(), env.POLICIES_FILE);

  const policyProvider = new StaticFilePolicyProvider(policiesPath);

  const checkRateLimitUseCase = new CheckRateLimitUseCase(
    store,
    policyProvider,
  );
  const resetLimitUseCase = new ResetLimitUseCase(store, policyProvider);
  const getLimitStatusUseCase = new GetLimitStatusUseCase(
    store,
    policyProvider,
  );

  return {
    checkRateLimitUseCase,
    resetLimitUseCase,
    getLimitStatusUseCase,
    isReady: ()=> store.ping(),
    shutdown: async () => {},
  };
}
