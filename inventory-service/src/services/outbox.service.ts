import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import inventoryProducer from "../kafka/producer/inventory.producer.js";

export const processInventoryOutbox = async () => {
    try {
        const pendingEvents = await prisma.inventoryOutbox.findMany({
            where: { published: false },
            orderBy: { createdAt: "asc" },
            take: 20
        });

        if (pendingEvents.length === 0) return;

        for (const event of pendingEvents) {
            try {
                const payload = event.payload as any;
                const scheduleId = payload.scheduleId;

                if (event.eventType === "SeatAvailabilityChanged" && scheduleId) {
                    const schedule = await prisma.scheduleInventory.findUnique({
                        where: { scheduleId }
                    });

                    if (schedule) {
                        const now = new Date();

                        const activeLocks = await prisma.seatSegmentReservation.findMany({
                            where: {
                                scheduleId,
                                status: "LOCKED",
                                OR: [
                                    { expiresAt: null },
                                    { expiresAt: { gt: now } }
                                ]
                            },
                            select: { seatId: true }
                        });
                        const uniqueLockedSeatIds = new Set(activeLocks.map((l) => l.seatId));

                        const activeBookings = await prisma.seatSegmentReservation.findMany({
                            where: {
                                scheduleId,
                                status: "BOOKED"
                            },
                            select: { seatId: true }
                        });
                        const uniqueBookedSeatIds = new Set(activeBookings.map((b) => b.seatId));

                        await inventoryProducer.publishSeatAvailabilityUpdated(
                            scheduleId,
                            schedule.trainId,
                            schedule.totalSeats,
                            uniqueLockedSeatIds.size,
                            uniqueBookedSeatIds.size
                        );
                    }
                }

                await prisma.inventoryOutbox.update({
                    where: { id: event.id },
                    data: {
                        published: true,
                        publishedAt: new Date()
                    }
                });

                logger.info(`Inventory outbox event ${event.id} (${event.eventType}) successfully processed and published`);
            } catch (error: any) {
                logger.error(`Failed to process inventory outbox event ${event.id}`, { error: error.message });
            }
        }
    } catch (error: any) {
        logger.error(`Inventory outbox processing worker error`, { error: error.message });
    }
};

export const startInventoryOutboxWorker = (intervalMs = 3000) => {
    logger.info(`Starting Inventory Outbox Worker (interval: ${intervalMs}ms)...`);
    setInterval(async () => {
        await processInventoryOutbox();
    }, intervalMs);
};

export default { processInventoryOutbox, startInventoryOutboxWorker };
