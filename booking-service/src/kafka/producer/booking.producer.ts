import { connectProducer, producer } from "../../config/kafka";
import { logger } from "../../config/logger";
import { TOPICS } from "../../utils/constants";

class BookingProducer {
    isInitialized: boolean;
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            await connectProducer();
            this.isInitialized = true;
        }
    }

    async sendMessage(topic: string, key: string, value: any) {
        try {
            await this.initialize();
            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timeStamp: Date.now().toString()
                }]
            };
            const result = await producer.send(message);
            logger.info(`Message sent to Kafka topic: ${topic}`, {
                key,
                partition: result[0]?.partition,
                offset: result[0]?.offset
            });

            return result;
        } catch (e: any) {
            logger.error(`Failed to send message to Kafka topic: ${topic}`, {
                error: e.error || e.message,
                key
            });
            throw e;
        }
    }

    async publishBookingCreated(data: any) {
        return this.sendMessage(
            TOPICS.BOOKING_CREATED,
            `BOOKING_CREATED:${data.bookingId || data.id}`,
            { eventType: "BOOKING_CREATED", data, timestamp: Date.now() }
        );
    }

    async publishBookingConfirmed(data: any) {
        return this.sendMessage(
            TOPICS.BOOKING_CONFIRMED,
            `BOOKING_CONFIRMED:${data.bookingId || data.id}`,
            { eventType: "BOOKING_CONFIRMED", data, timestamp: Date.now() }
        );
    }

    async publishBookingCancelled(data: any) {
        return this.sendMessage(
            TOPICS.BOOKING_CANCELLED,
            `BOOKING_CANCELLED:${data.bookingId || data.id}`,
            { eventType: "BOOKING_CANCELLED", data, timestamp: Date.now() }
        );
    }

    async publishBookingFailed(data: any) {
        return this.sendMessage(
            TOPICS.BOOKING_FAILED,
            `BOOKING_FAILED:${data.bookingId || data.id}`,
            { eventType: "BOOKING_FAILED", data, timestamp: Date.now() }
        );
    }
}

export default new BookingProducer();
