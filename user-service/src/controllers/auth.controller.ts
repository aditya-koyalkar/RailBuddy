import { config } from "../config/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";
import authService from "../services/auth.service.js"

export const sendOTP = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, password, confirmPassword, email } = req.body;
    if (!firstName || !lastName || !password || !confirmPassword || !email) {
        throw new BadRequestError("All fields are mandatory")
    }
    if (password !== confirmPassword) {
        throw new BadRequestError("Password mismatch")
    }

    const { otpSessionId } = await authService.sendOTP({ firstName, lastName, email, password });

    res.cookie("otp_session", otpSessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.OTP_TTL * 1000
    }).status(200).json({
        success: true,
        message: "OTP sent"
    })
})