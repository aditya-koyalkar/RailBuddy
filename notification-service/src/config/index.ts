import dotenv from "dotenv"
dotenv.config();
import packageJson from "../../package.json" with { type: "json" };


export const config = {
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    SERVICE_NAME: packageJson.name,
    NODE_ENV: process.env.NODE_ENV || "development",
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "",
    KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9093',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || ''
}