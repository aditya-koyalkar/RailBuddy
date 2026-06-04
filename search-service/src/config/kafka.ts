
import { config } from "./index.js"
import { Kafka, logLevel } from "kafkajs";
import { logger } from "./logger.js";

const kafka = new Kafka({
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
    groupId: 'search-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000
})

const disconnectAll = async () => {
    await consumer.disconnect()
    logger.info("Kafka disconnected")
}

process.on("SIGTERM", disconnectAll)
process.on("SIGINT", disconnectAll)