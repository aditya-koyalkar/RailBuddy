import cors from "cors"
import { config } from "../config/index.js"

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        const allowedOrigins = config.ALLOWED_ORIGINS.split(',');
        console.log(origin)
        if (allowedOrigins.includes(origin || "")) {
            callback(null, true)
        }
        else {
            callback(new Error("Not allowed by CORS"))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization'
    ]
}) 