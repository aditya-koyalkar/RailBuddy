import { consumer } from "../../config/kafka.js"
import { logger } from "../../config/logger.js"
import { TOPICS } from "../../utils/constants.js"
import emailService from "../../services/email.service.js";

class EmailConsumer {
    async start() {
        try {
            await consumer.connect()
            logger.info('Email consumer connected to Kafka')
            await consumer.subscribe({
                topics: Object.values(TOPICS),
                fromBeginning: false
            })

            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const value = JSON.parse(message.value?.toString() || "")
                        logger.info(`Processing message from topic : ${topic}`, {
                            partition,
                            offset: message.offset
                        })

                        await this.handleMessage(topic, value)
                    }
                    catch (error: any) {
                        logger.error("Error processing message", {
                            topic,
                            error: error.message,
                            stack: error.stack
                        })
                        // TODO send to dead letter queue
                    }
                }
            })
        }
        catch (error: any) {
            logger.error("Faied to start the email consuner", {
                error: error.message
            })
            throw error
        }
    }
    async handleMessage(topic: string, data: any) {
        switch (topic) {
            case TOPICS.OTP_EMAIL:
                await this.handleOTPEmail(data);
                break;
            case TOPICS.WELCOME_EMAIL:
                await this.handleWelcomeEmail(data);
                break;
            default:
                break;
        }
    }
    async handleOTPEmail(data: any) {
        const { email, otp, ttlMinutes } = data;
        if (!email || !otp) {
            throw new Error("Missing required data email or otp")
        }
        await emailService.sendOTPEmail(email, otp, ttlMinutes || 5);
        logger.info(`OTP email sent to ${email}`)

    }
    async handleWelcomeEmail(data: any) {
        const { email } = data;
        if (!email) {
            throw new Error("Missing required data email or otp")
        }
        await emailService.sendWelcomeEmail(email);
        logger.info(`OTP email sent to ${email}`)

    }
}

export const emailConsumer = new EmailConsumer()

