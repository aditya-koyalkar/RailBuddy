import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library.js";
import { logger } from "../config/logger.js";

const RETRYABLE_PG_CODES = new Set([
    "40001", // serialization_failure
    "40P01", // deadlock_detected
    "55P03", // lock_not_available (FOR UPDATE NOWAIT)
]);

// retries the a function in case of a transaction failure due to serialization or deadlock error
export const retryTransaction = async (fn: () => any, maxRetries = 3) => {

    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            if (error instanceof PrismaClientKnownRequestError && RETRYABLE_PG_CODES.has(error.code)) {
                lastError = error
                logger.warn(`Transaction failed due to serialization error, retrying...`);
            }
            else {
                throw error
            }
        }
        if (i < maxRetries - 1) {
            const delay = Math.min(100 * Math.pow(2, i), 1000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;

}