import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library.js";
import { logger } from "../config/logger.js";

export const retryTransaction = async (fn: () => any, maxRetries = 3) => {

    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            if (error instanceof PrismaClientKnownRequestError && error.code === "P2034") {
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