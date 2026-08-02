import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { BadRequestError, NotFoundError } from "../utils/error";
import polarService from "./polar.service";
import outboxService from "./outbox.service";
import { PaymentAuditAction, PaymentOrderStatus } from "@prisma/client";

export const createAuditLog = async (
    paymentOrderId: string,
    bookingId: string,
    action: PaymentAuditAction,
    previousStatus?: PaymentOrderStatus,
    newStatus?: PaymentOrderStatus,
    metadata?: any
) => {
    try {
        const auditData: any = {
            paymentOrderId,
            bookingId,
            action
        };

        if (previousStatus !== undefined) auditData.previousStatus = previousStatus;
        if (newStatus !== undefined) auditData.newStatus = newStatus;
        if (metadata !== undefined) auditData.metadata = metadata;

        await prisma.paymentAuditLog.create({
            data: auditData
        });
    } catch (error: any) {
        logger.error(`Failed to create payment audit log for order ${paymentOrderId}`, { error: error.message });
    }
};

export const createPaymentOrder = async (
    bookingId: string,
    amount: number,
    userId: string,
    idempotencyKey: string
) => {
    if (!bookingId || !amount || !userId || !idempotencyKey) {
        throw new BadRequestError("Missing required fields for creating payment order");
    }

    // Check idempotency record first
    const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { eventKey: idempotencyKey }
    });

    if (existingRecord && existingRecord.response) {
        logger.info(`Returning cached payment order response for idempotencyKey: ${idempotencyKey}`);
        return existingRecord.response;
    }

    // Check if payment order already exists for this bookingId
    let order = await prisma.paymentOrder.findUnique({
        where: { bookingId }
    });

    if (!order) {
        // Create Polar checkout session
        const checkoutSession = await polarService.createCheckoutSession(bookingId, amount);

        order = await prisma.paymentOrder.create({
            data: {
                bookingId,
                userId,
                amount,
                currency: "usd",
                status: "PENDING",
                polarCheckoutId: checkoutSession.checkoutId,
                checkoutUrl: checkoutSession.checkoutUrl,
                idempotencyKey
            }
        });

        // Create audit log for checkout creation
        await createAuditLog(
            order.id,
            bookingId,
            PaymentAuditAction.CHECKOUT_CREATED,
            undefined,
            PaymentOrderStatus.PENDING,
            {
                checkoutId: checkoutSession.checkoutId,
                checkoutUrl: checkoutSession.checkoutUrl,
                amount,
                userId
            }
        );
    }

    const response = {
        orderId: order.id,
        bookingId: order.bookingId,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        checkoutUrl: order.checkoutUrl,
        polarCheckoutId: order.polarCheckoutId
    };

    // Store idempotency record
    await prisma.idempotencyRecord.create({
        data: {
            eventKey: idempotencyKey,
            response: response as any
        }
    });

    return response;
};

const retryTransaction = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await fn();
        } catch (error: any) {
            attempts++;
            if (attempts >= maxRetries) throw error;
            await new Promise((res) => setTimeout(res, 50 * attempts));
        }
    }
    throw new Error("Transaction retries exhausted");
};

export const handleOrderPaid = async (polarOrderId: string, checkoutId?: string, bookingIdMetadata?: string) => {
    logger.info(`Handling order.paid webhook`, { polarOrderId, checkoutId, bookingIdMetadata });

    let order = null;

    if (checkoutId) {
        order = await prisma.paymentOrder.findUnique({
            where: { polarCheckoutId: checkoutId }
        });
    }

    if (!order && bookingIdMetadata) {
        order = await prisma.paymentOrder.findUnique({
            where: { bookingId: bookingIdMetadata }
        });
    }

    if (!order) {
        logger.warn(`No matching payment order found for webhook`, { polarOrderId, checkoutId, bookingIdMetadata });
        return { success: false, message: "Payment order not found" };
    }

    if (order.status === "PAID") {
        logger.info(`Payment order ${order.id} is already marked as PAID`);
        return { success: true, message: "Order already paid" };
    }

    const previousStatus = order.status;

    // Atomic database transaction with in-memory retries: Update status + Audit Log + Outbox record
    await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
            const updateResult = await tx.paymentOrder.updateMany({
                where: {
                    id: order.id,
                    version: order.version
                },
                data: {
                    status: "PAID",
                    polarOrderId,
                    paidAt: new Date(),
                    version: { increment: 1 }
                }
            });

            if (updateResult.count === 0) {
                logger.info(`Payment order ${order.id} update skipped due to concurrent modification (version mismatch)`);
                return;
            }

            const updatedOrder = await tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });

            await tx.paymentAuditLog.create({
                data: {
                    paymentOrderId: updatedOrder.id,
                    bookingId: updatedOrder.bookingId,
                    action: PaymentAuditAction.PAYMENT_PAID,
                    previousStatus,
                    newStatus: PaymentOrderStatus.PAID,
                    metadata: {
                        polarOrderId,
                        checkoutId,
                        paidAt: updatedOrder.paidAt,
                        version: updatedOrder.version
                    }
                }
            });

            await tx.paymentOutbox.create({
                data: {
                    aggregateId: updatedOrder.bookingId,
                    eventType: "PAYMENT_CONFIRMED",
                    payload: {
                        bookingId: updatedOrder.bookingId,
                        orderId: updatedOrder.id,
                        amount: Number(updatedOrder.amount),
                        userId: updatedOrder.userId,
                        status: "PAID",
                        timestamp: Date.now()
                    }
                }
            });
        });
    });

    logger.info(`Payment order ${order.id} atomically updated to PAID with Outbox record. Triggering outbox dispatch...`);

    // Dispatch outbox events to Kafka
    await outboxService.processPaymentOutbox();

    return { success: true, message: "Payment order confirmed successfully" };
};

