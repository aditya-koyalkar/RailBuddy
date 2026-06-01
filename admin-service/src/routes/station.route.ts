import express from "express"
import { getUserContext } from "../middlewares/getUserContext"
import { createStation } from "../controllers/station.controller"

const router = express.Router()

router.post('/', getUserContext, createStation)


export default router