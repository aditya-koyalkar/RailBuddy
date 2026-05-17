import { config } from "../config/index.js";
import sendgridMail from "@sendgrid/mail";
import { logger } from "../config/logger.js";
import { InternalServerError } from "./error.js";
sendgridMail.setApiKey(config.SENDGRID_API_KEY)
interface SendOtpParams {
    email: string;
    otp: string;
    name?: string;
}

export const sendOTPEmail = async ({
    email,
    otp,
}: SendOtpParams) => {
    try {
        await sendgridMail.send({
            to: email,
            from: config.SENDGRID_FROM_EMAIL, // verified sender email
            subject: "Your OTP Verification Code",
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hello User</h2>
          
          <p>Your OTP for verification is:</p>

          <div
            style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 6px;
              margin: 20px 0;
              color: #2563eb;
            "
          >
            ${otp}
          </div>

          <p>This OTP is valid for 10 minutes.</p>

          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
        });

        return {
            success: true,
            message: "OTP email sent successfully",
        };
    } catch (error) {
        logger.error("Send OTP Email Error:", error);

        throw new InternalServerError("Error sending Email")
    }
};