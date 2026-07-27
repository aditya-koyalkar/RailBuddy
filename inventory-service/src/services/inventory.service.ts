import { Prisma } from "@prisma/client";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import inventoryProducer from "../kafka/producer/inventory.producer.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error.js";
import { retryTransaction } from "../utils/retryTransaction.js";

const getAvailabilityInternal = async (
    tx: any,
    scheduleId: string,
    schedule: any,
    fromSeq: number,
    toSeq: number
) => {
    const now = new Date();
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    const activeLocks = await tx.seatSegmentReservation.findMany({
        where: {
            scheduleId,
            status: 'LOCKED',
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } }
            ],
            fromSequence: { lt: toSeqNum },
            toSequence: { gt: fromSeqNum }
        },
        select: { seatId: true }
    });
    const uniqueLockedSeatIds = new Set(activeLocks.map((l: any) => l.seatId));

    const activeBookings = await tx.seatSegmentReservation.findMany({
        where: {
            scheduleId,
            status: 'BOOKED',
            fromSequence: { lt: toSeqNum },
            toSequence: { gt: fromSeqNum }
        },
        select: { seatId: true }
    });
    const uniqueBookedSeatIds = new Set(activeBookings.map((b: any) => b.seatId));

    const unionSeatIds = new Set([...uniqueLockedSeatIds, ...uniqueBookedSeatIds]);
    const occupiedCount = unionSeatIds.size;
    const availableCount = Math.max(0, schedule.totalSeats - occupiedCount);

    return {
        available: availableCount,
        locked: uniqueLockedSeatIds.size,
        booked: uniqueBookedSeatIds.size
    };
};

const initializeInventory = async (eventData: any) => {
    const payload = eventData.data || eventData;
    const { scheduleId, trainId, departureDate, seats } = payload;

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
                departureDate: new Date(departureDate),
                totalSeats,
                status: 'ACTIVE'
            }
        })

        const seatData = seats.map((seat: any) => ({
            scheduleInventoryId: scheduleInventory.id,
            scheduleId,
            seatId: seat.seatId,
            coachId: seat.coachId,
            coachNumber: seat.coachNumber,
            coachType: seat.coachType,
            seatNumber: seat.seatNumber,
            seatLabel: seat.seatLabel,
            seatType: seat.seatType,
            isActive: true
        }));

        await tx.scheduleSeat.createMany({
            data: seatData
        })

        if (payload.route && payload.route.length > 0) {
            const routeStopData = payload.route.map((routeStop: any) => ({
                scheduleId,
                stationId: routeStop.stationId,
                stationName: routeStop.stationName,
                stationCode: routeStop.stationCode,
                sequence: routeStop.sequence,
                arrivalDay: routeStop.arrivalDay ?? null,
                departureDay: routeStop.departureDay ?? null,
                arrivalMinute: routeStop.arrivalMinute ?? null,
                departureMinute: routeStop.departureMinute ?? null
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
                version: {
                    increment: 1
                }
            }
        })

        await tx.seatSegmentReservation.updateMany({
            where: {
                scheduleId,
                status: { in: ['LOCKED', 'BOOKED'] }
            },
            data: {
                status: 'CANCELLED'
            }
        })

        await tx.idempotencyRecord.create({
            data: {
                eventKey: eventKey
            }
        });
    });

    logger.info(`Inventory cancelled successfully for schedule ${scheduleId}`);

    const schedule = await prisma.scheduleInventory.findUnique({
        where: { scheduleId }
    })

    try {
        await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, trainId, schedule?.totalSeats || 0, 0, 0);
    }
    catch (e) {
        logger.error(`Failed to publish seat availability update for schedule ${scheduleId}: ${e}`);
    }
}

export const getAvailability = async (scheduleId: string, fromSeq: number, toSeq: number) => {
    const schedule = await prisma.scheduleInventory.findUnique({
        where: { scheduleId }
    });

    if (!schedule) {
        throw new NotFoundError("Schedule inventory not found");
    }

    const counts = await getAvailabilityInternal(prisma, scheduleId, schedule, fromSeq, toSeq);

    return {
        scheduleId: schedule.scheduleId,
        trainId: schedule.trainId,
        departureDate: schedule.departureDate,
        totalSeats: schedule.totalSeats,
        available: counts.available,
        locked: counts.locked,
        booked: counts.booked,
        status: schedule.status
    }
}

