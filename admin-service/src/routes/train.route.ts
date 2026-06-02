import { Router } from "express";
import { createRoute, createTrain } from "../controllers/train.controller";
import { getUserContext } from "../middlewares/getUserContext";

const router = Router()

router.post('/train', getUserContext, createTrain)
router.post('/route', getUserContext, createRoute)

export default router