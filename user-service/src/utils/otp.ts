import { config } from "../config/index.js";
import { TooManyRequestsError } from "./error.js";
import otpGenerator from "otp-generator"
import crypto from "crypto"
import { redis } from "../config/redis.js";
import type { StoreOTPParams } from "../types/store-otp.type.js";


export const generateAndStoreOTP = async (meta: StoreOTPParams) => {
    const { email } = meta
    const rateKey = `otp:rate:${email}`
    const sentCount = parseInt(await redis.get(rateKey) || '0', 10);
    if (sentCount >= config.OTP_RATE_MAX_PER_HOUR) {
        throw new TooManyRequestsError("Too Many OTP requests. Try again later.", "OTP_RATE_LIMIT")
    }

    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
    })

    const otpSessionId = crypto.randomUUID();
    const hashedOTP = hmacFor(email, otp);

    await redis.set(`otp:session:${otpSessionId}`, JSON.stringify({
        hashedOTP: hashedOTP,
        meta
    }), 'EX', config.OTP_TTL)

    await redis.incr(rateKey)
    await redis.expire(rateKey, 3600);

    return {
        otp,
        otpSessionId
    }
}

const hmacFor = (email: string, otp: string) => {
    const hash = crypto
        .createHmac("sha256", config.HMAC_SECRET)
        .update(email + otp)
        .digest("hex");
    return hash
}

export const verifyOTP = async (otp: string, otpSessionId: string) => {
    const rawData = await redis.get(`otp:session:${otpSessionId}`)
    if (!rawData) {
        return null;
    }
    const { hashedOTP: storedOTP, meta } = JSON.parse(rawData)
    const attemptsKey = `otp:attempts:${meta.email}`
    const attemptsCount = parseInt(await redis.get(attemptsKey) || '0', 10)
    if (attemptsCount >= config.OTP_MAX_VERIFY_ATTEMPTS) {
        throw new TooManyRequestsError("Too many OTP verify attempts. Try again later", "OTP_VERIFY_RATE_LIMIT")
    }

    const hashedOTP = hmacFor(meta.email, otp);
    if (crypto.timingSafeEqual(Buffer.from(hashedOTP, 'hex'), Buffer.from(storedOTP, 'hex'))) {
        await redis.del(`otp:session:${otpSessionId}`, attemptsKey)
        await redis.del(`otp:rate:${meta.email}`)
        return meta;
    }
    else {
        await redis.incr(attemptsKey)
        await redis.expire(attemptsKey, config.OTP_TTL)
        return null
    }
}