export const lockSeats = async (
    scheduleId: string,
    seatIds: string[],
    userId: string,
    ttlSeconds: number,
    fromSeq: number,
    toSeq: number,
    bookingId?: string
) => {
    const ttl = Math.min(Math.max(ttlSeconds || config.LOCK_TTL_SECONDS, 60), 600);
    const lockExpiresAt = new Date(Date.now() + ttl * 1000);

    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId) {
        throw new BadRequestError("Missing required fields for locking seats");
    }

    return retryTransaction(async () => {
        await prisma.$transaction(async (tx) => {
            const schedule = await tx.scheduleInventory.findUnique({
                where: { scheduleId }
            });

            if (!schedule) {
                throw new NotFoundError("Schedule inventory not found");
            }
            if (schedule.status !== "ACTIVE") {
                throw new BadRequestError("Schedule is not active");
            }

            // Although the ScheduleSeat  table does not store seat availability, it acts as a stable row that can be locked (SELECT ... FOR UPDATE) to serialize concurrent booking attempts for the same seat. The actual availability and occupancy are determined from the SeatSegmentReservation table.

            const scheduleSeats = await tx.$queryRaw`SELECT * FROM "schedule_seats" WHERE "scheduleId" = ${scheduleId} AND "seatId" IN (${Prisma.join(seatIds)}) FOR UPDATE NOWAIT` as any[];

            if (scheduleSeats.length !== seatIds.length) {
                throw new NotFoundError("One or more seats not found for this schedule");
            }


            const fromRouteStop = await tx.routeStop.findUnique({
                where: { scheduleId_sequence: { scheduleId, sequence: fromSeqNum } }
            });
            const toRouteStop = await tx.routeStop.findUnique({
                where: { scheduleId_sequence: { scheduleId, sequence: toSeqNum } }
            });

            if (!fromRouteStop || !toRouteStop) {
                throw new BadRequestError("Invalid from/to sequences for this schedule route");
            }

            const now = new Date();

            const conflict = await tx.seatSegmentReservation.findFirst({
                where: {
                    scheduleId,
                    seatId: { in: seatIds },
                    fromSequence: { lt: toSeqNum },
                    toSequence: { gt: fromSeqNum },
                    OR: [
                        { status: "BOOKED" },
                        { status: "LOCKED", expiresAt: null },
                        { status: "LOCKED", expiresAt: { gt: now } }
                    ]
                },
                select: { seatId: true }
            });

            if (conflict) {
                throw new ConflictError(`Seat ${conflict.seatId} is already locked/booked for overlapping segment`);
            }

            const resolvedBookingId = bookingId || `temp-lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const lockData = scheduleSeats.map((si: any) => ({
                scheduleInventoryId: schedule.id,
                scheduleSeatId: si.id,
                bookingId: resolvedBookingId,
                scheduleId,
                seatId: si.seatId,
                fromStationId: fromRouteStop.stationId,
                toStationId: toRouteStop.stationId,
                fromSequence: fromSeqNum,
                toSequence: toSeqNum,
                status: "LOCKED" as const,
                lockedBy: userId,
                expiresAt: lockExpiresAt
            }));

            await tx.seatSegmentReservation.createMany({
                data: lockData
            });

            const availability = await getAvailabilityInternal(tx, scheduleId, schedule, fromSeqNum, toSeqNum);
            await inventoryProducer.publishSeatAvailabilityUpdated(
                scheduleId,
                schedule.trainId,
                schedule.totalSeats,
                availability.locked,
                availability.booked
            ).catch((err) => logger.error(`Failed to publish seat availability: ${err.message}`));

            return {
                bookingId: resolvedBookingId,
                expiresAt: lockExpiresAt
            };
        });
    })

};

export const unlockSeats = async (
    scheduleId: string,
    seatIds: string[],
    userId: string,
    fromSeq: number,
    toSeq: number
) => {
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId) {
        throw new BadRequestError("Missing required fields for releasing seats");
    }

    return await prisma.$transaction(async (tx) => {
        const schedule = await tx.scheduleInventory.findUnique({
            where: { scheduleId }
        });

        if (!schedule) {
            throw new NotFoundError("Schedule inventory not found");
        }

        const deleteResult = await tx.seatSegmentReservation.deleteMany({
            where: {
                scheduleId,
                seatId: { in: seatIds },
                fromSequence: fromSeqNum,
                toSequence: toSeqNum,
                lockedBy: userId,
                status: "LOCKED"
            }
        });

        if (deleteResult.count > 0) {
            await tx.scheduleInventory.update({
                where: { scheduleId },
                data: {
                    version: { increment: 1 }
                }
            });
        }

        const availability = await getAvailabilityInternal(tx, scheduleId, schedule, fromSeqNum, toSeqNum);
        await inventoryProducer.publishSeatAvailabilityUpdated(
            scheduleId,
            schedule.trainId,
            schedule.totalSeats,
            availability.locked,
            availability.booked
        ).catch((err) => logger.error(`Failed to publish seat availability: ${err.message}`));

        return { count: deleteResult.count };
    });
};

export const confirmSeats = async (scheduleId: string, seatIds: string[], bookingId: string) => {
    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !bookingId) {
        throw new BadRequestError("Missing required fields for confirming seats");
    }

    return await prisma.$transaction(async (tx) => {
        const schedule = await tx.scheduleInventory.findUnique({
            where: { scheduleId }
        });

        if (!schedule) {
            throw new NotFoundError("Schedule inventory not found");
        }

        const reservation = await tx.seatSegmentReservation.findFirst({
            where: {
                bookingId,
                scheduleId,
                status: "LOCKED"
            }
        });

        if (!reservation) {
            throw new NotFoundError("Reservation not found for confirmation");
        }

        const updateResult = await tx.seatSegmentReservation.updateMany({
            where: {
                scheduleId,
                seatId: { in: seatIds },
                bookingId,
                status: "LOCKED"
            },
            data: {
                status: "BOOKED"
            }
        });

        if (updateResult.count > 0) {
            await tx.scheduleInventory.update({
                where: { scheduleId },
                data: {
                    version: { increment: 1 }
                }
            });
        }

        const availability = await getAvailabilityInternal(tx, scheduleId, schedule, reservation.fromSequence, reservation.toSequence);
        await inventoryProducer.publishSeatAvailabilityUpdated(
            scheduleId,
            schedule.trainId,
            schedule.totalSeats,
            availability.locked,
            availability.booked
        ).catch((err) => logger.error(`Failed to publish seat availability: ${err.message}`));

        return { count: updateResult.count };
    });
};

export const cancelBooking = async (scheduleId: string, seatIds: string[], bookingId: string) => {
    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !bookingId) {
        throw new BadRequestError("Missing required fields for cancelling booking");
    }

    return await prisma.$transaction(async (tx) => {
        const schedule = await tx.scheduleInventory.findUnique({
            where: { scheduleId }
        });

        if (!schedule) {
            throw new NotFoundError("Schedule inventory not found");
        }

        const reservation = await tx.seatSegmentReservation.findFirst({
            where: {
                bookingId,
                scheduleId,
                status: "BOOKED"
            }
        });

        if (!reservation) {
            throw new NotFoundError("Reservation not found for cancellation");
        }

        const updateResult = await tx.seatSegmentReservation.updateMany({
            where: {
                scheduleId,
                seatId: { in: seatIds },
                bookingId,
                status: "BOOKED"
            },
            data: {
                status: "CANCELLED"
            }
        });

        if (updateResult.count > 0) {
            await tx.scheduleInventory.update({
                where: { scheduleId },
                data: {
                    version: { increment: 1 }
                }
            });
        }

        const availability = await getAvailabilityInternal(tx, scheduleId, schedule, reservation.fromSequence, reservation.toSequence);
        await inventoryProducer.publishSeatAvailabilityUpdated(
            scheduleId,
            schedule.trainId,
            schedule.totalSeats,
            availability.locked,
            availability.booked
        ).catch((err) => logger.error(`Failed to publish seat availability: ${err.message}`));

        return { count: updateResult.count };
    });
};

export const getSeats = async (
    scheduleId: string,
    filters: {
        status?: string | undefined;
        seatType?: string | undefined;
        fromSeq?: number | undefined;
        toSeq?: number | undefined;
    }
) => {
    const { status, seatType, fromSeq, toSeq } = filters;

    const whereClause: any = { scheduleId };
    if (seatType) {
        whereClause.seatType = seatType;
    }

    const seats = await prisma.scheduleSeat.findMany({
        where: whereClause
    });

    const reservations = await prisma.seatSegmentReservation.findMany({
        where: {
            scheduleId,
            status: { in: ["LOCKED", "BOOKED"] }
        }
    });

    const now = new Date();
    const activeReservations = reservations.filter(
        res => res.status === "BOOKED" || !res.expiresAt || res.expiresAt > now
    );

    let resultSeats = seats.map(seat => {
        const seatReservations = activeReservations.filter(res => res.seatId === seat.seatId);

        let segmentStatus = "AVAILABLE";
        if (fromSeq !== undefined && toSeq !== undefined) {
            const fromSeqNum = Number(fromSeq);
            const toSeqNum = Number(toSeq);
            const isReserved = seatReservations.some(
                lock => lock.fromSequence < toSeqNum && lock.toSequence > fromSeqNum
            );
            if (isReserved) {
                const overlappingRes = seatReservations.find(
                    lock => lock.fromSequence < toSeqNum && lock.toSequence > fromSeqNum
                );
                segmentStatus = overlappingRes?.status || "AVAILABLE";
            }
        } else {
            if (seatReservations.length > 0) {
                segmentStatus = seatReservations[0].status;
            }
        }

        return {
            ...seat,
            segmentStatus
        };
    });

    if (status) {
        resultSeats = resultSeats.filter(seat => seat.segmentStatus === status);
    }

    return resultSeats;
};

export default { initializeInventory, cancelSheduleInventory, getAvailability, lockSeats, unlockSeats, confirmSeats, cancelBooking, getSeats }