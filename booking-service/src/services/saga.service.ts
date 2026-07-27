import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import inventoryClient from "./inventoryClient"
import paymentClient from "./paymentClient"

async function executeHoldSeats(booking: any, seatIds: any[], ttlSeconds: number, fromSeq: number, toSeq: number) {
    const sagaLog = await prisma.sagaLog.create({
        data: {
            bookingId: booking.id,
            step: "LOCK_SEATS",
            status: "PENDING",
            request: {
                scheduleId: booking.scheduleId,
                seatIds,
                ttlSeconds,
                fromSeq,
                toSeq,
                userId: booking.userId
            }
        }
    });

    try {
        const result = await inventoryClient.holdSeats(booking.scheduleId, seatIds, booking.userId, ttlSeconds, fromSeq, toSeq)

        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: {
                status: "COMPLETED",
                response: result
            }
        })
        await prisma.booking.update({
            where: { id: booking.id },
            data: {
                status: "SEATS_LOCKED"
            }
        })
        logger.info(`Seats held/locked for booking ${booking.id}`, {
            scheduleId: booking.scheduleId,
            seatIds,
            userId: booking.userId,
            ttlSeconds,
            fromSeq,
            toSeq
        })
        return result

    }
    catch (error) {
        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: {
                status: "FAILED",
                response: JSON.stringify(error)
            }
        })
        logger.error(`Failed to lock seats for booking ${booking.id}`, error);
        throw error
    }
}

async function executeCreatePaymentOrder(booking: any) {
    const indempotencyKey = `${booking.id}-payment`;

    const sagaLog = await prisma.sagaLog.create({
        data: {
            bookingId: booking.id,
            step: "CREATE_PAYMENT",
            status: "PENDING",
            request: {
                bookingId: booking.id,
                amount: Number(booking.totalFare),
                userId: booking.userId,
            }
        }
    })
    try {
        const result = await paymentClient.createPaymentOrder(
            booking.id,
            Number(booking.totalFare),
            booking.userId,
            indempotencyKey
        )

        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: {
                status: "COMPLETED",
                response: result
            }
        })

        // Create Payment record in separate table
        await prisma.payment.create({
            data: {
                bookingId: booking.id,
                provider: "razorpay",
                orderId: result.orderId,
                amount: booking.totalFare,
                currency: result.currency || "INR",
                status: "PENDING"
            }
        })

        await prisma.booking.update({
            where: { id: booking.id },
            data: {
                status: "PAYMENT_PENDING"
            }
        })

        logger.info(`Payment order created for booking ${booking.id}`, {
            bookingId: booking.id,
            amount: booking.totalFare,
            userId: booking.userId,
            paymentOrderId: result.orderId
        })
        return result;

    }
    catch (error) {
        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: {
                status: "FAILED",
                response: JSON.stringify(error)
            }
        });
        logger.error(`Failed to create payment order for booking ${booking.id}`, error);
        throw error;
    }
}

async function compensateAll(booking: any, seatIds: string[]) {
    const sagaLogs = await prisma.sagaLog.findMany({
        where: {
            bookingId: booking.id,
        }
    });

    for (const step of sagaLogs) {
        switch (step.step) {
            case 'CONFIRM_SEATS':
                await compensateConfirmSeats(booking)
                break;
            case 'CREATE_PAYMENT':
                await compensateCreatePayment(booking)
                break;
            case 'LOCK_SEATS':
                await compensateHoldSeats(booking, seatIds)
                break;
        }
    }
}

async function compensateConfirmSeats(booking: any) {
    logger.info(`Compensating confirm seats for booking ${booking.id}`)
    try {
        // TODO
    }
    catch (error: any) {
        logger.error(`Failed to compensate confirm seats for booking ${booking.id}`, {
            error: error.message
        })
    }
}

async function compensateCreatePayment(booking: any) {
    logger.info(`Compensating create payment for booking ${booking.id}`)
    try {
        // Update payment status to FAILED or REFUNDED
        await prisma.payment.updateMany({
            where: { bookingId: booking.id },
            data: { status: "FAILED" }
        })
    }
    catch (error: any) {
        logger.error(`Failed to compensate create payment for booking ${booking.id}`, {
            error: error.message
        })
    }
}

async function compensateHoldSeats(booking: any, seatIds: string[]) {
    logger.info(`Compensating hold/lock seats for booking ${booking.id}`)
    try {
        await inventoryClient.releaseSeats(booking.scheduleId, seatIds, booking.userId, booking.fromSequence, booking.toSequence);

        // Mark saga step as compensated
        await prisma.sagaLog.updateMany({
            where: {
                bookingId: booking.id,
                step: "LOCK_SEATS",
                status: "COMPLETED"
            },
            data: {
                status: "COMPENSATED"
            }
        })
    }
    catch (error: any) {
        logger.error(`Failed to compensate lock seats for booking ${booking.id}`, {
            error: error.message
        })
    }
}

export default { executeHoldSeats, executeCreatePaymentOrder, compensateAll }