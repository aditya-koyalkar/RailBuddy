import { Request, Response } from "express";
import { BadRequestError } from "../utils/error.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import inventoryService from "../services/inventory.service.js";

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = req.params.scheduleId as string;
    const { fromSeq, toSeq } = req.query;

    const availability = await inventoryService.getAvailability(
        scheduleId,
        fromSeq !== undefined ? Number(fromSeq) : undefined,
        toSeq !== undefined ? Number(toSeq) : undefined
    );
    return res.status(200).json({
        success: true,
        data: availability
    })
});

export const lockSeats = asyncHandler(async (req: Request, res: Response) => {
    const { scheduleId, seatIds, userId, ttlSeconds, fromSeq, toSeq, bookingId } = req.body;

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId || !bookingId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for locking seats");
    }

    const result = await inventoryService.lockSeats(
        scheduleId,
        seatIds,
        userId,
        Number(ttlSeconds),
        Number(fromSeq),
        Number(toSeq),
        bookingId
    );

    return res.status(200).json({
        success: true,
        message: "Seats locked successfully",
        data: result
    });
});

export const unlockSeats = asyncHandler(async (req: Request, res: Response) => {
    const { scheduleId, seatIds, userId, fromSeq, toSeq, bookingId } = req.body;

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId || !bookingId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for unlocking seats");
    }

    const result = await inventoryService.unlockSeats(
        scheduleId,
        seatIds,
        userId,
        Number(fromSeq),
        Number(toSeq),
        bookingId
    );

    return res.status(200).json({
        success: true,
        message: "Seats unlocked successfully",
        data: result
    });
});

export const confirmSeats = asyncHandler(async (req: Request, res: Response) => {
    const { scheduleId, seatIds, bookingId, userId, fromSeq, toSeq } = req.body;
    const resolvedUserId = userId || req.user?.id;

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !bookingId || !resolvedUserId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for confirming seats");
    }

    const result = await inventoryService.confirmSeats(
        scheduleId,
        seatIds,
        resolvedUserId,
        Number(fromSeq),
        Number(toSeq),
        bookingId
    );

    return res.status(200).json({
        success: true,
        message: "Seats confirmed successfully",
        data: result
    });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
    const { scheduleId, seatIds, bookingId, userId, fromSeq, toSeq } = req.body;
    const resolvedUserId = userId || req.user?.id;

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !bookingId || !resolvedUserId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for cancelling booking");
    }

    const result = await inventoryService.cancelBooking(
        scheduleId,
        seatIds,
        resolvedUserId,
        Number(fromSeq),
        Number(toSeq),
        bookingId
    );

    return res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
        data: result
    });
});

// Keep holdSeats and releaseSeats as aliases for backward compatibility
export const holdSeats = lockSeats;
export const releaseSeats = unlockSeats;

export const getSeatsByIds = asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = req.params.scheduleId as string;
    const { seatIds, fromSeq, toSeq, coachType, coachNumber } = req.query;

    if (!scheduleId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("scheduleId, fromSeq, and toSeq are required");
    }

    const ids: string[] = seatIds
        ? (Array.isArray(seatIds) ? (seatIds as string[]) : (seatIds as string).split(',').filter(Boolean))
        : [];

    const seats = await inventoryService.getSeatsByIds(
        scheduleId,
        ids,
        Number(fromSeq),
        Number(toSeq),
        coachType as string,
        coachNumber as string
    );

    return res.status(200).json({
        success: true,
        data: seats
    });
});
