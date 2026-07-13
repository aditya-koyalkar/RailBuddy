import express from "express";
import { getAvailability, getSeats, holdSeats, releaseSeats } from "../controllers/inventory.controller.js";

const router = express.Router();

router.get('/schedules/:scheduleId/availability', getAvailability);
router.get('/schedules/:scheduleId/seats', getSeats);
router.post('/seats/lock', holdSeats);
router.post('/seats/release', releaseSeats);

export default router;
