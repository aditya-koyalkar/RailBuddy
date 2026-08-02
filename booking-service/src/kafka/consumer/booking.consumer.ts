import { connectProducer, consumer } from "../../config/kafka";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { TOPICS } from "../../utils/constants";
import inventoryClient from "../../services/inventoryClient";
import sagaService from "../../services/saga.service";

class BookingConsumer {
    async start() {
        await consumer.connect();
        await connectProducer();

        logger.info("Booking consumer connected");

        await consumer.subscribe({
            topics: [
                TOPICS.SCHEDULE_CREATED,
                TOPICS.SCHEDULE_CANCELLED,
                TOPICS.PAYMENT_CONFIRMED,
                TOPICS.PAYMENT_FAILED
            ],
            fromBeginning: true
        });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                logger.info("Received message in booking consumer:", {
                    topic,
                    partition,
                    offset: message.offset,
                    value: message.value?.toString()
                });

                if (!message.value) return;

                try {
                    const payload = JSON.parse(message.value.toString());

                    switch (topic) {
                        case TOPICS.PAYMENT_CONFIRMED:
                            await this.handlePaymentConfirmed(payload);
                            break;
                        case TOPICS.PAYMENT_FAILED:
                            await this.handlePaymentFailed(payload);
                            break;
                    }
                } catch (error: any) {
                    logger.error(`Error processing Kafka message on topic ${topic}`, { error: error.message });
                }
            }
        });
    }

    private async handlePaymentConfirmed(payload: any) {
        const { bookingId, orderId } = payload;

        logger.info(`Processing PAYMENT_CONFIRMED event for booking ${bookingId}`);

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { seatAssignments: true }
        });

        if (!booking) {
            logger.warn(`Booking ${bookingId} not found when processing PAYMENT_CONFIRMED`);
            return;
        }

        if (booking.status === "CONFIRMED") {
            logger.info(`Booking ${bookingId} is already CONFIRMED`);
            return;
        }

        const seatIds = booking.seatAssignments.map((s) => s.seatId);

        // Record CONFIRM_SEATS saga step
        const confirmSagaLog = await prisma.sagaLog.create({
            data: {
                bookingId,
                step: "CONFIRM_SEATS",
                status: "PENDING",
                request: {
                    scheduleId: booking.scheduleId,
                    seatIds,
                    userId: booking.userId,
                    fromSeq: booking.fromSequence,
                    toSeq: booking.toSequence,
                    bookingId: booking.id
                }
            }
        });

        try {
            const confirmResult = await inventoryClient.confirmSeats(
                booking.scheduleId,
                seatIds,
                booking.userId,
                booking.fromSequence,
                booking.toSequence,
                booking.id
            );

            await prisma.sagaLog.update({
                where: { id: confirmSagaLog.id },
                data: {
                    status: "COMPLETED",
                    response: confirmResult as any
                }
            });

            logger.info(`Inventory seats confirmed for booking ${bookingId}`);
        } catch (error: any) {
            await prisma.sagaLog.update({
                where: { id: confirmSagaLog.id },
                data: {
                    status: "FAILED",
                    error: error.message
                }
            });
            logger.error(`Failed to confirm seats in inventory service for booking ${bookingId}`, { error: error.message });
            throw error;
        }

        // Update booking status to CONFIRMED, update payment, and write outbox event
        await prisma.$transaction(async (tx) => {
            const confirmedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: "CONFIRMED",
                    confirmedAt: new Date()
                }
            });

            await tx.payment.updateMany({
                where: { bookingId },
                data: {
                    status: "SUCCESS",
                    transactionId: orderId,
                    paidAt: new Date()
                }
            });

            await tx.bookingOutbox.create({
                data: {
                    aggregateId: bookingId,
                    eventType: "BOOKING_CONFIRMED",
                    payload: {
                        bookingId,
                        pnr: confirmedBooking.pnr,
                        userId: confirmedBooking.userId,
                        confirmedAt: confirmedBooking.confirmedAt
                    } as any
                }
            });
        });

        // Record COMPLETE saga step
        await prisma.sagaLog.create({
            data: {
                bookingId,
                step: "COMPLETE",
                status: "COMPLETED",
                response: {
                    confirmedAt: new Date(),
                    orderId
                }
            }
        });

        logger.info(`Booking ${bookingId} successfully confirmed following payment confirmation`);
    }

    private async handlePaymentFailed(payload: any) {
        const { bookingId, reason } = payload;

        logger.info(`Processing PAYMENT_FAILED event for booking ${bookingId}`);

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { seatAssignments: true }
        });

        if (!booking) {
            logger.warn(`Booking ${bookingId} not found when processing PAYMENT_FAILED`);
            return;
        }

        if (booking.status === "FAILED" || booking.status === "CANCELLED") {
            logger.info(`Booking ${bookingId} is already marked as ${booking.status}`);
            return;
        }

        const seatIds = booking.seatAssignments.map((s) => s.seatId);

        // Run Saga compensations (release inventory seat holds, update saga logs)
        try {
            await sagaService.compensateAll(booking, seatIds);
            logger.info(`Saga compensations executed for failed payment on booking ${bookingId}`);
        } catch (error: any) {
            logger.error(`Failed to compensate saga steps for booking ${bookingId}`, { error: error.message });
        }

        // Update booking status to FAILED, update payment status, and write outbox event
        await prisma.$transaction(async (tx) => {
            const failedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: "FAILED",
                    failureReason: reason || "Payment failed or expired on checkout"
                }
            });

            await tx.payment.updateMany({
                where: { bookingId },
                data: {
                    status: "FAILED"
                }
            });

            await tx.bookingOutbox.create({
                data: {
                    aggregateId: bookingId,
                    eventType: "BOOKING_FAILED",
                    payload: {
                        bookingId,
                        pnr: failedBooking.pnr,
                        userId: failedBooking.userId,
                        reason: failedBooking.failureReason
                    } as any
                }
            });
        });

        logger.info(`Booking ${bookingId} marked as FAILED following payment failure notification`);
    }
}

export default new BookingConsumer();