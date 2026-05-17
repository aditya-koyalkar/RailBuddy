import { config } from "../config/index.js";
import type { SendOTPParams } from "../types/send-otp.type.js";
import { TooManyRequestsError } from "./error.js";
import otpGenerator from "otp-generator"
import crypto from "crypto"
import { redis } from "../config/redis.js";


export const generateAndStoreOTP = async ({ email }: SendOTPParams) => {
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
        meta: { email }
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
        .update(email + "otp")
        .digest("hex");
    return hash
}