import { env } from "@infrastructure/config/config";
import pino from "pino";

const isDev = env.NODE !== "production";

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});
