import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import notificationProducer from "../kafka/producer/notifications.producer.js";

export const processUserOutbox = async () => {
    try {
        const pendingEvents = await prisma.userOutbox.findMany({
            where: { published: false },
            orderBy: { createdAt: "asc" },
            take: 20
        });

        if (pendingEvents.length === 0) return;

        for (const event of pendingEvents) {
            try {
                const payload = event.payload as any;

                if (event.eventType === "OTP_EMAIL") {
                    await notificationProducer.sendOTPEmail(payload.email, payload.otp, payload.ttlMinutes);
                } else if (event.eventType === "WELCOME_EMAIL") {
                    await notificationProducer.sendWelcomeEmail(payload.email, payload.firstName);
                }

                await prisma.userOutbox.update({
                    where: { id: event.id },
                    data: {
                        published: true,
                        publishedAt: new Date()
                    }
                });

                logger.info(`User outbox event ${event.id} (${event.eventType}) published successfully`);
            } catch (error: any) {
                logger.error(`Failed to process user outbox event ${event.id}`, { error: error.message });
                await prisma.userOutbox.update({
                    where: { id: event.id },
                    data: {
                        error: error.message || "Kafka dispatch error"
                    }
                });
            }
        }
    } catch (error: any) {
        logger.error(`User outbox processing worker error`, { error: error.message });
    }
};

export const startUserOutboxWorker = (intervalMs = 3000) => {
    logger.info(`Starting User Outbox Worker (interval: ${intervalMs}ms)...`);
    setInterval(async () => {
        await processUserOutbox();
    }, intervalMs);
};

export default { processUserOutbox, startUserOutboxWorker };
