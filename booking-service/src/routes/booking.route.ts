import express from "express";
import { createBooking, cancelBooking } from "../controllers/booking.controller.js";
import { getUserContext } from "../middlewares/getUserContext.js";

const router = express.Router();

router.post('/', getUserContext, createBooking);
router.post('/:id/cancel', getUserContext, cancelBooking);

export default router;
