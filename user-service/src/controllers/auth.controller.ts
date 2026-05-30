import { config } from "../config/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError, UnauthorizedError } from "../utils/error.js";
import authService from "../services/auth.service.js"
import { getDeviceFingerPrint } from "../utils/deviceFingerprint.js";

export const sendOTP = asyncHandler(async (req, res, _next) => {
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

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new BadRequestError("Email and password are required")
    }

    const deviceId = getDeviceFingerPrint(req)
    const { accessToken, refreshToken, loggedInUser } = await authService.login(email, password, deviceId)
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.ACCESS_TOKEN_EXP,
    })
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.REFRESH_TOKEN_EXP
    }).status(200).json({
        success: true,
        message: "LoggedIn successgfully",
        loggedInUser
    })

})

export const rotateRefreshToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        throw new UnauthorizedError("Your session has expired please login again")
    }
    const deviceId = getDeviceFingerPrint(req)
    const { newAccessToken, newRefreshToken } = await authService.rotateRefreshToken(refreshToken, deviceId)
    res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.ACCESS_TOKEN_EXP
    })
    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.REFRESH_TOKEN_EXP
    }).status(200).json({
        success: true,
        message: "Access and refresh token reissued"
    })
})


export const verifyGoogleIdToken = asyncHandler(async (req, res) => {
    const { idTToken } = req.body;
    if (!idTToken) {
        throw new BadRequestError("Invalid Google Id Token", "INVALID TOKEN")
    }
    const deviceId = getDeviceFingerPrint(req)
    const { accessToken, refreshToken, loggedInUser } = await authService.verifyGoogleIdToken(idTToken, deviceId);

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.ACCESS_TOKEN_EXP
    })
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.REFRESH_TOKEN_EXP
    }).status(200).json({
        success: true,
        message: "LoggedIn successfully",
        loggedInUser
    })
})