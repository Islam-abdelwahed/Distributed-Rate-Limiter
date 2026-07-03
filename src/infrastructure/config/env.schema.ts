import { z } from "zod";

export const envSchema = z.object({
  NODE: z.enum(["development", "production", "test"]).default("development"),
  GRPC_PORT: z.coerce.number().int().positive().default(50051),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    console.error(
      "❌ Invalid environment configuration:",
      z.treeifyError(result.error),
    );
    process.exit(1);
  }

  return result.data;
}
