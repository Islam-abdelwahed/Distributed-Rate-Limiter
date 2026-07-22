-- Token Bucket — atomic check-and-consume
--
-- KEYS[1] = redis key for this bucket's hash (tokens, lastRefillMs)
-- ARGV[1] = capacity (policy.limit)
-- ARGV[2] = refillRate (tokens per window)
-- ARGV[3] = windowSeconds
-- ARGV[4] = nowMs
-- ARGV[5] = cost
-- ARGV[6] = ttlSeconds (key expiry, so idle keys don't leak memory forever)
--
-- Returns: { allowed(0/1), remaining, resetAtUnix, retryAfterMs }

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local windowSeconds = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local cost = tonumber(ARGV[5])
local ttlSeconds = tonumber(ARGV[6])


local data = redis.call('HMGET', key, 'tokens', 'lastRefillMs')
local tokens = tonumber(data[1])
local lastRefillMs = tonumber(data[2])


if tokens == nil then
    tokens = capacity
    lastRefillMs = nowMs
end

local refillPerMs = refillRate / (windowSeconds * 1000)
local elapsedMs = math.max(0, nowMs - lastRefillMs)
local refilled = math.min(capacity, tokens + elapsedMs * refillPerMs)

local resetAtUnix = math.ceil(nowMs / 1000) + windowSeconds
local allowed = 0
local remaining
local retryAfterMs = 0

if refilled >= cost then
    allowed = 1
    remaining = refilled - cost
    redis.call('HSET', key, 'tokens', remaining, 'lastRefillMs', nowMs)
else
    remaining = refilled
    local deficit = cost - refilled
    if refillPerMs > 0 then
        retryAfterMs = math.ceil(deficit / refillPerMs)
    else
        retryAfterMs = windowSeconds * 1000
    end
    redis.call('HSET', key, 'tokens', remaining, 'lastRefillMs', nowMs)
end

redis.call('EXPIRE', key, ttlSeconds)

return { allowed, tostring(remaining), resetAtUnix, retryAfterMs }
