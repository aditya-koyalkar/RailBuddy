import jwt from "jsonwebtoken"
import { config } from "../config/index.js"

export const generateAccessToken = (userId: string) => {
    const payload = {
        id: userId
    }
    return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
        expiresIn: config.ACCESS_TOKEN_EXP
    })
}

export const generateRefreshToken = (userId: string) => {
    const payload = {
        id: userId,
        jti: crypto.randomUUID()
    }
    return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
        expiresIn: config.REFRESH_TOKEN_EXP,
    })
}


export const verifyAccessTOken = (accessToken: string) => {
    return jwt.verify(accessToken, config.JWT_ACCESS_SECRET);
}

export const verifyRefreshToken = (refreshTOken: string) => {
    return jwt.verify(refreshTOken, config.JWT_REFRESH_SECRET)
}