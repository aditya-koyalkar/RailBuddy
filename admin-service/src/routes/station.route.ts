import express from "express"
import { requireAdmin } from "../middlewares/requireAdmin.middleware"
import { createStation } from "../controllers/station.controller"

const router = express.Router()

router.post('/station', requireAdmin, createStation)

export default router