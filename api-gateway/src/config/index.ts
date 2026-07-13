import dotenv from "dotenv"
dotenv.config();
import packageJson from "../../package.json" with { type: "json" };;


export const config = {
    PORT: Number(process.env.PORT) || 4000,
    ALLOWED_ORIGINS: "",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    SERVICE_NAME: packageJson.name,
    NODE_ENV: process.env.NODE_ENV || "development",
    REDIS_URL: process.env.REDIS_URL || "",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "",
    REDIS_DEFAULT_TTL: parseInt(process.env.REDIS_DEFAULT_TTL || '86400', 10),
    USER_SERVICE_URL: process.env.USER_SERVICE_URL || "",
    ADMIN_SERVICE_URL: process.env.ADMIN_SERVICE_URL || "",
    CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '300000', 10),
    SERVICE_TIMEOUT_MS: parseInt(process.env.SERVICE_TIMEOUT_MS || '50000', 10),
    SEARCH_SERVICE_URL: process.env.SEARCH_SERVICE_URL || "",
    BOOKING_SERVICE_URL: process.env.BOOKING_SERVICE_URL || "http://localhost:4008",
}