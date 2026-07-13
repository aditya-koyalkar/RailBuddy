import dotenv from "dotenv"
dotenv.config();
import packageJson from "../../package.json";


export const config = {
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    SERVICE_NAME: packageJson.name,
    NODE_ENV: process.env.NODE_ENV || "development",
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "",
    KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9093',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",
    PORT: process.env.PORT || 4001,
    BOOKING_TTL_SECONDS: Number(process.env.BOOKING_TTL_SECONDS) || 10 * 60,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    LOCK_TTL_SECONDS: Number(process.env.LOCK_TTL_SECONDS) || 10 * 60,
    INVENTORY_SERVICE_URL: process.env.INVENTORY_SERVICE_URL || 'http://localhost:8082/api/inventory',
    PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:8081/api/payment',

}