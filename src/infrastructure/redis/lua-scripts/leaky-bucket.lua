-- Leaky Bucket — atomic check-and-consume
--
-- KEYS[1] = redis key for this bucket's hash (level, lastLeakMs)
-- ARGV[1] = capacity (policy.limit)
-- ARGV[2] = leakRate (requests drained per window)
-- ARGV[3] = windowSeconds
-- ARGV[4] = nowMs
-- ARGV[5] = cost
-- ARGV[6] = ttlSeconds
--
-- Returns: { allowed(0/1), remaining, resetAtUnix, retryAfterMs }

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leakRate = tonumber(ARGV[2])
local windowSeconds = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local cost = tonumber(ARGV[5])
local ttlSeconds = tonumber(ARGV[6])

local data = redis.call('HMGET', key, 'level', 'lastLeakMs')
local level = tonumber(data[1])
local lastLeakMs = tonumber(data[2])

if level == nil then
  level = 0
  lastLeakMs = nowMs
end

local leakPerMs = leakRate / (windowSeconds * 1000)
local elapsedMs = math.max(0, nowMs - lastLeakMs)
local leaked = elapsedMs * leakPerMs
local levelAfterLeak = math.max(0, level - leaked)

local resetAtUnix = math.ceil(nowMs / 1000) + windowSeconds
local allowed = 0
local remaining
local retryAfterMs = 0

if levelAfterLeak + cost <= capacity then
  allowed = 1
  local nextLevel = levelAfterLeak + cost
  remaining = math.floor(capacity - nextLevel)
  redis.call('HSET', key, 'level', nextLevel, 'lastLeakMs', nowMs)
else
  remaining = math.max(0, math.floor(capacity - levelAfterLeak))
  local overflow = levelAfterLeak + cost - capacity
  if leakPerMs > 0 then
    retryAfterMs = math.ceil(overflow / leakPerMs)
  else
    retryAfterMs = windowSeconds * 1000
  end
  redis.call('HSET', key, 'level', levelAfterLeak, 'lastLeakMs', nowMs)
end

redis.call('EXPIRE', key, ttlSeconds)

return { allowed, tostring(remaining), resetAtUnix, retryAfterMs }
