import stationService from "../services/station.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";

export const createStation = asyncHandler(async (req, res) => {
    const { name, code, city, state } = req.body;

    if (!name || !code || !city || !state) {
        throw new BadRequestError("All details are required");
    }

    const station = await stationService.createStation({
        code,
        name,
        city,
        state
    });

    return res.status(201).json({
        success: true,
        message: "Station created successfully",
        data: station
    })

})