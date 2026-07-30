import { Router } from "express";
import { createRoute, createTrain, getTrainById, createSchedule, createFares } from "../controllers/train.controller";
import { getUserContext } from "../middlewares/getUserContext";

const router = Router()

router.post('/train', getUserContext, createTrain)
router.post('/route', getUserContext, createRoute)
router.get('/train/:id', getUserContext, getTrainById)
router.post('/schedule', getUserContext, createSchedule)
router.post('/fare', getUserContext, createFares)

export default router