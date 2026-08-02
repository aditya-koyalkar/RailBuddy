import { Route, Schedule, Station, Train } from "@prisma/client";
import { connectProducer, producer } from "../../config/kafka";
import { TOPICS } from "../../utils/constants";
import { logger } from "../../config/logger";

class AdminProducer {
    isInitialized;
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        await connectProducer()
        this.isInitialized = true;
    }

    async publishStationCreated(station: Station) {
        return this.sendMessage(TOPICS.STATION_CREATED, `station-${station.id}`, {
            eventType: 'STATION_CREATED',
            data: station, timeStamp: new Date().toISOString()
        })
    }

    async publishTrainCreated(train: Train) {
        return this.sendMessage(TOPICS.TRAIN_CREATED, `train-${train.id}`, {
            eventType: 'TRAIN_CREATED',
            data: train, timeStamp: new Date().toISOString()
        })
    }

    async publishRouteCreated(route: Route & { train: Train }) {
        return this.sendMessage(TOPICS.ROUTE_CREATED, `route-${route.id}`, {
            eventType: 'ROUTE_CREATED',
            data: route, timeStamp: new Date().toISOString()
        })
    }

    async publishScheduleCreated(schedule: Schedule, train: any) {
        const coaches = train?.coaches || [];
        const payload = {
            scheduleId: schedule.id,
            trainId: train.id,
            trainNumber: train.trainNumber,
            trainName: train.name,
            departureDate: schedule.departureDate,
            coaches: coaches.map((coach: any) => ({
                coachId: coach.id,
                coachNumber: coach.coachNumber,
                coachType: coach.coachType,
                seats: (coach.seats || []).map((seat: any) => ({
                    seatId: seat.id,
                    seatNumber: seat.seatNumber,
                    seatLabel: seat.seatLabel,
                    seatType: seat.seatType
                }))
            })),
            seats: coaches.flatMap((coach: any) =>
                (coach.seats || []).map((seat: any) => ({
                    seatId: seat.id,
                    coachId: coach.id,
                    coachNumber: coach.coachNumber,
                    coachType: coach.coachType,
                    seatNumber: seat.seatNumber,
                    seatLabel: seat.seatLabel,
                    seatType: seat.seatType
                }))
            ),
            route: train.route?.stops?.map((stop: any) => ({
                stationId: stop.stationId,
                stationName: stop.station?.name || '',
                stationCode: stop.station?.code || '',
                sequenceNumber: stop.sequence,
                sequence: stop.sequence,
                arrivalDay: stop.arrivalDay,
                departureDay: stop.departureDay,
                arrivalMinute: stop.arrivalMinute,
                departureMinute: stop.departureMinute,
                haltMinutes: stop.haltMinutes
            })) || []
        };
        return this.sendMessage(TOPICS.SCHEDULE_CREATED, `schedule-${schedule.id}`, {
            eventType: 'SCHEDULE_CREATED',
            data: payload,
            timeStamp: new Date().toISOString()
        })
    }



    async sendMessage(topic: string, key: string, value: any) {
        try {
            await this.initialize()
            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timeStamp: Date.now().toString()
                }]
            }
            const result = await producer.send(message);
            logger.info(`Message sent to kafka topic : ${topic}`, {
                key,
                partition: result[0]?.partition,
                offset: result[0]?.offset
            })

            return result
        }
        catch (e: any) {
            logger.error("failed to send message o kafka topic : ", topic, {
                error: e.error,
                stack: e.stack, key
            })
            throw e
        }
    }
}

export const adminProducer = new AdminProducer()


