import bookingService from "../services/booking.service";
import { asyncHandler } from "../utils/asyncHandler";

export const createBooking = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq, trainId } = req.body;

    if (!scheduleId || !passengers || !passengers.length || !userId || !fromStationId || !toStationId || !fromSeq || !toSeq || !idempotencyKey) {
        throw new Error("Missing required fields");
    }

    const booking = await bookingService.createBooking(
        userId,
        scheduleId,
        seatIds,
        passengers,
        idempotencyKey,
        fromStationId,
        toStationId,
        fromSeq,
        toSeq,
        trainId
    );

    return res.status(201).json({
        success: true,
        message: "Booking created successfully",
        data: booking
    })
})