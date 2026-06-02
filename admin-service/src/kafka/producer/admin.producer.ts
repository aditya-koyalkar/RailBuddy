import { Station, Train } from "@prisma/client";
import { connectProducer, producer } from "../../config/kafka";
import { TOPICS } from "../../utils/constants";
import { logger } from "../../config/logger";

class AdminProducer {
    isInitialized;
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        await connectProducer()
        this.isInitialized = true;
    }

    async publishStationCreated(station: Station) {
        return this.sendMessage(TOPICS.STATION_CREATED, `station-${station.id}`, {
            eventType: 'STATION_CREATED',
            data: station, timeStamp: new Date().toISOString()
        })
    }

    async publishTrainCreated(train: Train) {
        return this.sendMessage(TOPICS.TRAIN_CREATED, `train-${train.id}`, {
            eventType: 'TRAIN_CREATED',
            data: train, timeStamp: new Date().toISOString()
        })
    }


    async sendMessage(topic: string, key: string, value: any) {
        try {
            await this.initialize()
            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timeStamp: Date.now().toString()
                }]
            }
            const result = await producer.send(message);
            logger.info(`Message sent to kafka topic : ${topic}`, {
                key,
                partition: result[0]?.partition,
                offset: result[0]?.offset
            })

            return result
        }
        catch (e: any) {
            logger.error("failed to send message o kafka topic : ", topic, {
                error: e.error,
                stack: e.stack, key
            })
            throw e
        }
    }
}

export const adminProducer = new AdminProducer()


