import { Router } from "express";
import { createRoute, createTrain, getTrainById, createSchedule, createFares } from "../controllers/train.controller";
import { getUserContext } from "../middlewares/getUserContext";
import { requireAdmin } from "../middlewares/requireAdmin.middleware";

const router = Router()

router.post('/train', requireAdmin, createTrain)
router.post('/route', requireAdmin, createRoute)
router.get('/train/:id', getUserContext, getTrainById)
router.post('/schedule', requireAdmin, createSchedule)
router.post('/fare', requireAdmin, createFares)

export default router