import dotenv from "dotenv"
dotenv.config();
import packageJson from "../../package.json" with { type: "json" };


export const config = {
    PORT: Number(process.env.PORT) || 3000,
    ALLOWED_ORIGINS: "",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    SERVICE_NAME: packageJson.name,
    NODE_ENV: process.env.NODE_ENV || "development"
};