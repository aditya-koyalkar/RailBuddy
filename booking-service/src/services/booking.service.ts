import { config } from "../config"
import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { acquireSeatLocks, releaseSeatLocks } from "../utils/distributedLock"
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from "../utils/error"
import inventoryClient from "./inventoryClient"
import adminClient from "./adminClient"
import paymentClient from "./paymentClient"
import sagaService from "./saga.service"

const normalizeGender = (g: string) => {
    const upper = String(g).toUpperCase();
    if (upper === "MALE" || upper === "FEMALE" || upper === "OTHER") {
        return upper as any;
    }
    return "OTHER" as any;
};

const generatePNR = () => {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const createBooking = async (
    userId: string,
    scheduleId: string,
    seatIds: Array<string>,
    passengers: Array<any>,
    idempotencyKey: string,
    fromStationId: string,
    toStationId: string,
    fromSeq: number,
    toSeq: number,
    trainId: string
) => {
    if (!userId || !scheduleId || !seatIds || !passengers || !idempotencyKey || !trainId) {
        throw new Error("All fields are required")
    }
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
        throw new Error("Seat IDs are required")
    }
    if (!Array.isArray(passengers) || passengers.length !== seatIds.length) {
        throw new Error("Passengers are required and must be equal to the number of seats")
    }
    if (Number(fromSeq) >= Number(toSeq)) {
        throw new Error("fromSeq must be less than toSeq")
    }

    // incase of duplicate request return the stored response. Ex : (user retrying on a network error or request timeout)

    const cached = await checkIdempotency(`booking:${idempotencyKey}`);

    if (cached) {
        return cached;
    }

    const availability = await inventoryClient.getAvailability(scheduleId)

    if (availability.status !== 'ACTIVE') {
        throw new BadRequestError('Schedule is not active');
    }

    if (new Date(availability.departureDate) < new Date()) {
        throw new BadRequestError('cannot book a train that is already departed')
    }

    // Fetch train details from admin service (including fares and route stops)
    const train = await adminClient.getTrainDetails(trainId, userId);
    const stops = train.route?.stops || [];
    const fromStop = stops.find((s: any) => s.stationId === fromStationId);
    const toStop = stops.find((s: any) => s.stationId === toStationId);

    const fromStationCode = fromStop?.station?.code || "";
    const fromStationName = fromStop?.station?.name || "";
    const toStationCode = toStop?.station?.code || "";
    const toStationName = toStop?.station?.name || "";

    // Fetch seat metadata + segment availability from inventory service
    const seats = await inventoryClient.getSeatsByIds(scheduleId, seatIds, fromSeq, toSeq);

    const bookingSeats = seats;
    const seatFaresMap = new Map<string, number>();
    let totalAmount = 0;

    const fares = train.fares || [];

    for (const seat of seats) {
        if (seat.segmentStatus !== 'AVAILABLE') {
            throw new BadRequestError(`Seat ${seat.seatId} is not available (status: ${seat.segmentStatus})`, 'SEAT_UNAVAILABLE');
        }

        const fareObj = fares.find((f: any) =>
            f.fromStationId === fromStationId &&
            f.toStationId === toStationId &&
            f.coachType?.toUpperCase() === seat.coachType.toUpperCase()
        );

        const seatFare = fareObj ? Number(fareObj.fare) : 0;

        seatFaresMap.set(seat.seatId, seatFare);
        totalAmount += seatFare;
    }

    const sortedSeatIds = [...seatIds].sort();

    // Even though we have row-level locking in inventory DB, Redis distributed lock is used to shield the inventory database from connection exhaustion during high traffic.

    const { acquired, lockValue } = await acquireSeatLocks(scheduleId, sortedSeatIds, `pre-${Date.now()}`, config.BOOKING_TTL_SECONDS, fromSeq, toSeq)

    if (!acquired) {
        throw new ConflictError(`One or more seats are being already being booked by other user.Please try again.`);
    }

    let booking: any;

    try {
        const lockExpiresAt = new Date(Date.now() + config.BOOKING_TTL_SECONDS * 1000);

        const pnr = generatePNR();

        booking = await prisma.$transaction(async (tx) => {
            const created = await tx.booking.create({
                data: {
                    pnr,
                    userId,
                    scheduleId,
                    trainId,
                    trainNumber: train.trainNumber,
                    trainName: train.name,
                    departureDate: new Date(availability.departureDate),
                    fromStationId,
                    fromStationCode,
                    fromStationName,
                    toStationId,
                    toStationCode,
                    toStationName,
                    fromSequence: Number(fromSeq),
                    toSequence: Number(toSeq),
                    passengerCount: passengers.length,
                    totalFare: totalAmount,
                    status: 'PENDING',
                    idempotencyKey,
                    expiresAt: lockExpiresAt,
                    version: availability.version,
                    passengers: {
                        create: passengers.map((p: any) => ({
                            name: p.name,
                            age: Number(p.age),
                            gender: normalizeGender(p.gender)
                        }))
                    }
                },
                include: {
                    passengers: true
                }
            });

            const seatAssignmentsData = created.passengers.map((passenger, index) => {
                const seat = bookingSeats[index];
                const fare = seatFaresMap.get(seat.seatId) ?? 0;
                return {
                    bookingId: created.id,
                    passengerId: passenger.id,
                    seatId: seat.seatId,
                    coachNumber: seat.coachNumber,
                    coachType: seat.coachType,
                    seatNumber: Number(seat.seatNumber),
                    seatLabel: seat.seatLabel,
                    seatType: seat.seatType,
                    fare
                };
            });

            await tx.seatAssignment.createMany({
                data: seatAssignmentsData
            });

            return created;
        });

        // Execute saga step 1 : Hold seats in inventory
        await sagaService.executeHoldSeats(booking, sortedSeatIds, config.LOCK_TTL_SECONDS, fromSeq, toSeq)

        // Execute saga step 2 :  Create payment order
        const reloadedBooking = await prisma.booking.findUnique({
            where: { id: booking.id }
        });
        const paymentOrder = await sagaService.executeCreatePaymentOrder(reloadedBooking!)

        booking = await prisma.booking.findUnique({
            where: {
                id: booking.id
            },
            include: {
                seatAssignments: true,
                passengers: true
            }
        })

        if (!booking) {
            throw new Error('Booking not found')
        }

        const response = {
            bookingId: booking.id,
            pnr: booking.pnr,
            userId: booking.userId,
            status: booking.status,
            totalAmount: Number(booking.totalFare),
            lockExpiresAt: booking.expiresAt,
            seats: booking.seatAssignments.map((seat: any) => ({
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                price: Number(seat.fare),
                seatType: seat.seatType,
                coachNumber: seat.coachNumber,
                coachType: seat.coachType,
                seatLabel: seat.seatLabel
            })),
            passengers: booking.passengers.map((passenger: any) => ({
                name: passenger.name,
                age: passenger.age,
                gender: passenger.gender,
            })),
            paymentOrder: {
                paymentOrderId: paymentOrder.orderId,
                amount: paymentOrder.amount,
                currency: paymentOrder.currency,
                status: paymentOrder.status,
                checkoutUrl: paymentOrder.checkoutUrl
            },
        };

        await saveIdenpotency(`booking:${idempotencyKey}`, response)

        return response;

    }
    catch (error: any) {
        logger.error(`Failed to create booking for user ${userId}`, {
            error: error.message,
            code: error.code
        })

        // Compensate on failure
        if (booking) {
            await sagaService.compensateAll(booking, sortedSeatIds);
            // mark the created booking using transaction as failed
            await prisma.booking.update({
                where: {
                    id: booking.id as string
                },
                data: {
                    status: 'FAILED',
                    failureReason: error.response?.data?.message || error.message
                }
            })
        }
        throw error
    }
    finally {
        // releasing lock on both success and failure. (success because user might cancel booking and retry the same seat)
        if (lockValue) {
            await releaseSeatLocks(scheduleId, sortedSeatIds, lockValue!, fromSeq, toSeq);
        }
    }
}

