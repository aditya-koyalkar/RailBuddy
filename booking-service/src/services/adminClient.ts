import axios from "axios";
import { config } from "../config/index.js";
import withRetry from "../utils/withRetry.js";

const client = axios.create({
    baseURL: config.ADMIN_SERVICE_URL,
    timeout: 5000,
});

const adminClient = {
    async getTrainDetails(trainId: string, userId: string) {
        return withRetry(async () => {
            const { data } = await client.get(`/api/v1/train/${trainId}`, {
                headers: {
                    'x-user-id': userId
                }
            });
            return data.data;
        });
    }
};

export default adminClient;
