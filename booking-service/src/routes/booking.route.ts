import express from "express";
import { createBooking, cancelBooking, getUserBookings, getBookingById } from "../controllers/booking.controller.js";
import { getUserContext } from "../middlewares/getUserContext.js";

const router = express.Router();

router.get('/my-bookings', getUserContext, getUserBookings);
router.post('/', getUserContext, createBooking);
router.get('/:id', getUserContext, getBookingById);
router.post('/:id/cancel', getUserContext, cancelBooking);

export default router;
