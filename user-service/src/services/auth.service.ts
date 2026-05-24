import { prisma } from "../config/prisma.js"
import type { SendOTPParams } from "../types/send-otp.type.js";
import { sendOTPEmail, sendVerificationSuccessfullEmail } from "../utils/email.js";
import { BadRequestError, ConflictError } from "../utils/error.js"
import bcrypt from "bcrypt";
import { generateAndStoreOTP, verifyOTP } from "../utils/otp.js";
import { generateAccessToken, generateRefreshToken } from "../utils/auth.js";
import jwt, { type JwtPayload } from "jsonwebtoken"
import { redis } from "../config/redis.js";
import { config } from "../config/index.js";
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

    await sendOTPEmail({ otp, email })

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

export default { sendOTP, verifyOTPAndCreateUser, login }