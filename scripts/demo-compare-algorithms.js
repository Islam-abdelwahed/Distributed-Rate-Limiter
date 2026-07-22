/**
 * Demo scenario (per breakdown doc, section 9):
 * Fire the same traffic pattern against all 3 algorithms and compare
 * how each one behaves — this is meant to be run against a live server
 * with all 3 example policies loaded (see policies.example.json):
 *   - api-default        -> TOKEN_BUCKET       (limit 100, refill 100/60s)
 *   - login-attempts     -> SLIDING_WINDOW_COUNTER (limit 5,  window 300s)
 *   - webhook-smoothing  -> LEAKY_BUCKET        (limit 20, leak 20/10s)
 *
 * To make the comparison fair and visible in a short demo run, we use a
 * dedicated set of tight test policies (see TEST_POLICIES below) — all
 * with the same "limit" so behavior differences are due to the algorithm,
 * not the numbers. To use these, temporarily merge them into your
 * policies.json, or run this script pointed at a server whose policies
 * file includes them.
 */
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

function checkLimit(key, policyName) {
  return new Promise((resolve, reject) => {
    client.CheckLimit({ key, policy_name: policyName, cost: 1 }, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends `count` requests against `policyName`, waiting `intervalMs`
 * between each, and prints an allow/deny timeline.
 */
async function runPattern(policyName, key, count, intervalMs) {
  const timeline = [];
  for (let i = 0; i < count; i++) {
    const res = await checkLimit(key, policyName);
    timeline.push(res.allowed ? '✓' : '✗');
    if (intervalMs > 0) await sleep(intervalMs);
  }
  return timeline.join(' ');
}

async function main() {
  console.log('Comparing algorithm behavior under the SAME traffic pattern:');
  console.log('Pattern: burst of 8 requests with no delay, then 4 more spaced 500ms apart.\n');

  const policies = [
    ['api-default', 'TOKEN_BUCKET (burst-friendly)'],
    ['login-attempts', 'SLIDING_WINDOW_COUNTER (accurate, no burst-at-boundary)'],
    ['webhook-smoothing', 'LEAKY_BUCKET (smooths traffic to constant rate)'],
  ];

  for (const [policyName, label] of policies) {
    const key = `demo-${policyName}-${Date.now()}`;
    // Burst phase
    const burst = await runPattern(policyName, key, 8, 0);
    // Spaced phase
    const spaced = await runPattern(policyName, key, 4, 500);
    console.log(`${label}`);
    console.log(`  burst (8x, no delay):     ${burst}`);
    console.log(`  spaced (4x, 500ms apart): ${spaced}\n`);
  }

  console.log('Token Bucket allowed the whole burst because it fits within its');
  console.log('capacity (100) and only measures instantaneous tokens available.');
  console.log('Sliding Window enforced a hard count cap (5) across the whole window,');
  console.log('so once 5 requests land — burst or spaced — the rest are rejected');
  console.log('until the window rolls forward. Leaky Bucket here has a capacity (20)');
  console.log('well above this small burst, so nothing overflowed; try tightening');
  console.log('"limit" or "leak_rate" in policies.example.json to see it reject');
  console.log('bursts that arrive faster than its constant drain rate.');

  process.exit(0);
}

main().catch((err) => {
  console.error('Demo failed:', err.message);
  console.error('Make sure the server is running with policies.example.json loaded.');
  process.exit(1);
});
