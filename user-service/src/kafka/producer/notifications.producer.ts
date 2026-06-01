import { connectProducer, producer } from "../../config/kafka.js";
import { logger } from "../../config/logger.js";
import { TOPICS } from "../../utils/constants.js";

class NotificationProducer {
    isInitialized
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        if (!this.isInitialized) {
            await connectProducer()
            this.isInitialized = true;
        }
    }

    async sendOTPEmail(email: string, otp: string, ttlMinutes = 5) {
        return this.sendMessage(
            TOPICS.OTP_EMAIL,
            `otp-${email}`,
            {
                email, otp, ttlMinutes
            }
        )
    }

    async sendWelcomeEmail(email: string, firstName: string) {
        return this.sendMessage(TOPICS.WELCOME_EMAIL, `welcome-${email}`, {
            email,
            firstName
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

const notificationProducer = new NotificationProducer();

export default notificationProducer