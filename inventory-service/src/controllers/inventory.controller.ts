import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { BadRequestError, NotFoundError, ConflictError } from "../utils/error.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import inventoryProducer from "../kafka/producer/inventory.producer.js";
import inventoryService from "../services/inventory.service.js";

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = req.params.scheduleId as string;
    const availability = await inventoryService.getAvailability(scheduleId)
    return res.status(200).json({
        success: true,
        data: availability
    })
});

export const getSeats = asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = req.params.scheduleId as string;
    const { status, seatType, fromSeq, toSeq } = req.query;

    const whereClause: any = { scheduleId };
    if (status && status !== "AVAILABLE") {
        whereClause.status = status;
    }
    if (seatType) {
        whereClause.seatType = seatType;
    }

    const seats = await prisma.seatInventory.findMany({
        where: whereClause
    });

    let resultSeats = seats.map(seat => ({
        ...seat,
        segmentStatus: seat.status // default to global seat status
    }));

    if (fromSeq !== undefined && toSeq !== undefined) {
        const fromSeqNum = Number(fromSeq);
        const toSeqNum = Number(toSeq);

        const locks = await prisma.seatSegmentLock.findMany({
            where: {
                scheduleId,
                status: { in: ["LOCKED", "BOOKED"] }
            }
        });

        const now = new Date();
        const activeLocks = locks.filter(lock => !lock.lockExpiresAt || lock.lockExpiresAt > now);

        resultSeats = seats.map(seat => {
            const seatLocks = activeLocks.filter(lock => lock.seatId === seat.seatId);
            const isLocked = seatLocks.some(lock => lock.fromSeq < toSeqNum && lock.toSeq > fromSeqNum);
            return {
                ...seat,
                segmentStatus: isLocked ? "LOCKED" : "AVAILABLE"
            };
        });

        if (status === "AVAILABLE") {
            resultSeats = resultSeats.filter(seat => seat.segmentStatus === "AVAILABLE" && seat.status === "AVAILABLE");
        }
    }

    return res.status(200).json({
        success: true,
        data: {
            seats: resultSeats
        }
    });
});

export const holdSeats = asyncHandler(async (req: Request, res: Response) => {
    const { scheduleId, seatIds, userId, ttlSeconds, fromSeq, toSeq } = req.body;

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for holding seats");
    }

    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    await prisma.$transaction(async (tx) => {
        const schedule = await tx.scheduleInventory.findUnique({
            where: { scheduleId }
        });

        if (!schedule || schedule.status !== "ACTIVE") {
            throw new BadRequestError("Schedule is not active or does not exist");
        }

        const locks = await tx.seatSegmentLock.findMany({
            where: {
                scheduleId,
                seatId: { in: seatIds },
                status: { in: ["LOCKED", "BOOKED"] }
            }
        });

        const now = new Date();
        const activeLocks = locks.filter(lock => !lock.lockExpiresAt || lock.lockExpiresAt > now);

        for (const seatId of seatIds) {
            const seatLocks = activeLocks.filter(lock => lock.seatId === seatId);
            const hasOverlap = seatLocks.some(lock => lock.fromSeq < toSeqNum && lock.toSeq > fromSeqNum);
            if (hasOverlap) {
                throw new ConflictError(`Seat ${seatId} is already locked for overlapping segments`);
            }
        }

        const expiresAt = new Date(Date.now() + (Number(ttlSeconds) || 300) * 1000);
        const lockData = seatIds.map(seatId => ({
            scheduleId,
            seatId,
            fromSeq: fromSeqNum,
            toSeq: toSeqNum,
            status: "LOCKED" as const,
            lockedBy: userId,
            lockExpiresAt: expiresAt
        }));

        await tx.seatSegmentLock.createMany({
            data: lockData
        });

        await tx.scheduleInventory.update({
            where: { scheduleId },
            data: {
                locked: { increment: seatIds.length },
                version: { increment: 1 }
            }
        });
    });

    // Publish update to Kafka out of the transaction
    const updatedSchedule = await prisma.scheduleInventory.findUnique({
        where: { scheduleId }
    });
    if (updatedSchedule) {
        await inventoryProducer.publishSeatAvailabilityUpdated(
            scheduleId,
            updatedSchedule.trainId,
            updatedSchedule.totalSeats,
            updatedSchedule.locked,
            updatedSchedule.booked
        ).catch(err => logger.error(`Failed to publish seat availability: ${err.message}`));
    }

    return res.status(200).json({
        success: true,
        message: "Seats held successfully"
    });
});

export const releaseSeats = asyncHandler(async (req: Request, res: Response) => {
    const { scheduleId, seatIds, userId, fromSeq, toSeq } = req.body;

    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || !userId || fromSeq === undefined || toSeq === undefined) {
        throw new BadRequestError("Missing required fields for releasing seats");
    }

    const fromSeqNum = Number(fromSeq);
    const toSeqNum = Number(toSeq);

    await prisma.$transaction(async (tx) => {
        const schedule = await tx.scheduleInventory.findUnique({
            where: { scheduleId }
        });

        if (!schedule) {
            throw new NotFoundError("Schedule inventory not found");
        }

        const deleteResult = await tx.seatSegmentLock.deleteMany({
            where: {
                scheduleId,
                seatId: { in: seatIds },
                fromSeq: fromSeqNum,
                toSeq: toSeqNum,
                lockedBy: userId,
                status: "LOCKED"
            }
        });

        if (deleteResult.count > 0) {
            const newLocked = Math.max(0, schedule.locked - deleteResult.count);
            await tx.scheduleInventory.update({
                where: { scheduleId },
                data: {
                    locked: newLocked,
                    version: { increment: 1 }
                }
            });
        }
    });

    const updatedSchedule = await prisma.scheduleInventory.findUnique({
        where: { scheduleId }
    });
    if (updatedSchedule) {
        await inventoryProducer.publishSeatAvailabilityUpdated(
            scheduleId,
            updatedSchedule.trainId,
            updatedSchedule.totalSeats,
            updatedSchedule.locked,
            updatedSchedule.booked
        ).catch(err => logger.error(`Failed to publish seat availability: ${err.message}`));
    }

    return res.status(200).json({
        success: true,
        message: "Seats released successfully"
    });
});
