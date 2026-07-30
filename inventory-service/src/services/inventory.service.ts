import { Prisma } from "@prisma/client";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import inventoryProducer from "../kafka/producer/inventory.producer.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error.js";
import { retryTransaction } from "../utils/retryTransaction.js";

const getAvailabilityInternal = async (
    scheduleId: string,
    schedule: any,
    fromSeq: number,
    toSeq: number
) => {
    const now = new Date();
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    const activeLocks = await prisma.seatSegmentReservation.findMany({
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

    const activeBookings = await prisma.seatSegmentReservation.findMany({
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

    const counts = await getAvailabilityInternal(scheduleId, schedule, fromSeq, toSeq);

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

    const result = await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
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

            //outbox pattern save event to DB , rollback transaction on insert fails.

            await tx.inventoryOutbox.create({
                data: {
                    aggregateType: "ScheduleInventory",
                    aggregateId: scheduleId,
                    eventType: "SeatAvailabilityChanged",
                    payload: {
                        scheduleId,
                        affectedSeatIds: seatIds
                    }
                }
            });

            return {
                bookingId: resolvedBookingId,
                expiresAt: lockExpiresAt,
                schedule
            };
        });
    });

    return {
        bookingId: result.bookingId,
        expiresAt: result.expiresAt
    };
};

export const unlockSeats = async (
    scheduleId: string,
    seatIds: string[],
    userId: string,
    fromSeq: number,
    toSeq: number,
    bookingId?: string
) => {
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId) {
        throw new BadRequestError("Missing required fields for releasing seats");
    }

    const result = await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
            const schedule = await tx.scheduleInventory.findUnique({
                where: { scheduleId }
            });

            if (!schedule) {
                throw new NotFoundError("Schedule inventory not found");
            }
            if (schedule.status !== "ACTIVE") {
                throw new BadRequestError("Schedule is not active");
            }

            const scheduleSeats = await tx.$queryRaw`SELECT * FROM "schedule_seats" WHERE "scheduleId" = ${scheduleId} AND "seatId" IN (${Prisma.join(seatIds)}) FOR UPDATE NOWAIT` as any[];

            if (scheduleSeats.length !== seatIds.length) {
                throw new NotFoundError("One or more seats not found for this schedule");
            }

            const whereClause: any = {
                scheduleId,
                seatId: { in: seatIds },
                fromSequence: fromSeqNum,
                toSequence: toSeqNum,
                lockedBy: userId,
                status: "LOCKED"
            };

            if (bookingId) {
                whereClause.bookingId = bookingId;
            }

            const unlockResult = await tx.seatSegmentReservation.updateMany({
                where: whereClause,
                data: {
                    status: "EXPIRED"
                }
            });

            if (unlockResult.count > 0) {
                await tx.inventoryOutbox.create({
                    data: {
                        aggregateType: "ScheduleInventory",
                        aggregateId: scheduleId,
                        eventType: "SeatAvailabilityChanged",
                        payload: {
                            scheduleId,
                            affectedSeatIds: seatIds
                        }
                    }
                });
            }

            return { count: unlockResult.count };
        });
    });

    return { count: result.count };
};

export const confirmSeats = async (
    scheduleId: string,
    seatIds: string[],
    userId: string,
    fromSeq: number,
    toSeq: number,
    bookingId: string
) => {
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId || !bookingId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for confirming seats");
    }

    const result = await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
            const schedule = await tx.scheduleInventory.findUnique({
                where: { scheduleId }
            });

            if (!schedule) {
                throw new NotFoundError("Schedule inventory not found");
            }
            if (schedule.status !== "ACTIVE") {
                throw new BadRequestError("Schedule is not active");
            }

            const scheduleSeats = await tx.$queryRaw`SELECT * FROM "schedule_seats" WHERE "scheduleId" = ${scheduleId} AND "seatId" IN (${Prisma.join(seatIds)}) FOR UPDATE NOWAIT` as any[];

            if (scheduleSeats.length !== seatIds.length) {
                throw new NotFoundError("One or more seats not found for this schedule");
            }

            const reservations = await tx.seatSegmentReservation.findMany({
                where: {
                    bookingId,
                    scheduleId,
                    lockedBy: userId,
                    status: "LOCKED",
                    fromSequence: fromSeqNum,
                    toSequence: toSeqNum,
                    seatId: { in: seatIds }
                }
            });

            if (reservations.length !== seatIds.length) {
                throw new NotFoundError("One or more reservations not found for confirmation");
            }

            const updateResult = await tx.seatSegmentReservation.updateMany({
                where: {
                    scheduleId,
                    seatId: { in: seatIds },
                    bookingId,
                    lockedBy: userId,
                    status: "LOCKED",
                    fromSequence: fromSeqNum,
                    toSequence: toSeqNum
                },
                data: {
                    status: "BOOKED",
                    version: { increment: 1 }
                }
            });

            if (updateResult.count > 0) {
                await tx.inventoryOutbox.create({
                    data: {
                        aggregateType: "ScheduleInventory",
                        aggregateId: scheduleId,
                        eventType: "SeatAvailabilityChanged",
                        payload: {
                            scheduleId,
                            affectedSeatIds: seatIds
                        }
                    }
                });
            }
            else {
                throw new ConflictError("Failed to confirm seats")
            }

            return { count: updateResult.count };
        });
    });

    return { count: result.count };
};

