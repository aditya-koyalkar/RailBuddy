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

export const cancelBooking = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const bookingId = req.params.id as string;
    const { reason } = req.body;

    if (!bookingId || !userId) {
        throw new Error("bookingId and userId are required");
    }

    const booking = await bookingService.cancelBooking(bookingId, userId, reason);

    return res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
        data: booking
    });
});

export const getUserBookings = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new Error("UserId is required");
    }

    const bookings = await bookingService.getUserBookings(userId);

    return res.status(200).json({
        success: true,
        message: "User bookings fetched successfully",
        data: bookings
    });
});

export const getBookingById = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const bookingId = req.params.id as string;

    if (!bookingId || !userId) {
        throw new Error("bookingId and userId are required");
    }

    const booking = await bookingService.getBookingById(bookingId, userId);

    return res.status(200).json({
        success: true,
        message: "Booking details fetched successfully",
        data: booking
    });
});