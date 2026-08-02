import searchService from "../services/search.service";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";

// Station autocomplete — the only use of Elasticsearch in this service
export const autoComplete = asyncHandler(async (req, res) => {
    const { q } = req.query as { q?: string };
    if (!q || q.length <= 1) {
        throw new BadRequestError("Query should have at least 2 characters");
    }

    const suggestions = await searchService.autocompleteStation(q)

    return res.status(200).json({
        data: suggestions,
        success: true
    })
})