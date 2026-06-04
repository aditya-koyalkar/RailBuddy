import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { adminProducer } from "../kafka/producer/admin.producer"
import { CreateRouteDTO } from "../types/create.route.type"
import { CreateScheduleDTO } from "../types/create.schedule.type"
import { CreateTrainDTO } from "../types/create.train.type"
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error"

const createTrain = async ({ trainNumber, trainName, coachName, totalSeats, seats }: CreateTrainDTO) => {
    const existing = await prisma.train.findUnique({
        where: {
            trainNumber
        }
    })
    if (existing) {
        throw new ConflictError("Train number already exists")
    }

    const seatNumbers = seats.map((seat) => seat.seatNumber)
    if (new Set(seatNumbers).size !== seatNumbers.length) {
        throw new BadRequestError("Duplicate seat numbers found")
    }

    const train = await prisma.train.create({
        data: {
            trainNumber,
            trainName,
            coachName,
            totalSeats,
            seats: {
                create: seats.map((seat) => ({
                    seatNumber: seat.seatNumber,
                    seatType: seat.seatType,
                    price: seat.price
                }))
            }
        },
        include: {
            seats: {
                orderBy: {
                    seatNumber: 'asc'
                }
            }
        }
    })

    logger.info("Train created successfully", { id: train.id, trainNumber: train.trainNumber })

    await adminProducer.publishTrainCreated(train).catch((error) => {
        logger.error('Failed to publish train create event', { error: error.message })
    })

    return train

}

const createRoute = async (trainId: string, routeStations: CreateRouteDTO['routeStations']) => {
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

    const stationIds = routeStations.map((routeStation) => routeStation.stationId)
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

    const sorted = [...routeStations].sort((a, b) => a.sequenceNumber - b.sequenceNumber)

    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].sequenceNumber !== i + 1) {
            throw new BadRequestError("Sequence number are not in order")
        }
    }

    const route = await prisma.route.create({
        data: {
            trainId,
            routeStations: {
                create: routeStations.map((routeStation) => ({
                    stationId: routeStation.stationId,
                    arrivalTime: routeStation.arrivalTime,
                    departureTime: routeStation.departureTime,
                    sequenceNumber: routeStation.sequenceNumber,
                    distanceFromOrigin: routeStation.distanceFromOrigin
                }))
            }
        },
        include: {
            routeStations: {
                include: {
                    station: true
                },
                orderBy: {
                    sequenceNumber: 'asc'
                }
            }
        }
    })

    const trainWithSeats = await prisma.train.findUnique({
        where: { id: trainId },
        include: {
            seats: {
                orderBy: {
                    seatNumber: 'asc'
                }
            }
        }
    })

    logger.info("Route created successfully", { id: route.id, trainId: route.trainId })

    await adminProducer.publishRouteCreated({ ...route, train: trainWithSeats! }).catch((error) => {
        logger.error('Failed to publish route create event', { error: error.message })
    })

    return route
}

const getTrainById = async (trainId: string) => {
    const train = await prisma.train.findUnique({
        where: { id: trainId },
        include: {
            seats: {
                orderBy: { seatNumber: 'asc' }
            },
            route: {
                include: {
                    routeStations: {
                        include: { station: true },
                        orderBy: { sequenceNumber: 'asc' }
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
                    routeStations: {
                        include: {
                            station: true
                        },
                        orderBy: {
                            sequenceNumber: 'asc'
                        }
                    }
                }
            },
            seats: true
        }
    })
    if (!train) {
        throw new NotFoundError("Train not found")
    }

    if (train.seats.length === 0) {
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

    await adminProducer.publishScheduleCreated(schedule).catch((error) => {
        logger.error('Failed to publish schedule create event', { error: error.message })
    })

    return schedule
}

export default { createTrain, createRoute, getTrainById, createSchedule }
