import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { logger } from "./config/logger.js";
import { reqLogger } from "./middlewares/req.middleware.js";
import paymentRoutes from "./routes/payment.route.js";
import paymentProducer from "./kafka/producer/payment.producer.js";
import { startPaymentOutboxWorker } from "./services/outbox.service.js";

const app = express();

app.use(helmet());
app.use(corsMiddleware);
app.use(cookieParser());
app.use(reqLogger);

// Note: express.json() is NOT applied globally here because /api/payment/webhook/polar requires raw body for signature verification.
// Instead, json() is applied per route in payment.route.ts.

app.use("/api/payment", paymentRoutes);

app.get("/", (_req, res) => {
    res.status(200).json({
        message: "payment-service is running",
        environment: config.POLAR_ENVIRONMENT
    });
});

app.use(errorHandler);

const startServer = async () => {
    try {
        await paymentProducer.initialize();
        logger.info("Payment Producer initialized");

        startPaymentOutboxWorker();

        app.listen(config.PORT, () => {
            logger.info(`Payment service running on PORT: ${config.PORT}`);
        });
    } catch (error) {
        logger.error("Failed to start Payment service server", error);
        process.exit(1);
    }
};

startServer();
