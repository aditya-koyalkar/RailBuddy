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

export const verifyOTP = asyncHandler(async (req, res) => {
    const { otp } = req.body
    const otpSessionId = req.cookies.otp_session;

    if (!otp || !otpSessionId) {
        throw new BadRequestError("OTP or OTP session is missing")
    }

    const user = await authService.verifyOTPAndCreateUser(otp, otpSessionId)

    return res.status(201).json({
        success: true,
        message: "User account created successfully",
        data: user.email
    })
}) 