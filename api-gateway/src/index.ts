import express from "express";
import cookieParser from "cookie-parser"
import helmet from "helmet";
import { config } from "./config/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { reqLogger } from "./middlewares/req.middleware.js";
import { logger } from "./config/logger.js";
import routes from "./routes/index.js";
import { notFound } from "./middlewares/notFound.middleware.js";

const app = express();


app.use(helmet());
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json())
app.use(reqLogger)

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: "API Gateway is healthy",
        timestamp: new Date().toString()
    })
})

app.use('/api', routes);

app.use(notFound);

app.use(errorHandler)


let server: ReturnType<typeof app.listen>;

const startServer = async () => {
    try {
        server = app.listen(config.PORT, () => {
            logger.info(`server running on PORT : ${config.PORT}`)
        })

    } catch (error) {
        logger.error("Failed to start server", error)
        process.exit(1)
    }
}

const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async (err) => {
        if (err) {
            logger.error("Error while closing server", err);
            process.exit(1);
        }

        try {
            // TODO close db connections
            logger.info("Server closed successfully");
            process.exit(0);
        } catch (error) {
            logger.error("Error during cleanup", error);
            process.exit(1);
        }
    });

    // Force shutdown if connections hang
    setTimeout(() => {
        logger.error("Forcefully shutting down");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer()
