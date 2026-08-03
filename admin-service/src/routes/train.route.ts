import { Router } from "express";
import { createRoute, createTrain, getTrainById, createSchedule, createFares, getAllTrains, searchTrains } from "../controllers/train.controller";
import { requireAdmin } from "../middlewares/requireAdmin.middleware";

const router = Router();

// Public & Inter-Service Endpoints
router.get('/search', searchTrains);              // Public train schedule search
router.get('/:id', getTrainById);                 // Public & inter-service train details

// Admin-Only Endpoints
router.get('/all', requireAdmin, getAllTrains);   // Admin list of all trains
router.post('/train', requireAdmin, createTrain); // Create train
router.post('/', requireAdmin, createTrain);
router.post('/route', requireAdmin, createRoute); // Add route
router.post('/schedule', requireAdmin, createSchedule); // Create schedule
router.post('/fare', requireAdmin, createFares);  // Create fares

export default router;