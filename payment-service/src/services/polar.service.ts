import { Polar } from "@polar-sh/sdk";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { config } from "../config/index";
import { logger } from "../config/logger";
import { InternalServerError } from "../utils/error";

class PolarService {
    private polar: Polar;

    constructor() {
        this.polar = new Polar({
            accessToken: config.POLAR_ACCESS_TOKEN,
            server: config.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production"
        });
    }

    /**
     * Creates a Polar checkout session with dynamic ad-hoc pricing for a booking.
     */
    async createCheckoutSession(bookingId: string, amount: number, currency: string = "usd") {
        try {
            // Amount in cents (Polar expects integer cents for fixed prices)
            const priceAmount = Math.round(amount * 100);

            const checkoutOptions: any = {
                metadata: {
                    bookingId
                }
            };

            // If a product ID is configured, attach ad-hoc price to it; otherwise use ad-hoc checkout directly
            if (config.POLAR_PRODUCT_ID && config.POLAR_PRODUCT_ID !== "REPLACE_ME") {
                checkoutOptions.productId = config.POLAR_PRODUCT_ID;
                checkoutOptions.prices = [
                    {
                        amountType: "fixed",
                        priceAmount,
                        priceCurrency: currency.toLowerCase()
                    }
                ];
            } else {
                // Fallback: create checkout using ad-hoc price specification
                checkoutOptions.prices = [
                    {
                        amountType: "fixed",
                        priceAmount,
                        priceCurrency: currency.toLowerCase()
                    }
                ];
            }

            const session = await this.polar.checkouts.create(checkoutOptions);

            logger.info(`Polar checkout session created`, {
                bookingId,
                checkoutId: session.id,
                url: session.url
            });

            return {
                checkoutId: session.id,
                checkoutUrl: session.url
            };
        } catch (error: any) {
            logger.error(`Failed to create Polar checkout session for booking ${bookingId}`, {
                error: error.message || error
            });
            throw new InternalServerError(`Polar checkout creation failed: ${error.message || "Unknown error"}`);
        }
    }

    /**
     * Validates and parses an incoming Polar webhook event.
     */
    validateWebhook(body: string | Buffer, headers: Record<string, string | string[] | undefined>) {
        try {
            const webhookHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(headers)) {
                if (typeof value === "string") {
                    webhookHeaders[key.toLowerCase()] = value;
                } else if (Array.isArray(value) && value.length > 0) {
                    webhookHeaders[key.toLowerCase()] = value[0];
                }
            }

            const event = validateEvent(body, webhookHeaders, config.POLAR_WEBHOOK_SECRET);
            return event;
        } catch (error: any) {
            logger.error(`Polar webhook verification failed`, { error: error.message });
            throw error;
        }
    }

    /**
     * Directly queries Polar API to verify a checkout session status.
     */
    async verifyCheckout(checkoutId: string) {
        try {
            const checkout = await this.polar.checkouts.get({ id: checkoutId });
            return checkout;
        } catch (error: any) {
            logger.error(`Failed to verify checkout ${checkoutId} with Polar API`, { error: error.message || error });
            throw new InternalServerError(`Polar checkout verification failed: ${error.message || "Unknown error"}`);
        }
    }

    /**
     * Issues a refund for a Polar order.
     */
    async createRefund(polarOrderId: string, amount?: number, reason?: string) {
        try {
            const refundOptions: any = {
                orderId: polarOrderId,
                reason: (reason as any) || "customer_request"
            };

            if (amount !== undefined && amount > 0) {
                refundOptions.amount = Math.round(amount * 100);
            }

            const refund = await this.polar.refunds.create(refundOptions);

            logger.info(`Polar refund created for order ${polarOrderId}`, {
                refundId: (refund as any)?.id,
                amount: (refund as any)?.amount
            });

            return refund;
        } catch (error: any) {
            logger.error(`Failed to create Polar refund for order ${polarOrderId}`, {
                error: error.message || error
            });
            throw new InternalServerError(`Polar refund creation failed: ${error.message || "Unknown error"}`);
        }
    }
}

export default new PolarService();
