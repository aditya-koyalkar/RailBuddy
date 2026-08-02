import { connectProducer, producer } from "../../config/kafka";
import { logger } from "../../config/logger";
import { TOPICS } from "../../utils/constants";

class PaymentProducer {
    private isInitialized = false;

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
                    timestamp: Date.now().toString()
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
                error: e.message || e,
                key
            });
            throw e;
        }
    }

    async publishPaymentConfirmed(bookingId: string, orderId: string, amount: number, userId: string) {
        const payload = {
            bookingId,
            orderId,
            amount,
            userId,
            status: "PAID",
            timestamp: Date.now()
        };

        return this.sendMessage(
            TOPICS.PAYMENT_CONFIRMED,
            `PAYMENT_CONFIRMED:${bookingId}`,
            payload
        );
    }

    async publishPaymentFailed(bookingId: string, orderId: string, reason: string) {
        const payload = {
            bookingId,
            orderId,
            reason,
            status: "FAILED",
            timestamp: Date.now()
        };

        return this.sendMessage(
            TOPICS.PAYMENT_FAILED,
            `PAYMENT_FAILED:${bookingId}`,
            payload
        );
    }

    async publishPaymentRefunded(bookingId: string, orderId: string, refundId: string, amount: number) {
        const payload = {
            bookingId,
            orderId,
            refundId,
            amount,
            status: "REFUNDED",
            timestamp: Date.now()
        };

        return this.sendMessage(
            TOPICS.PAYMENT_REFUNDED,
            `PAYMENT_REFUNDED:${bookingId}`,
            payload
        );
    }
}

export default new PaymentProducer();
