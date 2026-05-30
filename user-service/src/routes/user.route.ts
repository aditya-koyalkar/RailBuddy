import express from "express"
import { getProfile } from "../controllers/user.controller.js"
import { getUserContext } from "../middlewares/getUserContext.middleware.js"

const router = express.Router()

router.get('/get-profile', getUserContext, getProfile)

export default router