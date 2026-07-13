import { config } from "../config"
import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { acquireSeatLocks, releaseSeatLocks } from "../utils/distributedLock"
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error"
import inventoryClient from "./inventoryClient"
import sagaService from "./saga.service"

const createBooking = async (userId: string, scheduleId: string, seatIds: Array<string>, passengers: Array<string>, idempotencyKey: string, fromStationId: string, toStationId: string, fromSeq: number, toSeq: number, trainId: string) => {
    if (!userId || !scheduleId || !seatIds || !passengers || !idempotencyKey || !trainId) {
        throw new Error("All fields are required")
    }
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
        throw new Error("Seat ids are required")
    }
    if (!Array.isArray(passengers) || passengers.length !== seatIds.length) {
        throw new Error("Passengers are required and must be equal to the number of seats")
    }
    if (fromSeq >= toSeq) {
        throw new Error("fromSeq must be less than toSeq")
    }

    const cached = await checkIdempotency(`booking:${idempotencyKey}`);

    if (cached) {
        return cached;
    }

    const availability = await inventoryClient.getAvailability(scheduleId)

    if (availability.status === 'ACTIVE') {
        throw new BadRequestError('Schedule is not active');
    }

    if (new Date(availability.departureDate) < new Date()) {
        throw new BadRequestError('cannot book a train that is already departed')
    }

    const seatData = await inventoryClient.getSeats(scheduleId, { status: 'AVAILABLE', seatType: 'SLEEPER', fromSeq, toSeq })

    if (!seatData) {
        throw new BadRequestError('Seat data not found')
    }

    const seatMap = new Map(seatData.seats.map((s: any) => [s.seatId, s]))

    const bookingSeats = [];
    let totalAmount = 0;

    for (const seatId of seatIds) {
        const seat: any = seatMap.get(seatId);

        if (!seat) {
            throw new NotFoundError(`Seat ${seatId} not found`)
        }

        const isAvailable = (fromSeq && toSeq && seat.segmentStatus !== undefined) ? seat.segmentStatus === 'AVAILABLE' : seat.status === 'AVAILABLE';

        if (!isAvailable) {
            throw new BadRequestError(`Seat ${seatId} is not available`, 'SEAT_UNAVAILABLE');
        }


        bookingSeats.push(seat);
        totalAmount += seat.price;
    }

    const sortedSeatIds = [...seatIds].sort();

    const { acquired, lockValue } = await acquireSeatLocks(scheduleId, sortedSeatIds, `pre-${Date.now()}`, config.BOOKING_TTL_SECONDS, fromSeq, toSeq)

    if (!acquired) {
        throw new ConflictError(`One or more seats are being already being booked by other user.Please try again.`);
    }

    let booking;

    try {

        const lockExpiresAt = new Date(Date.now() + config.BOOKING_TTL_SECONDS * 1000);

        booking = {
            userId,
            scheduleId,
            seats: bookingSeats,
            totalAmount,
            status: 'PENDING',
            createdAt: new Date(),
            expiresAt: lockExpiresAt,
            lockValue: lockValue,

        }
        booking = await prisma.booking.create({
            data: {
                userId,
                scheduleId,
                status: 'PENDING',
                departureDate: new Date(availability.departureDate),
                trainId: availability.trainId,
                trainName: availability.trainName,
                totalAmount,
                seatCount: seatIds.length,
                fromStationId: fromStationId || null,
                toStationId: toStationId || null,
                fromSeq: fromSeq || null,
                toSeq: toSeq || null,
                idempotencyKey,
                lockExpiresAt,
                trainNumber: availability.trainNumber,
                version: availability.version,
                seats: {
                    create: bookingSeats.map(seat => ({
                        seatId: seat.seatId,
                        seatNumber: seat.seatNumber,
                        class: seat.class,
                        price: seat.price,
                        seatType: seat.seatType
                    }))
                },
                passengers: {
                    create: passengers.map((passenger: any) => ({
                        name: passenger.name,
                        age: passenger.age,
                        gender: passenger.gender,

                    }))
                },
            },
            include: {
                seats: true,
                passengers: true
            }
        });

        // Execute saga step 1 : Hold seats in inventory

        await sagaService.executeHoldSeats(booking, sortedSeatIds, config.LOCK_TTL_SECONDS, fromSeq, toSeq)

        // Execute saga step 2 :  Create payment order

        const paymentOrder = await sagaService.executeCreatePaymentOrder(booking)


        booking = await prisma.booking.findUnique({
            where: {
                id: booking.id
            },
            include: {
                seats: true,
                passengers: true
            }
        })

        if (!booking) {
            throw new Error('Booking not found')
        }

        const response = {
            bookingId: booking.id,
            userId: booking.userId,
            status: booking.status,
            totalAmount: booking.totalAmount,
            lockExpiresAt: booking.lockExpiresAt,
            seats: booking.seats.map(seat => ({
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                price: seat.price,
                seatType: seat.seatType,
            })),
            passengers: booking.passengers.map(passenger => ({
                name: passenger.name,
                age: passenger.age,
                gender: passenger.gender,
            })),
            paymentOrder: {
                paymentOrderId: paymentOrder.orderId,
                amount: paymentOrder.amount,
                currency: paymentOrder.currency,
                status: paymentOrder.status,
                keyId: paymentOrder.keyId
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
            await prisma.booking.update({
                where: {
                    id: booking.id as string
                },
                data: {
                    status: 'FAILED',
                    failureReason: error.response?.data?.message || error.message
                }
            })
            // Release Redis locks(segment-aware)
            await releaseSeatLocks(scheduleId, sortedSeatIds, lockValue!, fromSeq, toSeq)

        }

        throw error
    }
}

async function checkIdempotency(key: string) {

    const record = await prisma.idempotencyRecord.findUnique({
        where: {
            eventKey: key
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
            eventKey: key,
            response: JSON.stringify(value),
        }
    })
}


export default { createBooking }