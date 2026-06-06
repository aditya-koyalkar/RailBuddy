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
        schedule: [],
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
    const { train, routeStations } = routeData;
    if (!train || !routeStations) {
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
        route: routeStations.map((rs: any) => {
            return {
                stationId: rs.station.stationId,
                name: rs.station.name,
                city: rs.station.city,
                code: rs.station.code,
                sequenceNumber: rs.sequenceNumber,
                arrivalTime: rs.arrivalTime,
                departureTime: rs.departureTime,
                distanceFromOrigin: rs.distanceFromOrigin
            }
        }),
        schedule: [],
        seatSummary
    }

    await esClient.index({
        index: TRAIN_INDEX,
        id: train.id,
        document: doc,
        refresh: true
    })

    for (const rs of routeStations) {
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
    const { id: scheduleId, trainId, departureDate, status, seats } = schedule;
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


export default { indexStation, indexTrain, indexTrainRoute, indexSchedule }