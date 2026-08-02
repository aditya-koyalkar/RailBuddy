import { Router, raw, json } from "express";
import { createPaymentOrder, handlePolarWebhook, getPaymentStatus, verifyPayment, refundPayment } from "../controllers/payment.controller";

const router = Router();

// Webhook endpoint uses raw body parser for signature verification
router.post("/webhook/polar", raw({ type: "application/json" }), handlePolarWebhook);

// REST endpoints use standard JSON parser
router.post("/orders", json(), createPaymentOrder);
router.post("/verify", json(), verifyPayment);
router.post("/refund", json(), refundPayment);
router.get("/orders/:bookingId", getPaymentStatus);

export default router;
