import { consumer } from "../../config/kafka"
import { logger } from "../../config/logger"
import searchService from "../../services/search.service";
import { TOPICS } from "../../utils/constants";


class SearchConsumer {
    async start() {
        await consumer.connect()
        logger.info("search consumer started");
        await consumer.subscribe({ topics: [TOPICS.SCHEDULE_CREATED, TOPICS.ROUTE_CREATED, TOPICS.TRAIN_CREATED, TOPICS.STATION_CREATED], fromBeginning: true })
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const value = message.value?.toString();
                    if (!value) return;
                    const data = JSON.parse(value)

                    logger.info(`Received message on topic ${topic}:`, { partition, offset: message.offset })

                    switch (topic) {
                        case TOPICS.SCHEDULE_CREATED:
                            await searchService.indexSchedule(data);
                            break;
                        case TOPICS.ROUTE_CREATED:
                            await searchService.indexTrainRoute(data);
                            break;
                        case TOPICS.STATION_CREATED:
                            await searchService.indexStation(data);
                            break;
                        case TOPICS.TRAIN_CREATED:
                            await searchService.indexTrain(data);
                            break;
                        default:
                            logger.warn(`Unknown topic: ${topic}`);
                            break;
                    }

                }
                catch (error) {
                    logger.error(`Error processing message on topic ${topic}:`, error);
                    throw error;
                }
            }
        })
    }

}

export const searchConsumer = new SearchConsumer();