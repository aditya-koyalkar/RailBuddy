import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import sendgridMail from "@sendgrid/mail";
sendgridMail.setApiKey(config.SENDGRID_API_KEY)

class EmailService {
  maxRetries
  from
  constructor() {
    this.maxRetries = 3
    this.from = config.SENDGRID_FROM_EMAIL
  }
  async sendWithRetry(msg: any, retries = 0): Promise<any> {
    try {
      await sendgridMail.send(msg);
      logger.info(`Email sent successfully to ${msg.to}`, {
        subject: msg.subject
      })
      return {
        success: true
      }
    }
    catch (error) {
      logger.error(`Email sending failed attempt: ${retries + 1}/${this.maxRetries}`)

      if (retries < this.maxRetries - 1) {
        const delay = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.sendWithRetry(msg, retries + 1)
      }
      logger.error(`Email sending failed`, {
        error: JSON.stringify(error),

      })
      throw error
    }
  }

  async sendOTPEmail(email: string,
    otp: string,
    ttlMinutes: number) {
    const msg = {
      to: email,
      from: config.SENDGRID_FROM_EMAIL,
      subject: 'Your Verification code',
      html: this.getOTPTemplate(otp, ttlMinutes)
    }
    await this.sendWithRetry(msg)
  }
  async sendWelcomeEmail(email: string) {
    const msg = {
      to: email,
      from: config.SENDGRID_FROM_EMAIL,
      subject: 'Your Verification code',
      html: this.getWelcomeTemplate()
    }
    await this.sendWithRetry(msg)
  }
  getOTPTemplate(otp: string, ttlMinutes: number) {
    return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hi Welcome to Railbuddy . Use the verification code below to complete your sign up:</h2>
        
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

          <p>This OTP is valid for ${ttlMinutes} minutes.</p>

          <p>If you did not request this, please ignore this email.</p>
        </div>
      `;
  }
  getWelcomeTemplate() {
    return `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
          <h2>Welcome to RailBuddy 🎉</h2>

          <p>Your OTP verification has been completed successfully.</p>

          <p>You can now continue using your account securely.</p>

          <p>If this was not you, please contact support immediately.</p>

          <br />

          <p>Regards,</p>
          <p><strong>RailBuddy Team</strong></p>
        </div>
      `
  }
}


export default new EmailService