import { prisma } from "../config/prisma.js"
import type { SendOTPParams } from "../types/send-otp.type.js";
import { sendOTPEmail, sendVerificationSuccessfullEmail } from "../utils/email.js";
import { BadRequestError, ConflictError } from "../utils/error.js"
import bcrypt from "bcrypt";
import { generateAndStoreOTP, verifyOTP } from "../utils/otp.js";
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

export default { sendOTP, verifyOTPAndCreateUser }