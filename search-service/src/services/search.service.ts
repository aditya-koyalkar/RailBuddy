import { esClient, STATION_INDEX, TRAIN_INDEX } from "../config/elasticSearch.js"
import { logger } from "../config/logger.js"

const indexStation = async (event: any) => {
    const station = event.data;
    if (!station) {
        return;
    }
    try {
        await esClient.index({
            index: STATION_INDEX,
            id: station.id,
            document: {
                stationId: station.id,
                name: station.name,
                city: station.city,
                code: station.code,
                suggest: {
                    input: [station.name, station.code, station.city].filter(Boolean),
                    weight: 10
                }
            },
            refresh: true
        })
        logger.info(`Station indexed successfully: ${station.id}`);
    }
    catch (e: any) {
        logger.error(`Failed to index station ${station?.id}`, { error: e.message, stack: e.stack })
    }

}

const indexTrain = async (trainEvent: any) => {
    const train = trainEvent?.data;
    if (!train) {
        return;
    }

    const seatSummary = {
        total: 0, LOWER: 0, MIDDLE: 0, UPPER: 0, SIDE_UPPER: 0, SIDE_LOWER: 0
    } as any;

    (train.seats || []).forEach((s: any) => {
        seatSummary.total++;
        if (seatSummary[s.seatType] !== undefined) {
            seatSummary[s.seatType]++
        }
    })

    const doc = {
        trainId: train.id,
        trainName: train.trainName,
        trainNumber: train.trainNumber,
        route: [],
        schedules: [],
        seatSummary
    }

    try {
        await esClient.index({
            index: TRAIN_INDEX,
            id: train.id,
            document: doc,
            refresh: true
        })
        logger.info(`Train indexed successfully: ${train.id}`);
    } catch (e: any) {
        logger.error(`Failed to index train ${train?.id}`, { error: e.message, stack: e.stack });
    }
}

const indexTrainRoute = async (routeEvent: any) => {
    const routeData = routeEvent?.data || {};
    const { train, stops } = routeData;
    if (!train || !stops) {
        logger.warn(`indexTrainRoute: missing train or stops in payload`, { keys: Object.keys(routeData) });
        return;
    }

    const seatSummary = {
        total: 0, LOWER: 0, MIDDLE: 0, UPPER: 0, SIDE_UPPER: 0, SIDE_LOWER: 0
    } as any;

    (train.coaches || []).forEach((coach: any) => {
        (coach.seats || []).forEach((s: any) => {
            seatSummary.total++;
            if (seatSummary[s.seatType] !== undefined) {
                seatSummary[s.seatType]++
            }
        })
    })

    const doc = {
        trainId: train.id,
        trainName: train.name,
        trainNumber: train.trainNumber,
        route: stops.map((rs: any) => {
            return {
                stationId: rs.station.id,
                name: rs.station.name,
                city: rs.station.city,
                code: rs.station.code,
                sequenceNumber: rs.sequence,
                arrivalTime: rs.arrivalMinute,
                departureTime: rs.departureMinute,
                distanceFromOrigin: rs.distanceFromOrigin ?? 0
            }
        }),
        schedules: [],
        seatSummary
    }

    await esClient.index({
        index: TRAIN_INDEX,
        id: train.id,
        document: doc,
        refresh: true
    })

    for (const rs of stops) {
        await esClient.index({
            index: STATION_INDEX,
            id: rs.station.id,
            document: {
                stationId: rs.station.id,
                name: rs.station.name,
                city: rs.station.city,
                code: rs.station.code,
                suggest: {
                    input: [rs.station.name, rs.station.code, rs.station.city].filter(Boolean),
                    weight: 10
                }
            },
            refresh: true
        })
    }

    logger.info(`Train route indexed successfully: ${train.id}`);

}


const indexSchedule = async (scheduleEvent: any) => {
    const schedule = scheduleEvent?.data || {};
    const { scheduleId, trainId, departureDate, status, seats } = schedule;
    if (!scheduleId) {
        return;
    }

    const totalSeats = seats ? seats.length : 0;
    try {

        await esClient.update({
            index: TRAIN_INDEX,
            id: trainId,
            script: {
                source: `if(ctx._source.schedules == null){ ctx._source.schedules = [] }
                     // remove existing schedule with same id
                    ctx._source.schedules.removeIf(s -> s.scheduleId == params.scheduleId);
                     // add new schedule
                    ctx._source.schedules.add(params.newSchedule);
                `,
                params: {
                    scheduleId,
                    newSchedule: {
                        scheduleId,
                        departureDate,
                        status,
                        available: totalSeats,
                        locked: 0,
                        booked: 0
                    }
                },
            },
            refresh: true
        })
        logger.info(`Schedule indexed successfully: ${scheduleId} for train ${trainId}`);
    }
    catch (error: any) {
        logger.error(`Failed to index schedule ${scheduleId} for train ${trainId}`, { error: error.message, stack: error.stack });
    }
}

