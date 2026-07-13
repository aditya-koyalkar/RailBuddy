import express from "express";
import { createBooking } from "../controllers/booking.controller.js";
import { getUserContext } from "../middlewares/getUserContext.js";

const router = express.Router();

router.post('/', getUserContext, createBooking);

export default router;
