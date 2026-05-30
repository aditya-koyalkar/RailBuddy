import { redis } from "../config/redis.js";
import type { Request, Response, NextFunction } from "express";
import { TooManyRequestsError } from "../utils/error.js";


async function ratelimiter(
    key: string,
    maxRequests: number,
    windowMs: number
) {
    const current = await redis.incr(key);

    // set expiry only on first request
    if (current === 1) {
        await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);  // returns remaining expiry of the key

    return {
        totalRequests: current,
        remainingRequests: Math.max(0, maxRequests - current),
        retryAfter: Math.ceil(ttl / 1000),
        exceeded: current > maxRequests,
    };
}

/**
 * Endpoint-specific rate limiting
 * Example:
 * POST /users/auth/login -> 100 requests / 90 sec
 */
export function endpointRatelimit(
    maxRequests: number,
    windowMs: number
) {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const ip =
                req.ip ||
                req.socket.remoteAddress ||
                "unknown";

            const endpoint = `${req.method}:${req.path}`;

            const key = `ratelimit:endpoint:${endpoint}:${ip}`;

            const result = await ratelimiter(
                key,
                maxRequests,
                windowMs
            );

            res.setHeader(
                "X-RateLimit-Limit",
                maxRequests
            );

            res.setHeader(
                "X-RateLimit-Remaining",
                result.remainingRequests
            );

            res.setHeader(
                "X-RateLimit-Reset",
                result.retryAfter
            );

            if (result.exceeded) {
                throw new TooManyRequestsError("Too many requests, please try again later.")
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}