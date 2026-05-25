import { logger } from "./config/logger.js";
import { emailConsumer } from "./kafka/consumer/email.consumer.js";


async function notificatioService() {
    try {
        logger.info("Starting Notifications service")

        const requiredEnvVars = ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'KAFKA_BROKER']
        const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
        if (missing.length > 0) {
            throw new Error(`Mising required environment variables: ${missing.join(',')}`)
        }

        await emailConsumer.start()

        logger.info(`Notification service started successfully`);
        logger.info(`Service is ready to process notifications`)

    } catch (error: any) {
        logger.error('Failed to start Notification service', {
            error: error.message,
            stack: error.stack
        })
    }
}

notificatioService()