import { connectProducer, consumer } from "../../config/kafka";
import { logger } from "../../config/logger";
import inventoryService from "../../services/inventory.service";
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
                try {
                    const value = JSON.parse(message.value?.toString() || "");
                    switch (topic) {
                        case TOPICS.SCHEDULE_CREATED:
                            await inventoryService.initializeInventory(value);
                            break;
                        case TOPICS.SCHEDULE_CANCELLED:
                            await inventoryService.cancelSheduleInventory(value);
                            break;
                        default:
                            logger.warn(`Unknown topic: ${topic}`);
                    }
                } catch (error: any) {
                    logger.error(`Error processing inventory consumer message on topic ${topic}:`, {
                        error: error.message,
                        stack: error.stack
                    });
                    throw error;
                }
            }
        })


    }
}

export default new InventoryConsumer()