import trainService from "../services/train.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";

export const createTrain = asyncHandler(async (req, res) => {
    const { trainNumber, name, coaches, fares } = req.body;

    if (!trainNumber || !name || !coaches || !Array.isArray(coaches) || coaches.length === 0) {
        throw new BadRequestError("Train number, name, and at least one coach are required");
    }

    for (const coach of coaches) {
        if (!coach.coachNumber || !coach.coachType || !coach.seats || !Array.isArray(coach.seats) || coach.seats.length === 0) {
            throw new BadRequestError("All coaches must have coachNumber, coachType, and at least one seat");
        }
    }

    const train = await trainService.createTrain({
        trainNumber,
        name,
        coaches,
        fares
    });

    return res.status(201).json({
        success: true,
        message: "Train created successfully",
        data: train
    });
});

export const createRoute = asyncHandler(async (req, res) => {
    const { trainId, stops } = req.body;

    if (!trainId || !stops || !Array.isArray(stops) || stops.length === 0) {
        throw new BadRequestError("Train ID and stops are required");
    }

    if (stops.length < 2) {
        throw new BadRequestError("At least two stops are required");
    }

    const train = await trainService.createRoute(trainId, stops);

    return res.status(201).json({
        success: true,
        message: "Route created successfully",
        data: train
    });
})

export const getTrainById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        throw new BadRequestError("Train id is required");
    }

    const train = await trainService.getTrainById(id as string);

    return res.status(200).json({
        success: true,
        message: "Train fetched successfully",
        data: train
    });
});

export const createSchedule = asyncHandler(async (req, res) => {
    const { trainId, departureDate, status } = req.body;

    if (!trainId || !departureDate) {
        throw new BadRequestError("Train id and departure date are required");
    }

    const schedule = await trainService.createSchedule({ trainId, departureDate, status });

    return res.status(201).json({
        success: true,
        message: "Schedule created successfully",
        data: schedule
    });
});