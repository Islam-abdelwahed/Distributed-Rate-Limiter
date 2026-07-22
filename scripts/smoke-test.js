const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../proto/rate_limiter.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition);
const client = new proto.ratelimiter.RateLimiterService(
  'localhost:50051',
  grpc.credentials.createInsecure(),
);

function call(method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function main() {
  console.log('--- CheckLimit against "api-default" (TOKEN_BUCKET, limit=100) ---');
  const r1 = await call('CheckLimit', { key: 'smoke-test-user', policy_name: 'api-default', cost: 1 });
  console.log(r1);

  console.log('\n--- GetStatus ---');
  const status = await call('GetStatus', { key: 'smoke-test-user', policy_name: 'api-default' });
  console.log(status);

  console.log('\n--- login-attempts (SLIDING_WINDOW_COUNTER, limit=5) — firing 6 requests ---');
  for (let i = 1; i <= 6; i++) {
    const res = await call('CheckLimit', { key: 'login-user-1', policy_name: 'login-attempts', cost: 1 });
    console.log(`request #${i}:`, res);
  }

  console.log('\n--- ResetLimit for login-user-1 ---');
  const reset = await call('ResetLimit', { key: 'login-user-1', policy_name: 'login-attempts' });
  console.log(reset);

  console.log('\n--- After reset, request should be allowed again ---');
  const afterReset = await call('CheckLimit', { key: 'login-user-1', policy_name: 'login-attempts', cost: 1 });
  console.log(afterReset);

  console.log('\n--- Unknown policy should return NOT_FOUND ---');
  try {
    await call('CheckLimit', { key: 'x', policy_name: 'does-not-exist', cost: 1 });
  } catch (err) {
    console.log('Got expected error:', err.code, err.details);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});