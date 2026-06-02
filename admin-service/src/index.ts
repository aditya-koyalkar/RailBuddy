import express from "express";
import cookieParser from "cookie-parser"
import helmet from "helmet";
import { config } from "./config/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { logger } from "./config/logger.js";
import { reqLogger } from "./middlewares/req.middleware.js";
import stationRoutes from "./routes/station.route.js"
import trainRoutes from "./routes/train.route.js"

const app = express();


app.use(helmet());
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json())
app.use(reqLogger)
app.use('/api/v1/station', stationRoutes)
app.use('/api/v1/train', trainRoutes)

app.get("/", (_req, res) => {
    res.status(200).json({
        message: "ok"
    })
})

app.use(errorHandler)

const startServer = async () => {
    try {
        app.listen(config.PORT, () => {
            logger.info(`server running on PORT : ${config.PORT}`)
        })

    } catch (error) {
        logger.error("Failed to start server", error)
        process.exit(1)
    }
}


startServer()
