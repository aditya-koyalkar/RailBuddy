import { connectProducer, producer } from "../../config/kafka";
import { logger } from "../../config/logger";
import { TOPICS } from "../../utils/constants";

class InventoryProducer {
    isInitialized;
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        await connectProducer()
        this.isInitialized = true;
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

    // Helper methods for specific topics
    async publishSeatAvailabilityUpdated(scheduleId: string, trainId: string, totalSeats: number, lockedSeats: number, bookedSeats: number) {
        const data = {
            scheduleId,
            trainId,
            totalSeats,
            lockedSeats,
            bookedSeats,
            availableSeats: totalSeats - lockedSeats - bookedSeats,
            timestamp: Date.now()
        };

        return this.sendMessage(
            TOPICS.SEAT_AVAILABILITY_UPDATED,
            `SEAT_AVAILABILITY_UPDATED:${scheduleId}`,
            data
        );
    }
}

export default new InventoryProducer()