const searchTrains = async (from: string, to: string, date: string | null) => {

    const fromStation = await resolveStation(from);
    const toStation = await resolveStation(to);

    if (!fromStation) {
        return { trains: [], message: `Station ${from} not found` }
    }

    if (!toStation) {
        return { trains: [], message: `Station ${to} not found` }
    }

    if (fromStation.city === toStation.city) {
        return { trains: [], message: `From and To stations cannot be in the same city ${fromStation.city}` }
    }

    const query: any = {
        bool: {
            must: [
                {
                    nested: {
                        path: 'route',
                        query: {
                            term: { 'route.stationId': fromStation.stationId }
                        },
                        inner_hits: {
                            name: 'from_station'
                        }
                    }
                },
                {
                    nested: {
                        path: 'route',
                        query: {
                            term: { 'route.stationId': toStation.stationId }
                        },
                        inner_hits: {
                            name: 'to_station'
                        }
                    }
                }
            ]
        }
    };

    const result = await esClient.search({
        index: TRAIN_INDEX,
        query,
        size: 50
    });

    const trains = result.hits.hits.map((hit: any) => {
        const source = hit._source;
        const fromHit = hit.inner_hits.from_station.hits.hits[0]._source;
        const toHit = hit.inner_hits.to_station.hits.hits[0]._source;

        if (!fromHit || !toHit || fromHit.sequenceNumber >= toHit.sequenceNumber) {
            return null;
        }

        let scheduleInfo = null;

        if (date && source.schedules.length > 0) {
            scheduleInfo = source.schedules.find((s: any) => s.status === 'ACTIVE' && normalizeDateString(s.departureDate) === date) || null;
        }


        return {
            trainId: source.trainId,
            trainName: source.trainName,
            trainNumber: source.trainNumber,
            departureDate: date || null,
            schedule: scheduleInfo,
            from: {
                stationId: fromHit.stationId,
                name: fromHit.name,
                code: fromHit.code,
                city: fromHit.city,
                distanceFromOrigin: fromHit.distanceFromOrigin,
                arrivalTime: fromHit.arrivalTime,
                departureTime: fromHit.departureTime
            },
            to: {
                stationId: toHit.stationId,
                name: toHit.name,
                code: toHit.code,
                city: toHit.city,
                distanceFromOrigin: toHit.distanceFromOrigin,
                arrivalTime: toHit.arrivalTime,
                departureTime: toHit.departureTime
            },
            seatSummary: source.seatSummary
        }

    }).filter(Boolean);


    return {
        from: {
            resolved: fromStation.name, code: fromStation.code
        },
        to: {
            resolved: toStation.name, code: toStation.code
        },
        date: date || 'any',
        count: trains.length,
        trains
    }




}

const resolveStation = async (input: string) => {

    // 1.Try exact code matck
    const exactResult = await esClient.search({
        index: STATION_INDEX,
        query: {
            term: {
                "code": input.trim().toUpperCase()
            }
        },
        size: 1
    });

    if (exactResult.hits.hits.length > 0) {
        return exactResult.hits.hits[0]._source as any;
    }

    // 2. Try completion suggester for typos

    try {
        const suggestResult = await esClient.search({
            index: STATION_INDEX,
            suggest: {
                station_suggest: {
                    prefix: input,
                    completion: {
                        field: "suggest",
                        size: 1,
                        fuzzy: {
                            fuzziness: "AUTO"
                        }
                    }
                }
            }
        })

        const options = suggestResult.suggest?.station_suggest?.[0]?.options || [] as any;
        if (options.length > 0) {
            return options[0]._source;
        }

    }
    catch (error: any) {
        logger.warn(`Suggest fallback failed: ${error.message}`)
    }

    // 3. fuzzy match on name

    const fuzzyMatch = await esClient.search({
        index: STATION_INDEX,
        query: {
            multi_match: {
                query: input,
                fields: ["name", "city"],
                fuzziness: "AUTO",
                prefix_length: 1
            }
        },
        size: 1
    });

    return fuzzyMatch.hits.hits[0]._source || null;

}

const autocompleteStation = async (prefix: string) => {

    const result = await esClient.search({
        index: STATION_INDEX,
        suggest: {
            station_suggest: {
                prefix,
                completion: {
                    field: "suggest",
                    fuzzy: {
                        fuzziness: "AUTO"
                    },
                    size: 10
                }
            }
        }
    });

    const options = result.suggest?.station_suggest?.[0]?.options || [] as any;
    return options.map((opt: any) => ({
        name: opt._source.name,
        code: opt._source.code,
        city: opt._source.city,
        stationId: opt._source.stationId
    }));
}


const normalizeDateString = (dateStr: string) => {
    if (!dateStr) return null;
    return dateStr.split('T')[0];
}


export default { indexStation, indexTrain, indexTrainRoute, indexSchedule, searchTrains, autocompleteStation }