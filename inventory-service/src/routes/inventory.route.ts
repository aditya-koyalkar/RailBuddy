import express from "express";
import { getAvailability, lockSeats, unlockSeats, confirmSeats, cancelBooking, getSeatsByIds } from "../controllers/inventory.controller.js";
import { getUserContext } from "../middlewares/getUserContext.js";

const router = express.Router();

router.get('/schedules/:scheduleId/availability', getAvailability);
router.get('/schedules/:scheduleId/seats', getSeatsByIds);
router.post('/seats/lock', getUserContext, lockSeats);
router.post('/seats/unlock', getUserContext, unlockSeats);
router.post('/seats/confirm', getUserContext, confirmSeats);
router.post('/seats/cancel-booking', getUserContext, cancelBooking);
router.post('/seats/release', getUserContext, unlockSeats); // For backwards compatibility

export default router;
