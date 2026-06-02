import trainService from "../services/train.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";

export const createTrain = asyncHandler(async (req, res) => {
    const { trainNumber, trainName, coachName, totalSeats, seats } = req.body;

    if (!trainNumber || !trainName || !coachName || !totalSeats) {
        throw new BadRequestError("All details are required");
    }

    if (!seats || !Array.isArray(seats) || seats.length === 0) {
        throw new BadRequestError("At least one seat needs to be present");
    }

    const train = await trainService.createTrain({
        trainNumber,
        trainName,
        coachName,
        totalSeats,
        seats
    });

    return res.status(201).json({
        success: true,
        message: "Train created successfully",
        data: train
    });
});