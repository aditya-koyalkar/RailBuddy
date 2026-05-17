import { prisma } from "../config/prisma.js"
import type { SendOTPParams } from "../types/send-otp.type.js";
import { sendOTPEmail } from "../utils/email.js";
import { ConflictError } from "../utils/error.js"
import bcrypt from "bcrypt";
import { generateAndStoreOTP } from "../utils/otp.js";

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
    const meta = { firstName, lastName, email, password: hashedPassword };
    const { otp, otpSessionId } = await generateAndStoreOTP(meta);

    await sendOTPEmail({ otp, email })

    return { otpSessionId }

}

export default { sendOTP }