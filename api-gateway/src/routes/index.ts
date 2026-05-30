import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { config } from "../config/index.js";
import { createProxy } from "./proxy.js";
import { endpointRatelimit } from "../middlewares/rateLimitting.middleware.js";

const router = express.Router()

const userServiceProxy = createProxy('userService', config.USER_SERVICE_URL);

//private routes
router.post('/users/auth/login', endpointRatelimit(100, 90000), userServiceProxy)

//public routes
router.get('/users/user/get-profile', requireAuth, userServiceProxy)

// Garwway health

router.get('/gateway/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API Gateway is healthy",
        timestamp: new Date().toString()
    })
})

export default router;