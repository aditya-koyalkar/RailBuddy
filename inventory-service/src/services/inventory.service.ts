import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import inventoryProducer from "../kafka/producer/inventory.producer.js";
import { NotFoundError } from "../utils/error.js";

const initializeInventory = async (eventData: any) => {
    const payload = eventData.data || eventData;
    const { scheduleId, trainId, trainNumber, trainName, departureDate, seats } = payload;

    if (!scheduleId || !seats) {
        logger.warn(`Inventory initialization failed: Missing scheduleId or seats`, { scheduleId, hasSeats: !!seats });
        return;
    }

    const eventKey = `SCHEDULE_CREATED:${scheduleId}`

    const existing = await prisma.idempotencyRecord.findUnique({
        where: {
            eventKey: eventKey
        }
    })
    if (existing) {
        logger.info(`Inventory already initialized for schedule ${scheduleId}`);
        return;
    }

    const totalSeats = seats.length;

    await prisma.$transaction(async (tx) => {
        const scheduleInventory = await tx.scheduleInventory.create({
            data: {
                scheduleId,
                trainId,
                trainNumber,
                trainName,
                departureDate,
                totalSeats,
                available: totalSeats,
                locked: 0,
                booked: 0,
                status: 'ACTIVE'
            }
        })

        const seatData = seats.map((seat: any) => ({
            scheduleInventoryId: scheduleInventory.id,
            status: 'AVAILABLE',
            scheduleId,
            seatNumber: seat.seatNumber,
            seatType: seat.seatType,
            price: seat.price
        }));

        await tx.seatInventory.createMany({
            data: seatData
        })

        if (payload.route && payload.route.length > 0) {
            const routeStopData = payload.route.map((routeStop: any) => ({
                scheduleId,
                stationId: routeStop.stationId,
                stationName: routeStop.stationName,
                stationCode: routeStop.stationCode,
                sequenceNumber: routeStop.sequenceNumber
            }));


            await tx.routeStop.createMany({
                data: routeStopData
            });

        }

        await tx.idempotencyRecord.create({
            data: {
                eventKey: eventKey
            }
        });
    });

    logger.info(`Inventory initialized successfully for schedule ${scheduleId}`);

    try {
        await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, trainId, totalSeats, 0, 0);
    }
    catch (e) {
        logger.error(`Failed to publish seat availability update for schedule ${scheduleId}: ${e}`);
    }
}

const cancelSheduleInventory = async (eventData: any) => {
    const { scheduleId, trainId } = eventData;

    if (!scheduleId) {
        logger.warn(`Inventory cancellation failed: Missing scheduleId`);
        return;
    }
    const eventKey = `SCHEDULE_CANCELLED:${scheduleId}`

    const existing = await prisma.idempotencyRecord.findUnique({
        where: {
            eventKey: eventKey
        }
    })
    if (existing) {
        logger.info(`Inventory already cancelled for schedule ${scheduleId}`);
        return;
    }

    await prisma.$transaction(async (tx) => {

        await tx.scheduleInventory.update({
            where: {
                scheduleId: scheduleId
            },
            data: {
                status: 'CANCELLED',
                available: 0,
                locked: 0,
                booked: 0,
                version: {
                    increment: 1
                }
            }
        })

        await tx.seatInventory.updateMany({
            where: {
                scheduleId: scheduleId
            },
            data: {
                status: "CANCELLED"
            }
        })

        await tx.idempotencyRecord.create({
            data: {
                eventKey: eventKey
            }
        });
    });

    logger.info(`Inventory cancelled successfully for schedule ${scheduleId}`);

    try {
        await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, trainId, 0, 0, 0);
    }
    catch (e) {
        logger.error(`Failed to publish seat availability update for schedule ${scheduleId}: ${e}`);
    }

}

export const getAvailability = async (scheduleId: string) => {
    const availability = await prisma.scheduleInventory.findUnique({
        where: { scheduleId }
    });

    if (!availability) {
        throw new NotFoundError("Schedule inventory not found");
    }
    return {
        scheduleId: availability.scheduleId,
        trainId: availability.trainId,
        trainNumber: availability.trainNumber,
        trainName: availability.trainName,
        departureDate: availability.departureDate,
        totalSeats: availability.totalSeats,
        available: availability.available,
        locked: availability.locked,
        booked: availability.booked,
        status: availability.status
    }
}



export default { initializeInventory, cancelSheduleInventory, getAvailability }