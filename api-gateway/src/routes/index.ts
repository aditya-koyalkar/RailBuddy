import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { config } from "../config/index.js";
import { createProxy } from "./proxy.js";
import { endpointRatelimit } from "../middlewares/rateLimitting.middleware.js";

const router = express.Router()

const userServiceProxy = createProxy('userService', config.USER_SERVICE_URL);
const adminServiceProxy = createProxy('adminService', config.ADMIN_SERVICE_URL)

//private routes
router.get('/users/user/get-profile', requireAuth, userServiceProxy)
router.post('/admins/station', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy)
router.post('/admins/train', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy)
router.get('/admins/train/:id', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy)
router.post('/admins/schedule', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy)
//public routes
router.post('/users/auth/login', endpointRatelimit(10, 90000), userServiceProxy)
router.post('/users/auth/send-otp', endpointRatelimit(10, 90000), userServiceProxy)
router.post('/users/auth/verify-otp', endpointRatelimit(10, 90000), userServiceProxy)

// Garwway health

router.get('/gateway/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API Gateway is healthy",
        timestamp: new Date().toString()
    })
})

export default router;