import searchService from "../services/search.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";

export const searchTrains = asyncHandler(async (req, res) => {

    const { from, to, date } = req.query;
    if (!from || !to) {
        throw new BadRequestError("source and destination are required")
    }

    const results = await searchService.searchTrains(from as string, to as string, date as string || null);

    return res.status(200).json({
        data: results,
        success: true
    })

})

export const autoComplete = asyncHandler(async (req, res) => {
    const { q } = req.query as { q?: string };

    if (!q || q.trim().length <= 1) {
        throw new BadRequestError("Query should have atleast 2 characters");
    }

    const suggestions = await searchService.autocompleteStation(q)

    return res.status(200).json({
        data: suggestions,
        success: true
    })



})