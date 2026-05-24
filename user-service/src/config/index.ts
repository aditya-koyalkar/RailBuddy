import dotenv from "dotenv"
dotenv.config();
import packageJson from "../../package.json" with { type: "json" };


export const config = {
    PORT: Number(process.env.PORT) || 3000,
    ALLOWED_ORIGINS: "",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    SERVICE_NAME: packageJson.name,
    NODE_ENV: process.env.NODE_ENV || "development",
    REDIS_URL: process.env.REDIS_URL || "",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "",
    OTP_TTL: parseInt(process.env.OTP_TTL || '300', 10),
    OTP_RATE_MAX_PER_HOUR: parseInt(process.env.OTP_RATE_MAX_PER_HOUR || '5', 10),
    HMAC_SECRET: process.env.HMAC_SECRET || "",
    OTP_MAX_VERIFY_ATTEMPTS: 5,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "",
    ACCESS_TOKEN_EXP: parseInt(process.env.ACCESS_TOKEN_EXP || '300', 10),
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
    REFRESH_TOKEN_EXP: parseInt(process.env.REFRESH_TOKEN_EXP || '1000000', 10),
    REDIS_DEFAULT_TTL: parseInt(process.env.REDIS_DEFAULT_TTL || '86400', 10),
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || ""
}