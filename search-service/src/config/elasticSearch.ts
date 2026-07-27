import { Client } from "@elastic/elasticsearch"
import { config } from "./index.js"
import { logger } from "./logger.js"


export const esClient = new Client({
    node: config.ELASTICSEARCH_URL
})

export const STATION_INDEX = 'stations'
export const TRAIN_INDEX = 'trains'




export const initIndices = async () => {
    const stattionExists = await esClient.indices.exists({ index: STATION_INDEX });
    if (!stattionExists) {
        await esClient.indices.create({
            index: STATION_INDEX, settings: {
                analysis: {
                    analyzer: {
                        autocomplete_analyzer: {
                            type: "custom",
                            tokenizer: "autocomplete_tokenizer", // creates prefixes like 'a','au','aut','auto' for 'auto' query and help's in suggestions
                            filter: [
                                "lowercase" // converts prefixes to lowercase to match with query with case insensitivity
                            ]
                        },
                        search_analyzer: {
                            type: "custom",
                            tokenizer: "standard", // for normal search
                            filter: [
                                "lowercase"
                            ]
                        }
                    },
                    tokenizer: {
                        autocomplete_tokenizer: {
                            type: "edge_ngram",
                            min_gram: 2,
                            max_gram: 20,
                            token_chars: [
                                "letter",
                                "digit"
                            ]
                        }
                    }
                }
            },
            mappings: {
                properties: {
                    stationId: { type: "keyword" },
                    name: {
                        type: "text", analyzer: "autocomplete_analyzer", search_analyzer: "search_analyzer"
                    },
                    code: { type: "keyword" },
                    city: {
                        type: "text", analyzer: "autocomplete_analyzer", search_analyzer: "search_analyzer"
                    },
                    state: {
                        type: "text", analyzer: "autocomplete_analyzer", search_analyzer: "search_analyzer"
                    },
                    suggest: {
                        type: "completion"
                    }
                }
            }
        })
    }
    const trainExists = await esClient.indices.exists({ index: TRAIN_INDEX });
    if (!trainExists) {
        await esClient.indices.create({
            index: TRAIN_INDEX,
            mappings: {
                properties: {
                    trainId: { type: "keyword" },
                    trainName: { type: "text" },
                    trainNumber: { type: "keyword" },
                    route: {
                        type: "nested",
                        properties: {
                            stationId: { type: "keyword" },
                            stationCode: { type: "keyword" },
                            stationName: { type: "keyword" },
                            stopNumber: { type: "integer" },
                            arrivalTime: { type: "keyword" },
                            departureTime: { type: "keyword" },
                            distanceFromOrigin: { type: "float" }
                        }
                    },
                    schedules: {
                        type: "nested",
                        properties: {
                            scheduleId: { type: "keyword" },
                            departureDate: { type: "date" },
                            status: { type: "keyword" },
                            available: { type: "integer" },
                            locked: { type: "integer" },
                            booked: { type: "integer" }
                        }
                    },
                    seatSummary: {
                        properties: {
                            total: { type: "integer" },
                            LOWER: { type: "integer" },
                            MIDDLE: { type: "integer" },
                            UPPER: { type: "integer" },
                            SIDE_LOWER: { type: "integer" },
                            SIDE_UPPER: { type: "integer" }
                        }
                    }
                }
            }
        })
    }
}

export const recreateIndices = async () => {

    for (const index of [STATION_INDEX, TRAIN_INDEX]) {
        const exists = await esClient.indices.exists({ index })
        if (exists) {
            await esClient.indices.delete({ index })
        }
        await initIndices()
    }
    logger.info("All indices recreated")
}