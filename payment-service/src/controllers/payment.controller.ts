import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";
import paymentService from "../services/payment.service";
import polarService from "../services/polar.service";
import { logger } from "../config/logger";
import { prisma } from "../config/prisma";
import { PaymentAuditAction } from "@prisma/client";

export const createPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId, amount, userId, idempotencyKey } = req.body;

    if (!bookingId || amount === undefined || !userId || !idempotencyKey) {
        throw new BadRequestError("bookingId, amount, userId, and idempotencyKey are required");
    }

    const result = await paymentService.createPaymentOrder(
        bookingId,
        Number(amount),
        userId,
        idempotencyKey
    );

    return res.status(201).json({
        success: true,
        message: "Payment order created successfully",
        data: result
    });
});

export const handlePolarWebhook = async (req: Request, res: Response) => {
    try {
        const rawBody = req.body;
        const headers = req.headers;

        const event = polarService.validateWebhook(rawBody, headers as any);

        logger.info(`Polar webhook received: ${event.type}`, { eventType: event.type });

        // Extract metadata & bookingId if present for audit logging
        const eventData = event.data as any;
        const checkoutId = eventData.checkout_id || eventData.checkoutId || eventData.id;
        const metadata = eventData.custom_field_data || eventData.metadata || {};
        const bookingId = metadata.bookingId || metadata.booking_id;

        if (bookingId) {
            const order = await prisma.paymentOrder.findUnique({ where: { bookingId } });
            if (order) {
                await paymentService.createAuditLog(
                    order.id,
                    bookingId,
                    PaymentAuditAction.WEBHOOK_RECEIVED,
                    order.status,
                    order.status,
                    { eventType: event.type, eventId: eventData.id }
                );
            }
        }

        // Handle relevant webhook events
        if (event.type === "order.paid") {
            const polarOrderId = eventData.id;
            await paymentService.handleOrderPaid(polarOrderId, checkoutId, bookingId);
        } else if (event.type === "checkout.updated") {
            if (eventData.status === "succeeded" || eventData.status === "confirmed") {
                await paymentService.handleOrderPaid(eventData.id, checkoutId, bookingId);
            } else if (eventData.status === "failed" || eventData.status === "expired") {
                await paymentService.handleOrderFailed(undefined, checkoutId, bookingId, `Checkout ${eventData.status}`);
            }
        } else if (event.type === "refund.created" || event.type === "refund.updated") {
            const refundStatus = eventData.status;
            if (bookingId && (refundStatus === "succeeded" || !refundStatus)) {
                await paymentService.refundPaymentOrder(bookingId, eventData.amount ? eventData.amount / 100 : undefined, eventData.reason);
            } else if (bookingId && refundStatus === "failed") {
                const order = await prisma.paymentOrder.findUnique({ where: { bookingId } });
                if (order) {
                    await paymentService.createAuditLog(
                        order.id,
                        bookingId,
                        PaymentAuditAction.REFUND_FAILED,
                        order.status,
                        order.status,
                        { reason: eventData.failure_reason || "Refund failed on Polar gateway" }
                    );
                }
            }
        }

        return res.status(202).json({ received: true });
    } catch (error: any) {
        logger.error(`Webhook processing error`, { error: error.message || error });
        return res.status(400).json({ success: false, message: error.message || "Webhook verification failed" });
    }
};

export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;

    if (!bookingId) {
        throw new BadRequestError("bookingId parameter is required");
    }

    const result = await paymentService.getPaymentOrderByBookingId(bookingId);

    return res.status(200).json({
        success: true,
        data: result
    });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
    const { checkoutId, bookingId } = req.body;

    if (!checkoutId) {
        throw new BadRequestError("checkoutId is required");
    }

    const result = await paymentService.verifyPaymentOrder(checkoutId, bookingId);

    return res.status(200).json({
        success: true,
        message: "Payment verification completed",
        data: result
    });
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId, amount, reason } = req.body;

    if (!bookingId) {
        throw new BadRequestError("bookingId is required");
    }

    const result = await paymentService.refundPaymentOrder(
        bookingId,
        amount ? Number(amount) : undefined,
        reason
    );

    return res.status(200).json({
        success: true,
        message: "Refund processed successfully",
        data: result
    });
});
