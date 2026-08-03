import { config } from "../config";
import withRetry from "../utils/withRetry";
import axios from "axios";

const client = axios.create({
    baseURL: config.INVENTORY_SERVICE_URL,
    timeout: 5000,
});

const inventoryClient = {
    async getAvailability(scheduleId: string, fromSeq?: number, toSeq?: number) {
        return withRetry(async () => {
            const params: Record<string, any> = {};
            if (fromSeq !== undefined) params.fromSeq = fromSeq;
            if (toSeq !== undefined) params.toSeq = toSeq;
            const { data } = await client.get(`/api/inventory/schedules/${scheduleId}/availability`, { params });
            return data.data;
        });
    },
    async holdSeats(scheduleId: string, seatIds: string[], userId: string, ttlSeconds: number, fromSeq: number, toSeq: number, bookingId: string) {
        return withRetry(async () => {
            const { data } = await client.post('/api/inventory/seats/lock', {
                scheduleId, seatIds, userId, ttlSeconds, fromSeq, toSeq, bookingId
            }, {
                headers: { 'x-user-id': userId }
            });
            return data.data;
        });
    },
    async releaseSeats(scheduleId: string, seatIds: string[], userId: string, fromSeq: number, toSeq: number, bookingId: string) {
        return withRetry(async () => {
            const { data } = await client.post('/api/inventory/seats/release', {
                scheduleId, seatIds, userId, fromSeq, toSeq, bookingId
            }, {
                headers: { 'x-user-id': userId }
            });
            return data.data;
        });
    },
    async confirmSeats(scheduleId: string, seatIds: string[], userId: string, fromSeq: number, toSeq: number, bookingId: string) {
        return withRetry(async () => {
            const { data } = await client.post('/api/inventory/seats/confirm', {
                scheduleId, seatIds, userId, fromSeq, toSeq, bookingId
            }, {
                headers: { 'x-user-id': userId }
            });
            return data.data;
        });
    },
    async cancelBooking(scheduleId: string, seatIds: string[], userId: string, fromSeq: number, toSeq: number, bookingId: string) {
        return withRetry(async () => {
            const { data } = await client.post('/api/inventory/seats/cancel', {
                scheduleId, seatIds, userId, fromSeq, toSeq, bookingId
            }, {
                headers: { 'x-user-id': userId }
            });
            return data.data;
        });
    },
    async getSeatsByIds(scheduleId: string, seatIds: string[], fromSeq: number, toSeq: number): Promise<Array<{ seatId: string; coachId: string; coachNumber: string; coachType: string; seatNumber: number; seatLabel: string; seatType: string; segmentStatus: string }>> {
        return withRetry(async () => {
            const { data } = await client.get(`/api/inventory/schedules/${scheduleId}/seats`, {
                params: { seatIds: seatIds.join(','), fromSeq, toSeq }
            });
            return data.data;
        });
    }
};

export default inventoryClient;
