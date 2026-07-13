import { config } from "../config";
import withRetry from "../utils/withRetry";
import axios from "axios";

const client = axios.create({
    baseURL: config.INVENTORY_SERVICE_URL,
    timeout: 5000,
})

const inventoryClient = {
    async getAvailability(scheduleId: string) {
        return withRetry(async () => {
            const { data } = await client.get(`/schedules/${scheduleId}/availability`);
            return data.data;
        })
    },
    async getSeats(scheduleId: string, filters: { status?: string, seatType?: string, fromSeq?: number, toSeq?: number }) {
        return withRetry(async () => {
            const params: { status?: string, seatType?: string, fromSeq?: number, toSeq?: number } = {};
            if (filters.status) params.status = filters.status;
            if (filters.seatType) params.seatType = filters.seatType;
            if (filters.fromSeq) params.fromSeq = filters.fromSeq;
            if (filters.toSeq) params.toSeq = filters.toSeq;
            const { data } = await client.get(`/schedules/${scheduleId}/seats`, { params });
            return data.data;
        })
    },
    async holdSeats(scheduleId: string, seatIds: string[], userId: string, ttlSeconds: number, fromSeq: number, toSeq: number) {
        return withRetry(async () => {
            const { data } = await client.post('/seats/lock', {
                scheduleId, seatIds, userId, ttlSeconds, fromSeq, toSeq
            })
            return data.data;
        })
    },
    async releaseSeats(scheduleId: string, seatIds: string[], userId: string, fromSeq: number, toSeq: number) {
        return withRetry(async () => {
            const { data } = await client.post('/seats/release', {
                scheduleId, seatIds, userId, fromSeq, toSeq
            })
            return data.data;
        })
    }
}

export default inventoryClient;
