import axios from "axios";
import { config } from "../config/index.js";
import withRetry from "../utils/withRetry.js";

const client = axios.create({
    baseURL: config.USER_SERVICE_URL,
    timeout: 5000
});

const userClient = {
    async getUserProfile(userId: string) {
        return withRetry(async () => {
            const { data } = await client.get("/api/v1/user/get-profile", {
                headers: {
                    "x-user-id": userId
                }
            });
            return data.data;
        });
    }
};

export default userClient;
