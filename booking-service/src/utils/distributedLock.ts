const ACQUIRE_SCRIPT = `
local lockValue = ARGV[1]
local ttl = tonumber(ARGV[2])

local acquired = {}

for _, key in ipairs(KEYS) do
    local result = redis.call(
        "SET",
        key,
        lockValue,
        "NX",
        "EX",
        ttl
    )

    if not result then
        -- Roll back previously acquired locks
        for j = 1, #acquired do
            redis.call("DEL", acquired[j])
        end

        return 0
    end

    table.insert(acquired, key)
end

return 1
`;

const RELEASE_SCRIPT = `
local released = 0

for _, key in ipairs(KEYS) do
    local storedValue = redis.call("GET", key)

    if storedValue == ARGV[1] then
        redis.call("DEL", key)
        released = released + 1
    end
end

return released
`;


/**
 * Redis distributed locking using Lua scripts for atomocity
 * Lock key pattern booking:lock:seat:{scheduleId}:{seatId}
 * All-or-nothing acquisition - either all seats are locked or none
 * User sorted seatIds to prevent deadlocks

*/

import { logger } from "../config/logger";
import { redis } from "../config/redis";

export async function acquireSeatLocks(scheduleId: string, seatIds: string[], bookingId: string, ttlSeconds: number, fromSeq: number, toSeq: number) {
    const keys = buildLockKeys(scheduleId, seatIds, fromSeq, toSeq);
    const lockValue = `${bookingId}:${Date.now()}`;
    try {
        const result = await redis.eval(ACQUIRE_SCRIPT, keys.length, ...keys, lockValue, ttlSeconds)
        if (result === 1) {
            logger.info(`Acquired seat locks for booking ${bookingId}`, { scheduleId, seatIds });
            return { acquired: true, lockValue }
        }
        else {
            logger.error(`Failed to acquire seat locks for booking ${bookingId}`, { scheduleId, seatIds });
            return { acquired: false, lockValue: null }
        }
    }
    catch (error) {
        logger.error(`Error acquiring seat locks for booking ${bookingId}`, error);
        return { acquired: false, lockValue: null }
    }

}

const buildLockKeys = (scheduleId: string, seatIds: string[], fromSeq: number, toSeq: number) => {
    return seatIds.map(seatId => `booking:lock:seat:${scheduleId}:${seatId}:${fromSeq}:${toSeq}`);
}


export async function releaseSeatLocks(scheduleId: string, seatIds: string[], lockValue: string, fromSeq: number, toSeq: number) {
    const keys = buildLockKeys(scheduleId, seatIds, fromSeq, toSeq)
    try {
        const released = await redis.eval(RELEASE_SCRIPT, keys.length, ...keys, lockValue)
        logger.info(`Released ${released} distributed lock(s)`, { scheduleId, seatIds })
    }
    catch (error: any) {
        logger.error(`Error releasing distributed lock(s)`, {
            error: error.message
        })
    }
}