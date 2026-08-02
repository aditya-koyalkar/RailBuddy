import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { config } from "../config/index.js";
import { createProxy } from "./proxy.js";
import { endpointRatelimit } from "../middlewares/rateLimitting.middleware.js";

const router = express.Router()

const userServiceProxy = createProxy('userService', config.USER_SERVICE_URL);
const adminServiceProxy = createProxy('adminService', config.ADMIN_SERVICE_URL);
const searchServiceProxy = createProxy('searchService', config.SEARCH_SERVICE_URL);
const bookingServiceProxy = createProxy('bookingService', config.BOOKING_SERVICE_URL);
const paymentServiceProxy = createProxy('paymentService', config.PAYMENT_SERVICE_URL);
const inventoryServiceProxy = createProxy('inventoryService', config.INVENTORY_SERVICE_URL);

// Private User routes
router.get('/users/user/get-profile', requireAuth, userServiceProxy);

// Admin routes
router.get('/admins/station/all', requireAuth, endpointRatelimit(30, 90000), adminServiceProxy);
router.post('/admins/station/station', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy);
router.get('/admins/train/all', requireAuth, endpointRatelimit(30, 90000), adminServiceProxy);
router.post('/admins/train/train', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy);
router.post('/admins/train/route', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy);
router.get('/admins/train/train/:id', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy);
router.post('/admins/train/schedule', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy);
router.post('/admins/train/fare', requireAuth, endpointRatelimit(10, 90000), adminServiceProxy);

// Booking routes
router.get('/bookings/booking/my-bookings', requireAuth, endpointRatelimit(30, 90000), bookingServiceProxy);
router.post('/bookings/booking', requireAuth, endpointRatelimit(10, 90000), bookingServiceProxy);
router.get('/bookings/booking/:id', requireAuth, endpointRatelimit(30, 90000), bookingServiceProxy);
router.post('/bookings/booking/:id/cancel', requireAuth, endpointRatelimit(10, 90000), bookingServiceProxy);

// Inventory routes
router.get('/inventory/schedules/:scheduleId/availability', endpointRatelimit(30, 90000), inventoryServiceProxy);
router.get('/inventory/schedules/:scheduleId/seats', endpointRatelimit(30, 90000), inventoryServiceProxy);
router.post('/inventory/seats/lock', requireAuth, endpointRatelimit(10, 90000), inventoryServiceProxy);
router.post('/inventory/seats/unlock', requireAuth, endpointRatelimit(10, 90000), inventoryServiceProxy);

// Payment routes
router.post('/payments/payment/orders', requireAuth, endpointRatelimit(10, 90000), paymentServiceProxy);
router.post('/payments/payment/verify', requireAuth, endpointRatelimit(10, 90000), paymentServiceProxy);
router.get('/payments/payment/orders/:bookingId', requireAuth, endpointRatelimit(10, 90000), paymentServiceProxy);
router.post('/payments/payment/webhook/polar', endpointRatelimit(60, 60000), paymentServiceProxy);

// Search routes (public — no auth)
router.get('/search/search/trains', endpointRatelimit(30, 90000), searchServiceProxy);
router.get('/search/search/autocomplete', endpointRatelimit(30, 90000), searchServiceProxy);

// Train search via admin-service DB (public — no auth, replaces ES train search)
router.get('/admins/train/search', endpointRatelimit(30, 90000), adminServiceProxy);

// Public Auth routes
router.post('/users/auth/login', endpointRatelimit(10, 90000), userServiceProxy);
router.post('/users/auth/send-otp', endpointRatelimit(10, 90000), userServiceProxy);
router.post('/users/auth/verify-otp', endpointRatelimit(10, 90000), userServiceProxy);
router.get('/users/auth/refresh', userServiceProxy);

// Gateway health
router.get('/gateway/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API Gateway is healthy",
        timestamp: new Date().toString()
    });
});

export default router;