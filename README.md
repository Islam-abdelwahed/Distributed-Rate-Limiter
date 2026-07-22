# Distributed Rate Limiter

A scalable, high-performance distributed rate limiting service built with Node.js, TypeScript, gRPC, and Redis. It provides centralized rate-limiting capabilities for microservices architecture with a flexible, policy-driven configuration.

## Features

- **Multiple Algorithms**: Supports multiple rate-limiting algorithms to suit different use cases:
  - Token Bucket
  - Sliding Window Counter
  - Leaky Bucket
- **Fast & Distributed**: Backed by Redis with atomic Lua scripts to guarantee thread safety and fast execution across multiple instances.
- **gRPC Interface**: Efficient, strongly-typed gRPC communication between your microservices and the rate limiter.
- **Dynamic Configuration**: Policies are defined via a simple JSON configuration file.
- **Docker Ready**: Includes a `compose.yaml` to spin up the rate limiter and a Redis instance instantly.

## Technologies Used

- Node.js & TypeScript
- gRPC (`@grpc/grpc-js`)
- Redis (`ioredis`)
- Docker & Docker Compose

## Quick Start

### Running with Docker Compose

The easiest way to get started is using Docker Compose. This will spin up both the Redis instance and the rate-limiter service.

```bash
docker compose up -d
```

The service will be available on `localhost:50051`.

### Running Locally

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate gRPC types (if not already done):
   ```bash
   pnpm run proto:generate
   ```

3. Start a local Redis server.

4. Start the development server:
   ```bash
   pnpm run dev
   ```

## Configuration

Rate limiting policies are defined in a `policies.json` file. See `policies.example.json` for a template.

```json
[
  {
    "name": "api-default",
    "algorithm": "TOKEN_BUCKET",
    "limit": 100,
    "windowSeconds": 60,
    "refillRate": 100
  },
  {
    "name": "login-attempts",
    "algorithm": "SLIDING_WINDOW_COUNTER",
    "limit": 5,
    "windowSeconds": 300
  }
]
```

## gRPC API

The service exposes the following RPC methods defined in `proto/rate_limiter.proto`:

- `CheckLimit`: Evaluates whether a request for a given key and policy is allowed, and consumes the configured cost.
- `GetStatus`: Retrieves the current rate limit status (remaining limit, reset time) without consuming any quota.
- `ResetLimit`: Manually resets the rate limit for a specific key.

### Example Node.js Client Usage

```javascript
const client = new proto.ratelimiter.RateLimiterService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

client.CheckLimit({ key: 'user-123', policy_name: 'api-default', cost: 1 }, (err, response) => {
  console.log(response.allowed); // true or false
  console.log(response.remaining);
});
```

## Testing

Run unit and integration tests using Vitest:

```bash
pnpm run test
```

To run a smoke test against a running instance of the rate limiter:

```bash
node scripts/smoke-test.js
```
