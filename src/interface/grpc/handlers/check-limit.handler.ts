import * as grpc from '@grpc/grpc-js';
import { CheckRateLimitUseCase } from '../../../application/use-cases/check-rate-limit.use-case';
import { ResetLimitUseCase } from '../../../application/use-cases/reset-limit.use-case';
import { GetLimitStatusUseCase } from '../../../application/use-cases/get-limit-status.use-case';
import { PolicyNotFoundError, InvalidRateLimitKeyError, StoreUnavailableError } from '../../../domain/errors/domain.errors';
import { logger } from '../../../infrastructure/logger/logger';

interface CheckLimitRequestBody {
  key: string;
  policy_name: string;
  cost: number;
}
interface ResetLimitRequestBody {
  key: string;
  policy_name: string;
}
interface GetStatusRequestBody {
  key: string;
  policy_name: string;
}

function mapDomainErrorToGrpcStatus(err: unknown): grpc.ServiceError {
  if (err instanceof PolicyNotFoundError) {
    return Object.assign(new Error(err.message), { code: grpc.status.NOT_FOUND }) as grpc.ServiceError;
  }
  if (err instanceof InvalidRateLimitKeyError) {
    return Object.assign(new Error(err.message), { code: grpc.status.INVALID_ARGUMENT }) as grpc.ServiceError;
  }
  if (err instanceof StoreUnavailableError) {
    return Object.assign(new Error(err.message), { code: grpc.status.UNAVAILABLE }) as grpc.ServiceError;
  }
  const message = err instanceof Error ? err.message : 'internal error';
  return Object.assign(new Error(message), { code: grpc.status.INTERNAL }) as grpc.ServiceError;
}

function invalidArgument(message: string): grpc.ServiceError {
  return Object.assign(new Error(message), { code: grpc.status.INVALID_ARGUMENT }) as grpc.ServiceError;
}

function requirePolicyName(policyName: unknown, rawRequest: unknown): asserts policyName is string {
  if (typeof policyName !== 'string' || policyName.trim().length === 0) {
    logger.error({ rawRequest }, 'Received request with missing/invalid policy_name');
    throw invalidArgument(
      `policy_name is required and must be a non-empty string (received: ${JSON.stringify(policyName)}). ` +
        'This usually means the client and server proto definitions or field casing (snake_case vs camelCase) are out of sync.',
    );
  }
}

export function createCheckLimitHandler(useCase: CheckRateLimitUseCase) {
  return async (
    call: grpc.ServerUnaryCall<CheckLimitRequestBody, unknown>,
    callback: grpc.sendUnaryData<unknown>,
  ): Promise<void> => {
    try {
      requirePolicyName(call.request.policy_name, call.request);

      const result = await useCase.execute({
        key: call.request.key,
        policyName: call.request.policy_name,
        cost: call.request.cost,
      });

      if (!result.allowed) {
        logger.info({ key: call.request.key, policy: call.request.policy_name }, 'Rate limit exceeded');
      }

      callback(null, {
        allowed: result.allowed,
        remaining: result.remaining,
        reset_at_unix: result.resetAtUnix,
        algorithm_used: result.algorithmUsed,
        retry_after_ms: result.retryAfterMs,
      });
    } catch (err) {
      const grpcErr = (err as grpc.ServiceError).code ? (err as grpc.ServiceError) : mapDomainErrorToGrpcStatus(err);
      callback(grpcErr, null);
    }
  };
}

export function createResetLimitHandler(useCase: ResetLimitUseCase) {
  return async (
    call: grpc.ServerUnaryCall<ResetLimitRequestBody, unknown>,
    callback: grpc.sendUnaryData<unknown>,
  ): Promise<void> => {
    try {
      requirePolicyName(call.request.policy_name, call.request);
      const result = await useCase.execute({ key: call.request.key, policyName: call.request.policy_name });
      callback(null, { success: result.success });
    } catch (err) {
      const grpcErr = (err as grpc.ServiceError).code ? (err as grpc.ServiceError) : mapDomainErrorToGrpcStatus(err);
      callback(grpcErr, null);
    }
  };
}

export function createGetStatusHandler(useCase: GetLimitStatusUseCase) {
  return async (
    call: grpc.ServerUnaryCall<GetStatusRequestBody, unknown>,
    callback: grpc.sendUnaryData<unknown>,
  ): Promise<void> => {
    try {
      requirePolicyName(call.request.policy_name, call.request);
      const result = await useCase.execute({ key: call.request.key, policyName: call.request.policy_name });
      callback(null, {
        remaining: result.remaining,
        limit: result.limit,
        reset_at_unix: result.resetAtUnix,
        algorithm_used: result.algorithmUsed,
      });
    } catch (err) {
      const grpcErr = (err as grpc.ServiceError).code ? (err as grpc.ServiceError) : mapDomainErrorToGrpcStatus(err);
      callback(grpcErr, null);
    }
  };
}