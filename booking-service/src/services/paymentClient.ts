import withRetry from "../utils/withRetry";
import axios from "axios";
import { config } from "../config";

const client = axios.create({
    baseURL: config.PAYMENT_SERVICE_URL,
    timeout: 5000,
})

const paymentClient = {
    async createPaymentOrder(bookingId: string, amount: number, userId: string, idempotencyKey: string) {
        return withRetry(async () => {
            const { data } = await client.post('/orders', {
                bookingId,
                amount,
                userId,
                idempotencyKey
            })
            return data.data;
        })
    }
}

export default paymentClient