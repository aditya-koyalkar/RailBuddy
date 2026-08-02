import cors from "cors"
import { config } from "../config/index.js"

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true)
        }
        else {
            callback(new Error(`CORS error: ${origin} not allowed`))
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