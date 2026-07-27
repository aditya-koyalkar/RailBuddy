import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { adminProducer } from "../kafka/producer/admin.producer"
import { CreateRouteDTO } from "../types/create.route.type"
import { CreateScheduleDTO } from "../types/create.schedule.type"
import { CreateTrainDTO } from "../types/create.train.type"
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error"

const createTrain = async ({ trainNumber, name, coaches, fares }: CreateTrainDTO) => {
    const existing = await prisma.train.findUnique({
        where: {
            trainNumber
        }
    })
    if (existing) {
        throw new ConflictError("Train number already exists")
    }

    for (const coach of coaches) {
        const seatNumbers = coach.seats.map((seat) => seat.seatNumber)
        if (new Set(seatNumbers).size !== seatNumbers.length) {
            throw new BadRequestError(`Duplicate seat numbers found in coach ${coach.coachNumber}`)
        }
    }

    const trainData: any = {
        trainNumber,
        name,
        coaches: {
            create: coaches.map((coach) => ({
                coachNumber: coach.coachNumber,
                coachType: coach.coachType,
                seatCount: coach.seats.length,
                seats: {
                    create: coach.seats.map((seat) => ({
                        seatNumber: seat.seatNumber,
                        seatLabel: seat.seatLabel,
                        seatType: seat.seatType,
                        isActive: true
                    }))
                }
            }))
        }
    }

    if (fares && fares.length > 0) {
        trainData.fares = {
            create: fares.map((fare) => ({
                fromStationId: fare.fromStationId,
                toStationId: fare.toStationId,
                coachType: fare.coachType,
                fare: fare.fare
            }))
        }
    }

    const train = await prisma.train.create({
        data: trainData,
        include: {
            coaches: {
                include: {
                    seats: {
                        orderBy: {
                            seatNumber: 'asc'
                        }
                    }
                },
                orderBy: {
                    coachNumber: 'asc'
                }
            },
            fares: true
        }
    })

    logger.info("Train created successfully", { id: train.id, trainNumber: train.trainNumber })

    await adminProducer.publishTrainCreated(train).catch((error) => {
        logger.error('Failed to publish train create event', { error: error.message })
    })

    return train

}

const createRoute = async (trainId: string, stops: CreateRouteDTO['stops']) => {
    const existing = await prisma.train.findUnique({
        where: {
            id: trainId
        }
    })
    if (!existing) {
        throw new NotFoundError("Train not found")
    }

    const existingRoute = await prisma.route.findUnique({
        where: {
            trainId
        }
    })
    if (existingRoute) {
        throw new ConflictError("Route already exists")
    }

    const stationIds = stops.map((stop) => stop.stationId)
    const existingStations = await prisma.station.findMany({
        where: {
            id: {
                in: stationIds
            }
        }
    })
    if (existingStations.length !== stationIds.length) {
        throw new NotFoundError("One or more stations not found")
    }

    const sorted = [...stops].sort((a, b) => a.sequence - b.sequence)

    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].sequence !== i + 1) {
            throw new BadRequestError("Sequence numbers are not in order")
        }
    }

    const route = await prisma.route.create({
        data: {
            trainId,
            stops: {
                create: stops.map((stop) => ({
                    sequence: stop.sequence,
                    arrivalDay: stop.arrivalDay ?? null,
                    departureDay: stop.departureDay ?? null,
                    arrivalMinute: stop.arrivalMinute ?? null,
                    departureMinute: stop.departureMinute ?? null,
                    haltMinutes: stop.haltMinutes ?? null,
                    station: {
                        connect: { id: stop.stationId }
                    }
                }))
            }
        },
        include: {
            stops: {
                include: {
                    station: true
                },
                orderBy: {
                    sequence: 'asc'
                }
            }
        }
    })

    const trainWithCoachesAndSeats = await prisma.train.findUnique({
        where: { id: trainId },
        include: {
            coaches: {
                include: {
                    seats: {
                        orderBy: {
                            seatNumber: 'asc'
                        }
                    }
                },
                orderBy: {
                    coachNumber: 'asc'
                }
            }
        }
    })

    logger.info("Route created successfully", { id: route.id, trainId: route.trainId })

    await adminProducer.publishRouteCreated({ ...route, train: trainWithCoachesAndSeats! }).catch((error) => {
        logger.error('Failed to publish route create event', { error: error.message })
    })

    return route
}

const getTrainById = async (trainId: string) => {
    const train = await prisma.train.findUnique({
        where: { id: trainId },
        include: {
            coaches: {
                include: {
                    seats: {
                        orderBy: { seatNumber: 'asc' }
                    }
                },
                orderBy: { coachNumber: 'asc' }
            },
            fares: true,
            route: {
                include: {
                    stops: {
                        include: { station: true },
                        orderBy: { sequence: 'asc' }
                    }
                }
            }
        }
    })

    if (!train) {
        throw new NotFoundError("Train not found")
    }

    return train
}

const createSchedule = async ({ trainId, departureDate, status }: CreateScheduleDTO) => {
    const train = await prisma.train.findUnique({
        where: { id: trainId },
        include: {
            route: {
                include: {
                    stops: {
                        include: {
                            station: true
                        },
                        orderBy: {
                            sequence: 'asc'
                        }
                    }
                }
            },
            coaches: {
                include: {
                    seats: true
                }
            }
        }
    })
    if (!train) {
        throw new NotFoundError("Train not found")
    }

    const totalSeatsCount = train.coaches.reduce((acc, coach) => acc + coach.seats.length, 0)
    if (totalSeatsCount === 0) {
        throw new BadRequestError("Train has no seats")
    }

    if (!train.route) {
        throw new BadRequestError("Route not found")
    }

    const date = new Date(departureDate)

    if (isNaN(date.getTime())) {
        throw new BadRequestError("Invalid departure date")
    }

    const existingSchedule = await prisma.schedule.findUnique({
        where: {
            trainId_departureDate: {
                trainId,
                departureDate: date
            }
        }
    })
    if (existingSchedule) {
        throw new ConflictError("Schedule for this train and date already exists")
    }

    const schedule = await prisma.schedule.create({
        data: {
            trainId,
            departureDate: date,
            status
        }
    })

    logger.info("Schedule created successfully", { id: schedule.id, trainId: schedule.trainId })

    await adminProducer.publishScheduleCreated(schedule, train).catch((error) => {
        logger.error('Failed to publish schedule create event', { error: error.message })
    })

    return schedule
}

export default { createTrain, createRoute, getTrainById, createSchedule }


