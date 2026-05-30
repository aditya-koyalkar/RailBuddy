import { config } from "./index.js";
import * as IoRedis from "ioredis";
import { logger } from "./logger.js";

class RedisClient {
    private static instance: IoRedis.Redis;
    private static isConnected = false;

    constructor() { }

    static getInstance(): IoRedis.Redis {
        if (!RedisClient.instance) {
            RedisClient.instance = new IoRedis.Redis(config.REDIS_URL, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                retryStrategy(times) {
                    const delay = Math.min(times * 100, 3000);
                    return delay;
                },
            });

            RedisClient.instance.on("connect", () => {
                logger.info("Redis connected");
                RedisClient.isConnected = true;
            });

            RedisClient.instance.on("error", (err) => {
                logger.error("Redis error:", err);
                RedisClient.isConnected = false;
            });

            RedisClient.instance.on("close", () => {
                logger.info("Redis connection closed");
                RedisClient.isConnected = false;
            });

            RedisClient.instance.on("reconnecting", () => {
                logger.info("Redis reconnecting...");
            });
        }

        return RedisClient.instance;
    }

    static async connect() {
        const client = RedisClient.getInstance();

        if (!RedisClient.isConnected) {
            await client.connect();
        }

        return client;
    }

    static async disconnect() {
        if (RedisClient.instance) {
            await RedisClient.instance.quit();
            RedisClient.isConnected = false;
        }
    }
}

export const redis = RedisClient.getInstance()