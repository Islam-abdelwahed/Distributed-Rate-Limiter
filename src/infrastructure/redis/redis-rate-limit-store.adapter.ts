import { RatelimitStorePort } from "@application/ports/rate-limit-store.port";
import { RateLimitDecision } from "@domain/algorithms";
import {
  AlgorithmType,
  RateLimitPolicy,
} from "@domain/entities/rate-limit-policy.entity";
import { StoreUnavailableError } from "@domain/errors/domain.errors";
import { logger } from "@infrastructure/logger/logger";
import type { Redis, Result } from "ioredis";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS_DIR = join(__dirname, "lua-scripts");

const SCRIPT_FILE_BY_ALGORITHM: Record<AlgorithmType, string> = {
  TOKEN_BUCKET: "token-bucket.lua",
  SLIDING_WINDOW_COUNTER: "sliding-window.lua",
  LEAKY_BUCKET: "leaky-bucket.lua",
};

const ARGV_BUILDER: Record<
  AlgorithmType,
  (
    policy: RateLimitPolicy,
    nowMs: number,
    cost: number,
    ttlSeconds: number,
  ) => (string | number)[]
> = {
  TOKEN_BUCKET: (policy, nowMs, cost, ttl) => [
    policy.limit,
    policy.refillRate,
    policy.windowSeconds,
    nowMs,
    cost,
    ttl,
  ],
  SLIDING_WINDOW_COUNTER: (policy, nowMs, cost, ttl) => [
    policy.limit,
    policy.windowSeconds,
    nowMs,
    cost,
    ttl,
  ],
  LEAKY_BUCKET: (policy, nowMs, cost, ttl) => [
    policy.limit,
    policy.leakRate,
    policy.windowSeconds,
    nowMs,
    cost,
    ttl,
  ],
};

type LuaRawResult = [number, string, number, number]; // [allowed, remaining, resetAtUnix, retryAfterMs]

declare module 'ioredis' {
  interface RedisCommander<Context> {
    rlTokenBucket(key: string, ...args: (string | number)[]): Result<LuaRawResult, Context>;
    rlSlidingWindow(key: string, ...args: (string | number)[]): Result<LuaRawResult, Context>;
    rlLeakyBucket(key: string, ...args: (string | number)[]): Result<LuaRawResult, Context>;
  }
}


const COMMAND_NAME_BY_ALGORITHM: Record<
  AlgorithmType,
  "rlTokenBucket" | "rlSlidingWindow" | "rlLeakyBucket"
> = {
  TOKEN_BUCKET: "rlTokenBucket",
  SLIDING_WINDOW_COUNTER: "rlSlidingWindow",
  LEAKY_BUCKET: "rlLeakyBucket",
};

const DEFAULT_KEY_TTL_SECONDS = 60 * 60 * 24;

export class RedisRateLimitStore implements RatelimitStorePort {
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: Redis,
    options?: { keyPrefix?: string },
  ) {
    this.keyPrefix = options?.keyPrefix ?? "rl";
    this.registerScripts();
  }

  private registerScripts(): void {
    for (const [algorithm, filename] of Object.entries(
      SCRIPT_FILE_BY_ALGORITHM,
    ) as [AlgorithmType, string][]) {
      const scriptPath = join(SCRIPTS_DIR, filename);
      const script = readFileSync(scriptPath, "utf-8");
      const commandName = COMMAND_NAME_BY_ALGORITHM[algorithm];

      this.redis.defineCommand(commandName, { numberOfKeys: 1, lua: script });
    }
    logger.info(
      { scripts: Object.keys(SCRIPT_FILE_BY_ALGORITHM) },
      "Rate limit Lua scripts registered",
    );
  }

  private redisKeys(key: string, policy: RateLimitPolicy): string {
    return `${this.keyPrefix}:${policy.name}:${key}`;
  }

  private async runScript(
    key: string,
    policy: RateLimitPolicy,
    cost: number,
  ): Promise<RateLimitDecision<unknown>> {
    const commandName = COMMAND_NAME_BY_ALGORITHM[policy.algorithm];
    const nowMs = Date.now();
    const argv = ARGV_BUILDER[policy.algorithm](
      policy,
      nowMs,
      cost,
      DEFAULT_KEY_TTL_SECONDS,
    );
    const redisKey = this.redisKeys(key, policy);

    try {
      const raw = (await this.redis[commandName](
        redisKey,
        ...argv,
      )) as LuaRawResult;
      const [allowed, remaining, resetAtUnix, retryAfterMs] = raw;
      return {
        allowed: allowed === 1,
        remaining: Math.max(0, Math.floor(Number(remaining))),
        resetAtUnix,
        retryAfterMs,
        nextState: undefined,
      };
    } catch (err) {
      logger.error(
        { err, key: redisKey, algorithm: policy.algorithm },
        "Redis rate limit script execution failed",
      );
      throw new StoreUnavailableError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  checkAndConsume(
    key: string,
    policy: RateLimitPolicy,
    cost: number,
  ): Promise<RateLimitDecision<unknown>> {
    return this.runScript(key, policy, cost);
  }
  peek(
    key: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision<unknown>> | null {
    return this.runScript(key, policy, 0);
  }

  async reset(key: string, policy: RateLimitPolicy): Promise<void> {
    const redisKey = this.redisKeys(key, policy);
    try {
      await this.redis.del(redisKey);
    } catch (err) {
      logger.error({ err, key: redisKey }, "Redis rate limit reset failed");
      throw new StoreUnavailableError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await this.redis.ping();
      return reply === "PONG";
    } catch (err) {
      return false;
    }
  }
}