async function checkIdempotency(key: string) {
    const record = await prisma.idempotencyRecord.findUnique({
        where: {
            key: key
        }
    })

    if (record) {
        logger.info(`Idempotency record found for key ${key}`, record)
        return record.response;
    }

    return null;
}

async function saveIdenpotency(key: string, value: any) {
    await prisma.idempotencyRecord.create({
        data: {
            key: key,
            response: value,
        }
    })
}

async function cancelBooking(bookingId: string, userId: string, reason?: string) {
    if (!bookingId || !userId) {
        throw new BadRequestError("bookingId and userId are required");
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            seatAssignments: true,
            payment: true
        }
    });

    if (!booking) {
        throw new NotFoundError("Booking not found");
    }

    if (booking.userId !== userId) {
        throw new ForbiddenError("You are not authorized to cancel this booking");
    }

    if (booking.status === "CANCELLED") {
        logger.info(`Booking ${bookingId} is already CANCELLED`);
        return booking;
    }

    if (booking.status === "FAILED" || booking.status === "EXPIRED") {
        throw new BadRequestError(`Cannot cancel booking in ${booking.status} status`);
    }

    const seatIds = booking.seatAssignments.map((s) => s.seatId);

    // Free seat segment reservations in inventory-service
    try {
        if (booking.status === "CONFIRMED") {
            await inventoryClient.cancelBooking(
                booking.scheduleId,
                seatIds,
                booking.userId,
                booking.fromSequence,
                booking.toSequence,
                booking.id
            );
        } else {
            await inventoryClient.releaseSeats(
                booking.scheduleId,
                seatIds,
                booking.userId,
                booking.fromSequence,
                booking.toSequence,
                booking.id
            );
        }
    } catch (error: any) {
        logger.error(`Error freeing inventory seats during cancellation for booking ${bookingId}`, { error: error.message });
    }

    // Process refund if payment was SUCCESS/PAID
    const payment = booking.payment;
    let refundResult = null;

    if (payment && (payment.status === "SUCCESS" || payment.status === "PENDING")) {
        try {
            refundResult = await paymentClient.refundPayment(bookingId, Number(booking.totalFare), reason || "Customer requested cancellation");
            logger.info(`Payment refund initiated for cancelled booking ${bookingId}`);
        } catch (error: any) {
            logger.error(`Error issuing payment refund for booking ${bookingId}`, { error: error.message });
        }
    }

    // Update booking status to CANCELLED
    const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: "CANCELLED",
            failureReason: reason || "Cancelled by user",
            cancelledAt: new Date()
        }
    });

    // Record CANCEL_SEATS saga step
    await prisma.sagaLog.create({
        data: {
            bookingId,
            step: "CANCEL_SEATS",
            status: "COMPLETED",
            response: {
                cancelledAt: new Date(),
                reason: reason || "Cancelled by user",
                refundResult
            }
        }
    });

    logger.info(`Booking ${bookingId} successfully cancelled`);

    return updatedBooking;
}

export default { createBooking, cancelBooking };