export const handleOrderFailed = async (polarOrderId?: string, checkoutId?: string, bookingIdMetadata?: string, reason?: string) => {
    logger.info(`Handling order failure/expiration webhook`, { polarOrderId, checkoutId, bookingIdMetadata, reason });

    let order = null;

    if (checkoutId) {
        order = await prisma.paymentOrder.findUnique({
            where: { polarCheckoutId: checkoutId }
        });
    }

    if (!order && bookingIdMetadata) {
        order = await prisma.paymentOrder.findUnique({
            where: { bookingId: bookingIdMetadata }
        });
    }

    if (!order) {
        logger.warn(`No matching payment order found for failure webhook`, { polarOrderId, checkoutId, bookingIdMetadata });
        return { success: false, message: "Payment order not found" };
    }

    if (order.status === "FAILED" || order.status === "EXPIRED" || order.status === "CANCELLED") {
        logger.info(`Payment order ${order.id} is already marked as ${order.status}`);
        return { success: true, message: "Order already failed" };
    }

    const previousStatus = order.status;
    const failureReason = reason || "Payment failed or expired on checkout gateway";
    const newStatus = reason?.toLowerCase().includes("expired") ? PaymentOrderStatus.EXPIRED : PaymentOrderStatus.FAILED;
    const auditAction = newStatus === PaymentOrderStatus.EXPIRED ? PaymentAuditAction.PAYMENT_EXPIRED : PaymentAuditAction.PAYMENT_FAILED;

    // Atomic database transaction with in-memory retries: Update status + Audit Log + Outbox record
    await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
            const updateResult = await tx.paymentOrder.updateMany({
                where: {
                    id: order.id,
                    version: order.version
                },
                data: {
                    status: newStatus,
                    failureReason,
                    version: { increment: 1 }
                }
            });

            if (updateResult.count === 0) {
                logger.info(`Payment order ${order.id} failure update skipped due to concurrent modification (version mismatch)`);
                return;
            }

            const updatedOrder = await tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });

            await tx.paymentAuditLog.create({
                data: {
                    paymentOrderId: updatedOrder.id,
                    bookingId: updatedOrder.bookingId,
                    action: auditAction,
                    previousStatus,
                    newStatus,
                    metadata: {
                        polarOrderId,
                        checkoutId,
                        reason: failureReason
                    }
                }
            });

            await tx.paymentOutbox.create({
                data: {
                    aggregateId: updatedOrder.bookingId,
                    eventType: "PAYMENT_FAILED",
                    payload: {
                        bookingId: updatedOrder.bookingId,
                        orderId: updatedOrder.id,
                        reason: failureReason,
                        status: "FAILED",
                        timestamp: Date.now()
                    }
                }
            });
        });
    });

    logger.info(`Payment order ${order.id} atomically updated to ${newStatus} with Outbox record. Triggering outbox dispatch...`);

    // Dispatch outbox events to Kafka
    await outboxService.processPaymentOutbox();

    return { success: true, message: "Payment failure processed successfully" };
};

export const verifyPaymentOrder = async (checkoutId: string, bookingId?: string) => {
    if (!checkoutId) {
        throw new BadRequestError("checkoutId is required for verification");
    }

    const checkout = await polarService.verifyCheckout(checkoutId);
    const resolvedBookingId = bookingId || (checkout.metadata as any)?.bookingId;

    let order = null;
    if (resolvedBookingId) {
        order = await prisma.paymentOrder.findUnique({ where: { bookingId: resolvedBookingId } });
    }

    if (order) {
        await createAuditLog(
            order.id,
            resolvedBookingId,
            PaymentAuditAction.PAYMENT_VERIFIED,
            order.status,
            order.status,
            {
                checkoutId,
                polarCheckoutStatus: checkout.status
            }
        );
    }

    if (checkout.status === "succeeded" || checkout.status === "confirmed") {
        await handleOrderPaid(checkout.id, checkoutId, resolvedBookingId);
        return { success: true, status: "PAID", bookingId: resolvedBookingId, checkoutId };
    } else if (checkout.status === "failed" || checkout.status === "expired") {
        await handleOrderFailed(undefined, checkoutId, resolvedBookingId, `Checkout ${checkout.status}`);
        return { success: false, status: "FAILED", bookingId: resolvedBookingId, checkoutId };
    }

    return { success: true, status: checkout.status, bookingId: resolvedBookingId, checkoutId };
};

