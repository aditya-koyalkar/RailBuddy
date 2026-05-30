import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { config } from "../config";
import { createProxy } from "./proxy";
import { endpointRatelimit } from "../middlewares/rateLimitting.middleware";

const router = express.Router()

const userServiceProxy = createProxy('userService', config.USER_SERVICE_URL);

//private routes
router.post('/users/auth/login', endpointRatelimit(100, 90000), userServiceProxy)

//public routes
router.get('/users/user/get-profile', requireAuth, userServiceProxy)

// Garwway health

router.get('/gateway/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: "API Gateway is healthy",
        timestamp: new Date().toString()
    })
})

export default router;