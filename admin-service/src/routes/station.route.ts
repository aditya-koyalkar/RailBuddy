import express from "express"
import { requireAdmin } from "../middlewares/requireAdmin.middleware"
import { createStation, getAllStations } from "../controllers/station.controller"

const router = express.Router()

router.post('/station', requireAdmin, createStation)
router.get('/all', requireAdmin, getAllStations)

export default router