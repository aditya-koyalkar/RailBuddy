import userService from "../services/user.service.js"
import asyncHandler from "../utils/asyncHandler.js"
import { BadRequestError } from "../utils/error.js"

export const getProfile = asyncHandler(async (req, res) => {
    const userId = req.user?.id
    if (!userId) {
        throw new BadRequestError("UserId is missing")
    }
    const user = await userService.getProfile(userId)

    return res.status(200).json({
        success: true,
        message: "Fetched user details",
        data: user
    })

})