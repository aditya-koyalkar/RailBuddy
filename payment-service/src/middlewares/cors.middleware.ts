import cors from "cors";
import { config } from "../config/index.js";

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        if (config.ALLOWED_ORIGINS === "*") {
            callback(null, true);
            return;
        }
        const allowedOrigins = config.ALLOWED_ORIGINS.split(",");
        if (allowedOrigins.includes(origin || "")) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization"
    ]
});
