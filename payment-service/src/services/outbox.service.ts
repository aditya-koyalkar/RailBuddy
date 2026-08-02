import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import paymentProducer from "../kafka/producer/payment.producer";

export const processPaymentOutbox = async () => {
    try {
        const pendingEvents = await prisma.paymentOutbox.findMany({
            where: { processed: false },
            orderBy: { createdAt: "asc" },
            take: 20
        });

        if (pendingEvents.length === 0) return;

        for (const event of pendingEvents) {
            try {
                const payload = event.payload as any;

                if (event.eventType === "PAYMENT_CONFIRMED") {
                    await paymentProducer.publishPaymentConfirmed(
                        payload.bookingId,
                        payload.orderId,
                        payload.amount,
                        payload.userId
                    );
                } else if (event.eventType === "PAYMENT_FAILED") {
                    await paymentProducer.publishPaymentFailed(
                        payload.bookingId,
                        payload.orderId,
                        payload.reason
                    );
                } else if (event.eventType === "PAYMENT_REFUNDED") {
                    await paymentProducer.publishPaymentRefunded(
                        payload.bookingId,
                        payload.orderId,
                        payload.refundId,
                        payload.amount
                    );
                }

                await prisma.paymentOutbox.update({
                    where: { id: event.id },
                    data: {
                        processed: true,
                        processedAt: new Date()
                    }
                });

                logger.info(`Outbox event ${event.id} (${event.eventType}) successfully published and marked as processed`);
            } catch (error: any) {
                logger.error(`Failed to process outbox event ${event.id}`, { error: error.message });
                await prisma.paymentOutbox.update({
                    where: { id: event.id },
                    data: {
                        error: error.message || "Kafka dispatch error"
                    }
                });
            }
        }
    } catch (error: any) {
        logger.error(`Outbox processing worker error`, { error: error.message });
    }
};

export const startPaymentOutboxWorker = (intervalMs = 3000) => {
    logger.info(`Starting Payment Outbox Worker (interval: ${intervalMs}ms)...`);
    setInterval(async () => {
        await processPaymentOutbox();
    }, intervalMs);
};

export default { processPaymentOutbox, startPaymentOutboxWorker };
