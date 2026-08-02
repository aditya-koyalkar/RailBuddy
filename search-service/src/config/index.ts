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
    PORT: process.env.PORT || 4003,
    ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL || "http://localhost:9200"
}