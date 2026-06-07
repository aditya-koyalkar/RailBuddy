import express from "express";
import { searchTrains, autoComplete } from "../controllers/search.controller.js";
import { getUserContext } from "../middlewares/getUserContext.js";

const router = express.Router();

router.get("/trains", getUserContext, searchTrains);
router.get("/autocomplete", getUserContext, autoComplete);

export default router;
