import { Kafka, logLevel } from "kafkajs";
import { config } from "./index";
import { logger } from "./logger";

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


export const producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
    idempotent: true,
    maxInFlightRequests: 5,
    retry: {
        retries: 5
    }

})


export const consumer = kafka.consumer({
    groupId: 'inventory-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000
})


let isConnected = false;

export const connectProducer = async () => {
    if (!isConnected) {
        await producer.connect();
        isConnected = true;
        logger.info("Kafka producer connected")
    }

}

export const disconnectProducer = async () => {
    if (isConnected) {
        await producer.disconnect()
        isConnected = false;
        logger.info('Kafka producer disconnected')
    }
}

process.on('SIGTERM', disconnectProducer)
process.on('SIGINt', disconnectProducer)


