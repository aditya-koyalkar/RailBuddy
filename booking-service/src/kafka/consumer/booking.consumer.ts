import { connectProducer, consumer } from "../../config/kafka";
import { logger } from "../../config/logger";
import { TOPICS } from "../../utils/constants";

class InventoryConsumer {
    async start() {
        await consumer.connect();
        await connectProducer();

        logger.info('Inventory consumer connected');

        await consumer.subscribe({
            topics: [
                TOPICS.SCHEDULE_CREATED,
                TOPICS.SCHEDULE_CANCELLED
            ],
            fromBeginning: true
        });


        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                logger.info('Received message:', {
                    topic,
                    partition,
                    offset: message.offset,
                    value: message.value?.toString(),
                });
                // const value = JSON.parse(message.value?.toString() || "")
                switch (topic) {

                }
            }
        })


    }
}

export default new InventoryConsumer()