import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { adminProducer } from "../kafka/producer/admin.producer";

export const processAdminOutbox = async () => {
    try {
        const pendingEvents = await prisma.adminOutbox.findMany({
            where: { published: false },
            orderBy: { createdAt: "asc" },
            take: 20
        });

        if (pendingEvents.length === 0) return;

        for (const event of pendingEvents) {
            try {
                const payload = event.payload as any;

                if (event.eventType === "STATION_CREATED") {
                    await adminProducer.publishStationCreated(payload);
                } else if (event.eventType === "TRAIN_CREATED") {
                    await adminProducer.publishTrainCreated(payload);
                } else if (event.eventType === "ROUTE_CREATED") {
                    await adminProducer.publishRouteCreated(payload);
                } else if (event.eventType === "SCHEDULE_CREATED") {
                    await adminProducer.publishScheduleCreated(payload.schedule, payload.train);
                }

                await prisma.adminOutbox.update({
                    where: { id: event.id },
                    data: {
                        published: true,
                        publishedAt: new Date()
                    }
                });

                logger.info(`Admin outbox event ${event.id} (${event.eventType}) published successfully`);
            } catch (error: any) {
                logger.error(`Failed to process admin outbox event ${event.id}`, { error: error.message });
                await prisma.adminOutbox.update({
                    where: { id: event.id },
                    data: {
                        error: error.message || "Kafka dispatch error"
                    }
                });
            }
        }
    } catch (error: any) {
        logger.error(`Admin outbox processing worker error`, { error: error.message });
    }
};

export const startAdminOutboxWorker = (intervalMs = 3000) => {
    logger.info(`Starting Admin Outbox Worker (interval: ${intervalMs}ms)...`);
    setInterval(async () => {
        await processAdminOutbox();
    }, intervalMs);
};

export default { processAdminOutbox, startAdminOutboxWorker };
