import searchService from "../services/search.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";

export const searchTrains = asyncHandler(async (req, res) => {

    const { from, to, date } = req.query;
    if (!from || !to) {
        throw new BadRequestError("source and destination are required")
    }

    const results = searchService.searchTrains(from as string, to as string, date as string || null);

    return res.status(200).json({
        data: results,
        success: true
    })

})