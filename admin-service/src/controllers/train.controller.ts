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

export const createRoute = asyncHandler(async (req, res) => {
    const { trainId, routeStations } = req.body;

    if (!trainId || !routeStations || routeStations.length == 0) {
        throw new BadRequestError("All details are required");
    }

    if (routeStations.length == 1) {
        throw new BadRequestError("At least two stations are required");
    }

    const train = await trainService.createRoute(trainId, routeStations);

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