import { logger } from "@infrastructure/logger/logger";
import Redis, { RedisOptions } from "ioredis";

export function createRedisClient(url: string, options?: RedisOptions): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 3000);
      logger.warn({ attempt: times, delayMs: delay }, "Redis connection retry");
      return delay;
    },
    reconnectOnError(err) {
      logger.error({ err }, "Redis connection error, will attempt reconnect");
      return true;
    },
    ...options,
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("ready", () => logger.info("Redis ready"));
  client.on("close", () => logger.warn("Redis connection closed"));
  client.on("error", (err) => logger.error({ err }, "Redis client error"));

  return client;
}
