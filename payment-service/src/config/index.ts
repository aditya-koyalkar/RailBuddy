import dotenv from "dotenv";
dotenv.config();
import packageJson from "../../package.json";

export const config = {
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    SERVICE_NAME: packageJson.name,
    NODE_ENV: process.env.NODE_ENV || "development",
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "payment-service",
    KAFKA_BROKER: process.env.KAFKA_BROKER || "localhost:9093",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",
    PORT: Number(process.env.PORT) || 4006,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN || "",
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET || "",
    POLAR_PRODUCT_ID: process.env.POLAR_PRODUCT_ID || "",
    POLAR_ENVIRONMENT: (process.env.POLAR_ENVIRONMENT || "sandbox") as "sandbox" | "production"
};
