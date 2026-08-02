import { Router } from "express";
import { createRoute, createTrain, getTrainById, createSchedule, createFares, getAllTrains, searchTrains } from "../controllers/train.controller";
import { requireAdmin } from "../middlewares/requireAdmin.middleware";

const router = Router()

router.get('/all', requireAdmin, getAllTrains)
router.get('/search', searchTrains)              // Public — no auth needed
router.post('/train', requireAdmin, createTrain)
router.post('/route', requireAdmin, createRoute)
router.get('/train/:id', requireAdmin, getTrainById)
router.post('/schedule', requireAdmin, createSchedule)
router.post('/fare', requireAdmin, createFares)

export default router