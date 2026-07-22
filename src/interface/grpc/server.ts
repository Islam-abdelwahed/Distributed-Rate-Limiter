import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { join } from "path";
import { CheckRateLimitUseCase } from "../../application/use-cases/check-rate-limit.use-case";
import { ResetLimitUseCase } from "../../application/use-cases/reset-limit.use-case";
import { GetLimitStatusUseCase } from "../../application/use-cases/get-limit-status.use-case";
import {
  createCheckLimitHandler,
  createResetLimitHandler,
  createGetStatusHandler,
} from "./handlers/check-limit.handler";
import { registerHealthService } from "../health/health-check";
import { logger } from "../../infrastructure/logger/logger";

const PROTO_PATH = join(__dirname, "../../../proto/rate_limiter.proto");

export interface GrpcServerDeps {
  checkRateLimitUseCase: CheckRateLimitUseCase;
  resetLimitUseCase: ResetLimitUseCase;
  getLimitStatusUseCase: GetLimitStatusUseCase;
  isReady: () => Promise<boolean>;
}

export function buildGrpcServer(deps: GrpcServerDeps): grpc.Server {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  const server = new grpc.Server();

  server.addService(proto.ratelimiter.RateLimiterService.service, {
    CheckLimit: createCheckLimitHandler(deps.checkRateLimitUseCase),
    ResetLimit: createResetLimitHandler(deps.resetLimitUseCase),
    GetStatus: createGetStatusHandler(deps.getLimitStatusUseCase),
  });

  registerHealthService(server, deps.isReady);

  return server;
}

export function startGrpcServer(
  server: grpc.Server,
  port: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          reject(err);
          return;
        }
        logger.info({ port: boundPort }, "gRPC server listening");
        resolve();
      },
    );
  });
}