export const cancelBooking = async (
    scheduleId: string,
    seatIds: string[],
    userId: string,
    fromSeq: number,
    toSeq: number,
    bookingId: string
) => {
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId || !bookingId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for cancelling booking");
    }

    const result = await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
            const schedule = await tx.scheduleInventory.findUnique({
                where: { scheduleId }
            });

            if (!schedule) {
                throw new NotFoundError("Schedule inventory not found");
            }
            if (schedule.status !== "ACTIVE") {
                throw new BadRequestError("Schedule is not active");
            }

            const scheduleSeats = await tx.$queryRaw`SELECT * FROM "schedule_seats" WHERE "scheduleId" = ${scheduleId} AND "seatId" IN (${Prisma.join(seatIds)}) FOR UPDATE NOWAIT` as any[];

            if (scheduleSeats.length !== seatIds.length) {
                throw new NotFoundError("One or more seats not found for this schedule");
            }

            const reservations = await tx.seatSegmentReservation.findMany({
                where: {
                    bookingId,
                    scheduleId,
                    lockedBy: userId,
                    status: "BOOKED",
                    fromSequence: fromSeqNum,
                    toSequence: toSeqNum,
                    seatId: { in: seatIds }
                }
            });

            if (reservations.length !== seatIds.length) {
                throw new NotFoundError("One or more reservations not found for cancellation");
            }

            const updateResult = await tx.seatSegmentReservation.updateMany({
                where: {
                    scheduleId,
                    seatId: { in: seatIds },
                    bookingId,
                    lockedBy: userId,
                    status: "BOOKED",
                    fromSequence: fromSeqNum,
                    toSequence: toSeqNum
                },
                data: {
                    status: "CANCELLED",
                    version: { increment: 1 }
                }
            });

            if (updateResult.count > 0) {
                await tx.inventoryOutbox.create({
                    data: {
                        aggregateType: "ScheduleInventory",
                        aggregateId: scheduleId,
                        eventType: "SeatAvailabilityChanged",
                        payload: {
                            scheduleId,
                            affectedSeatIds: seatIds
                        }
                    }
                });
            }
            else {
                throw new ConflictError("Failed to cancel booking");
            }

            return { count: updateResult.count };
        });
    });

    return { count: result.count };
};

export const getSeatsByIds = async (scheduleId: string, seatIds: string[], fromSeq: number, toSeq: number) => {
    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    if (!scheduleId || !seatIds || seatIds.length === 0) {
        throw new BadRequestError("scheduleId and seatIds are required");
    }
    if (fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("fromSeq and toSeq are required");
    }

    const seats = await prisma.scheduleSeat.findMany({
        where: {
            scheduleId,
            seatId: { in: seatIds }
        }
    });

    if (seats.length !== seatIds.length) {
        const foundIds = new Set(seats.map((s) => s.seatId));
        const missing = seatIds.filter((id) => !foundIds.has(id));
        throw new NotFoundError(`Seats not found: ${missing.join(', ')}`);
    }

    // Check segment availability for each seat
    const now = new Date();
    const overlappingReservations = await prisma.seatSegmentReservation.findMany({
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
        select: { seatId: true, status: true }
    });

    // Build a status map: if any reservation is BOOKED, seat is BOOKED; if LOCKED, seat is LOCKED
    const statusMap = new Map<string, string>();
    for (const r of overlappingReservations) {
        const current = statusMap.get(r.seatId);
        if (r.status === 'BOOKED' || current !== 'BOOKED') {
            statusMap.set(r.seatId, r.status);
        }
    }

    return seats.map((s) => ({
        seatId: s.seatId,
        coachId: s.coachId,
        coachNumber: s.coachNumber,
        coachType: s.coachType,
        seatNumber: s.seatNumber,
        seatLabel: s.seatLabel,
        seatType: s.seatType,
        segmentStatus: statusMap.get(s.seatId) || 'AVAILABLE'
    }));
};

export default { initializeInventory, cancelSheduleInventory, getAvailability, lockSeats, unlockSeats, confirmSeats, cancelBooking, getSeatsByIds }