import { Kafka, logLevel } from "kafkajs";
import { config } from "./index.js";
import { logger } from "./logger.js";


export const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: [config.KAFKA_BROKER],
    logLevel: logLevel.ERROR,
    retry: {
        initialRetryTime: 300,
        retries: 8,
        maxRetryTime: 30000
    }
})


export const consumer = kafka.consumer({
    groupId: 'notification-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000
})


const shutdown = async () => {
    logger.info('Shutting down Kafka connections...')
    await consumer.disconnect();
    process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINt', shutdown)


