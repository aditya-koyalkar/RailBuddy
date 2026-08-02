import express from "express";
import { autoComplete } from "../controllers/search.controller.js";

const router = express.Router();

// Only station autocomplete uses Elasticsearch
router.get("/autocomplete", autoComplete);

export default router;
