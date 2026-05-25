import { prisma } from "../config/prisma.js"
import type { SendOTPParams } from "../types/send-otp.type.js";
import { sendOTPEmail, sendVerificationSuccessfullEmail } from "../utils/email.js";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../utils/error.js"
import bcrypt from "bcrypt";
import { generateAndStoreOTP, verifyOTP } from "../utils/otp.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/auth.js";
import jwt, { type JwtPayload } from "jsonwebtoken"
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";
import { OAuth2Client } from "google-auth-library";
import notificationProducer from "../kafka/producer/notifications.producer.js";
import { logger } from "../config/logger.js";

const client = new OAuth2Client(config.GOOGLE_CLIENT_ID)

const sendOTP = async ({ firstName, lastName, email, password }: SendOTPParams) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    })

    if (existingUser) {
        throw new ConflictError("User already exists")
    }
    const hashedPassword = await bcrypt.hash(password, 12)
    const meta = { firstName, lastName, email, hashedPassword };
    const { otp, otpSessionId } = await generateAndStoreOTP(meta);

    // await sendOTPEmail({ otp, email })
    notificationProducer.sendOTPEmail(email, otp, (config.OTP_TTL) / 60)
    logger.info(`OTP email queued for ${email}`)

    return { otpSessionId }

}

const verifyOTPAndCreateUser = async (otp: string, otpSessionId: string) => {
    const meta = await verifyOTP(otp, otpSessionId)
    if (meta === null) {
        throw new BadRequestError("Invalid or Expired OTP", "OTP_INVALID")
    }
    const user = await prisma.user.create({
        data: {
            email: meta.email,
            firstName: meta.firstName,
            lastName: meta.lastName,
            emailVerified: true,
            password: meta.hashedPassword,
        }
    })

    await sendVerificationSuccessfullEmail({ email: meta.email })
    return user;
}

const login = async (email: string, password: string, deviceId: string) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    })
    if (!existingUser) {
        throw new BadRequestError("Email not found")
    }
    const doesPasswordMatch = await bcrypt.compare(password, existingUser.password!)
    if (!doesPasswordMatch) {
        throw new BadRequestError("Incorrect credentials")
    }
    const accessToken = generateAccessToken(existingUser.id)
    const refreshToken = generateRefreshToken(existingUser.id)
    const { jti } = jwt.decode(refreshToken) as JwtPayload;
    await redis.set(`refresh:${existingUser.id}:${deviceId}`, jti || "", 'EX', config.REFRESH_TOKEN_EXP);
    const { password: _password, ...safeUser } = existingUser;
    await redis.set(`user:${existingUser.id}`, JSON.stringify(safeUser), 'EX', config.REDIS_DEFAULT_TTL)
    return { accessToken, refreshToken, loggedInUser: safeUser }
}

const rotateRefreshToken = async (refreshToken: string, deviceId: string) => {
    const payload = verifyRefreshToken(refreshToken) as JwtPayload
    const { id: userId, jti } = payload;
    const storedJti = await redis.get(`refresh:${userId}:${deviceId}`)
    if (!storedJti) {
        throw new ForbiddenError("Session Expired", "Login Again")
    }
    if (storedJti !== jti) {
        await redis.del(`refresh:${userId}:${deviceId}`)
        throw new ForbiddenError("Refresh token reused", "Login Again")
    }
    const newAccessToken = generateAccessToken(payload.id);
    const newRefreshToken = generateRefreshToken(payload.id);
    const { jti: newJti } = jwt.decode(newRefreshToken) as JwtPayload
    await redis.set(`refresh:${userId}:${deviceId}`, newJti || "", 'EX', config.REFRESH_TOKEN_EXP)
    return { newAccessToken, newRefreshToken }
}

const verifyGoogleIdToken = async (idToken: string, deviceId: string) => {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID
    })
    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email) {
        throw new UnauthorizedError("Invalid Google token payload")
    }
    const googleUser = {
        provider: payload.iss,
        providerId: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        emailVerified: payload.email_verified || false
    }

    const user = await prisma.$transaction(async (tx) => {
        let googleAuth = await tx.authProvider.findUnique({
            where: {
                provider_providerId: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId
                }
            },
            include: {
                user: true
            }
        })

        if (googleAuth) {
            return googleAuth.user
        }

        let existingUser = await tx.user.findUnique({
            where: {
                email: googleUser.email
            }
        })

        if (existingUser) {
            await tx.authProvider.create({
                data: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId,
                    userId: existingUser.id
                }
            })
            return existingUser;
        }

        return await tx.user.create({
            data: {
                email: googleUser.email,
                firstName: googleUser.firstName || "",
                lastName: googleUser.lastName || "",
                emailVerified: googleUser.emailVerified,
                AuthProviders: {
                    create: {
                        provider: googleUser.provider,
                        providerId: googleUser.providerId
                    }
                }
            }
        })
    });

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    const { jti } = jwt.decode(refreshToken) as JwtPayload;
    await redis.set(`refresh:${user.id}:${deviceId}`, jti || "", 'EX', config.REFRESH_TOKEN_EXP);
    const { password: _password, ...safeUser } = user;
    await redis.set(`user:${user.id}`, JSON.stringify(safeUser), 'EX', config.REDIS_DEFAULT_TTL)
    return { accessToken, refreshToken, loggedInUser: safeUser }

}

export default { sendOTP, verifyOTPAndCreateUser, login, rotateRefreshToken, verifyGoogleIdToken }