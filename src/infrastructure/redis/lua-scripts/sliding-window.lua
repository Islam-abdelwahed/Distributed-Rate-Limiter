-- Sliding Window Counter — atomic check-and-consume
--
-- KEYS[1] = redis key for this window's hash (previousCount, currentCount, currentWindowStartMs)
-- ARGV[1] = limit
-- ARGV[2] = windowSeconds
-- ARGV[3] = nowMs
-- ARGV[4] = cost
-- ARGV[5] = ttlSeconds
--
-- Returns: { allowed(0/1), remaining, resetAtUnix, retryAfterMs }

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttlSeconds = tonumber(ARGV[5])

local windowMs = windowSeconds * 1000
local thisWindowStart = math.floor(nowMs / windowMs) * windowMs

local data = redis.call('HMGET', key, 'previousCount', 'currentCount', 'currentWindowStartMs')
local previousCount = tonumber(data[1]) or 0
local currentCount = tonumber(data[2]) or 0
local currentWindowStartMs = tonumber(data[3])

if currentWindowStartMs == nil then
  currentWindowStartMs = thisWindowStart
  previousCount = 0
  currentCount = 0
elseif currentWindowStartMs ~= thisWindowStart then
  local windowsElapsed = math.floor((thisWindowStart - currentWindowStartMs) / windowMs + 0.5)
  if windowsElapsed == 1 then
    previousCount = currentCount
    currentCount = 0
  else
    previousCount = 0
    currentCount = 0
  end
  currentWindowStartMs = thisWindowStart
end

local elapsedInWindowMs = nowMs - thisWindowStart
local weightOfPrevious = math.max(0, (windowMs - elapsedInWindowMs) / windowMs)
local estimatedCount = previousCount * weightOfPrevious + currentCount

local resetAtUnix = math.ceil((thisWindowStart + windowMs) / 1000)
local allowed = 0
local remaining
local retryAfterMs = 0

if estimatedCount + cost <= limit then
  allowed = 1
  currentCount = currentCount + cost
  remaining = math.max(0, math.floor(limit - (estimatedCount + cost)))
  redis.call('HSET', key, 'previousCount', previousCount, 'currentCount', currentCount, 'currentWindowStartMs', currentWindowStartMs)
else
  remaining = math.max(0, math.floor(limit - estimatedCount))
  retryAfterMs = math.max(0, thisWindowStart + windowMs - nowMs)
  redis.call('HSET', key, 'previousCount', previousCount, 'currentCount', currentCount, 'currentWindowStartMs', currentWindowStartMs)
end

redis.call('EXPIRE', key, ttlSeconds)

return { allowed, tostring(remaining), resetAtUnix, retryAfterMs }
