import { buildGrpcServer, startGrpcServer } from "@interface/grpc/server";
import { buildContainer } from "./container";
import { env } from "@infrastructure/config/config";
import { logger } from "@infrastructure/logger/logger";

async function main(): Promise<void> {
  const container = buildContainer();
  const server = buildGrpcServer(container);

  await startGrpcServer(server, env.GRPC_PORT);

  logger.info(
    { env: env.NODE_ENV, port: env.GRPC_PORT },
    "Rate limiter service started",
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");

    server.tryShutdown(async (err) => {
      if (err) {
        logger.error({ err }, "Error during gRPC server shutdown, forcing");
        server.forceShutdown();
      }
      await container.shutdown();
      logger.info("Shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
