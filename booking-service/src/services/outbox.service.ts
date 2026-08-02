import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import bookingProducer from "../kafka/producer/booking.producer";

export const processBookingOutbox = async () => {
    try {
        const pendingEvents = await prisma.bookingOutbox.findMany({
            where: { published: false },
            orderBy: { createdAt: "asc" },
            take: 20
        });

        if (pendingEvents.length === 0) return;

        for (const event of pendingEvents) {
            try {
                const payload = event.payload as any;

                if (event.eventType === "BOOKING_CREATED") {
                    await bookingProducer.publishBookingCreated(payload);
                } else if (event.eventType === "BOOKING_CONFIRMED") {
                    await bookingProducer.publishBookingConfirmed(payload);
                } else if (event.eventType === "BOOKING_CANCELLED") {
                    await bookingProducer.publishBookingCancelled(payload);
                } else if (event.eventType === "BOOKING_FAILED") {
                    await bookingProducer.publishBookingFailed(payload);
                }

                await prisma.bookingOutbox.update({
                    where: { id: event.id },
                    data: {
                        published: true,
                        publishedAt: new Date()
                    }
                });

                logger.info(`Booking outbox event ${event.id} (${event.eventType}) successfully published`);
            } catch (error: any) {
                logger.error(`Failed to process booking outbox event ${event.id}`, { error: error.message });
                await prisma.bookingOutbox.update({
                    where: { id: event.id },
                    data: {
                        error: error.message || "Kafka dispatch error"
                    }
                });
            }
        }
    } catch (error: any) {
        logger.error(`Booking outbox processing worker error`, { error: error.message });
    }
};

export const startBookingOutboxWorker = (intervalMs = 3000) => {
    logger.info(`Starting Booking Outbox Worker (interval: ${intervalMs}ms)...`);
    setInterval(async () => {
        await processBookingOutbox();
    }, intervalMs);
};

export default { processBookingOutbox, startBookingOutboxWorker };