export const refundPaymentOrder = async (bookingId: string, amount?: number, reason?: string) => {
    if (!bookingId) {
        throw new BadRequestError("bookingId is required for refund");
    }

    const order = await prisma.paymentOrder.findUnique({
        where: { bookingId }
    });

    if (!order) {
        throw new NotFoundError("Payment order not found for this booking");
    }

    if (order.status === "REFUNDED") {
        logger.info(`Payment order ${order.id} is already REFUNDED`);
        return {
            success: true,
            status: "REFUNDED",
            bookingId: order.bookingId,
            refundId: order.refundId,
            refundAmount: Number(order.refundAmount || order.amount)
        };
    }

    if (order.status !== "PAID") {
        throw new BadRequestError(`Cannot refund order in ${order.status} status. Only PAID orders can be refunded.`);
    }

    const previousStatus = order.status;
    const refundAmount = amount ? amount : Number(order.amount);

    // Call Polar API to process refund if polarOrderId exists
    let refundResult: any = null;
    if (order.polarOrderId) {
        try {
            refundResult = await polarService.createRefund(order.polarOrderId, refundAmount, reason);
        } catch (error: any) {
            await createAuditLog(
                order.id,
                order.bookingId,
                PaymentAuditAction.REFUND_FAILED,
                order.status,
                order.status,
                { reason: error.message || "Polar refund creation failed", refundAmount }
            );
            throw error;
        }
    }

    const refundId = refundResult?.id || `ref_${Date.now()}`;

    // Atomic transaction with in-memory retries: Update status to REFUNDED + Audit Log + Outbox Event
    await retryTransaction(async () => {
        return await prisma.$transaction(async (tx) => {
            const updateResult = await tx.paymentOrder.updateMany({
                where: {
                    id: order.id,
                    version: order.version
                },
                data: {
                    status: "REFUNDED",
                    refundId,
                    refundedAt: new Date(),
                    refundAmount,
                    version: { increment: 1 }
                }
            });

            if (updateResult.count === 0) {
                logger.info(`Payment order ${order.id} refund update skipped due to concurrent modification (version mismatch)`);
                return;
            }

            const updatedOrder = await tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });

            await tx.paymentAuditLog.create({
                data: {
                    paymentOrderId: updatedOrder.id,
                    bookingId: updatedOrder.bookingId,
                    action: PaymentAuditAction.REFUND_COMPLETED,
                    previousStatus,
                    newStatus: PaymentOrderStatus.REFUNDED,
                    metadata: {
                        refundId,
                        refundAmount,
                        reason: reason || "Booking cancellation refund"
                    }
                }
            });

            await tx.paymentOutbox.create({
                data: {
                    aggregateId: updatedOrder.bookingId,
                    eventType: "PAYMENT_REFUNDED",
                    payload: {
                        bookingId: updatedOrder.bookingId,
                        orderId: updatedOrder.id,
                        refundId,
                        amount: refundAmount,
                        status: "REFUNDED",
                        timestamp: Date.now()
                    }
                }
            });
        });
    });

    logger.info(`Payment order ${order.id} refunded successfully. Triggering outbox dispatch...`);

    await outboxService.processPaymentOutbox();

    return {
        success: true,
        status: "REFUNDED",
        bookingId: order.bookingId,
        refundId,
        refundAmount
    };
};

export const getPaymentOrderByBookingId = async (bookingId: string) => {
    if (!bookingId) {
        throw new BadRequestError("bookingId is required");
    }

    const order = await prisma.paymentOrder.findUnique({
        where: { bookingId },
        include: {
            auditLogs: {
                orderBy: { createdAt: "desc" }
            }
        }
    });

    if (!order) {
        throw new NotFoundError("Payment order not found for this booking");
    }

    return {
        orderId: order.id,
        bookingId: order.bookingId,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        checkoutUrl: order.checkoutUrl,
        paidAt: order.paidAt,
        refundId: order.refundId,
        refundedAt: order.refundedAt,
        refundAmount: order.refundAmount ? Number(order.refundAmount) : undefined,
        auditLogs: order.auditLogs
    };
};

export default { createPaymentOrder, handleOrderPaid, handleOrderFailed, verifyPaymentOrder, refundPaymentOrder, getPaymentOrderByBookingId, createAuditLog };
