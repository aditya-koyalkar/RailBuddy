import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
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

    const train = await prisma.$transaction(async (tx) => {
        const createdTrain = await tx.train.create({
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
        });

        await tx.adminOutbox.create({
            data: {
                aggregateType: "Train",
                aggregateId: createdTrain.id,
                eventType: "TRAIN_CREATED",
                payload: createdTrain as any
            }
        });

        return createdTrain;
    });

    logger.info("Train created successfully with outbox record", { id: train.id, trainNumber: train.trainNumber });

    return train;
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
    });

    const route = await prisma.$transaction(async (tx) => {
        const createdRoute = await tx.route.create({
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
        });

        await tx.adminOutbox.create({
            data: {
                aggregateType: "Route",
                aggregateId: createdRoute.id,
                eventType: "ROUTE_CREATED",
                payload: { ...createdRoute, train: trainWithCoachesAndSeats! } as any
            }
        });

        return createdRoute;
    });

    logger.info("Route created successfully with outbox record", { id: route.id, trainId: route.trainId });

    return route;
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

    const schedule = await prisma.$transaction(async (tx) => {
        const createdSchedule = await tx.schedule.create({
            data: {
                trainId,
                departureDate: date,
                status
            }
        });

        const coaches = train.coaches || [];
        const serializedTrain = {
            id: train.id,
            trainNumber: train.trainNumber,
            name: train.name,
            route: train.route,
            coaches: coaches.map((coach) => ({
                id: coach.id,
                coachNumber: coach.coachNumber,
                coachType: coach.coachType,
                seats: (coach.seats || []).map((seat) => ({
                    id: seat.id,
                    seatNumber: seat.seatNumber,
                    seatLabel: seat.seatLabel,
                    seatType: seat.seatType
                }))
            }))
        };

        await tx.adminOutbox.create({
            data: {
                aggregateType: "Schedule",
                aggregateId: createdSchedule.id,
                eventType: "SCHEDULE_CREATED",
                payload: {
                    schedule: createdSchedule,
                    train: serializedTrain
                } as any
            }
        });

        return createdSchedule;
    });

    logger.info("Schedule created successfully with outbox record", { id: schedule.id, trainId: schedule.trainId });

    return schedule;
}

const createFares = async (trainId: string, fares: Array<{ fromStationId: string; toStationId: string; coachType: any; fare: number }>) => {
    const train = await prisma.train.findUnique({
        where: { id: trainId },
        include: {
            route: {
                include: {
                    stops: {
                        orderBy: { sequence: 'asc' }
                    }
                }
            }
        }
    });

    if (!train) {
        throw new NotFoundError("Train not found");
    }

    if (!fares || !Array.isArray(fares) || fares.length === 0) {
        throw new BadRequestError("Fares array is required and cannot be empty");
    }

    const stops = train.route?.stops || [];

    for (const fareItem of fares) {
        if (!fareItem.fromStationId || !fareItem.toStationId || !fareItem.coachType || fareItem.fare === undefined || fareItem.fare < 0) {
            throw new BadRequestError("Each fare item must include fromStationId, toStationId, coachType, and a non-negative fare amount");
        }

        if (fareItem.fromStationId === fareItem.toStationId) {
            throw new BadRequestError("Origin and Destination stations cannot be the same station.");
        }

        if (stops.length > 0) {
            const fromStop = stops.find((s) => s.stationId === fareItem.fromStationId);
            const toStop = stops.find((s) => s.stationId === fareItem.toStationId);

            if (fromStop && toStop && fromStop.sequence >= toStop.sequence) {
                throw new BadRequestError(`Invalid direction! Fares can only be defined in the forward train route direction (Stop #${fromStop.sequence} → Stop #${toStop.sequence} is invalid).`);
            }
        }
    }

    const createdFares = await prisma.$transaction(async (tx) => {
        // Delete existing fares for the specific station pair being updated
        for (const f of fares) {
            await tx.fare.deleteMany({
                where: {
                    trainId,
                    fromStationId: f.fromStationId,
                    toStationId: f.toStationId,
                    coachType: f.coachType
                }
            });
        }

        await tx.fare.createMany({
            data: fares.map((f) => ({
                trainId,
                fromStationId: f.fromStationId,
                toStationId: f.toStationId,
                coachType: f.coachType,
                fare: f.fare
            }))
        });

        return await tx.fare.findMany({
            where: { trainId }
        });
    });

    logger.info("Fares initialized successfully", { trainId, count: createdFares.length });

    return createdFares;
}

const getAllTrains = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.train.findMany({
        include: {
            coaches: {
                include: {
                    seats: true
                },
                orderBy: { coachNumber: 'asc' }
            },
            fares: true,
            schedules: {
                where: { departureDate: { gte: today } },
                orderBy: { departureDate: 'asc' }
            },
            route: {
                include: {
                    stops: {
                        include: { station: true },
                        orderBy: { sequence: 'asc' }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

const searchTrains = async (fromCode: string, toCode: string, date: string) => {
    // 1. Resolve both station codes upfront
    const [fromStation, toStation] = await Promise.all([
        prisma.station.findUnique({ where: { code: fromCode.trim().toUpperCase() } }),
        prisma.station.findUnique({ where: { code: toCode.trim().toUpperCase() } }),
    ]);

    if (!fromStation) throw new BadRequestError(`Station with code '${fromCode}' not found`);
    if (!toStation) throw new BadRequestError(`Station with code '${toCode}' not found`);

    const departureDate = new Date(date);
    if (isNaN(departureDate.getTime())) {
        throw new BadRequestError(`Invalid date: '${date}'`);
    }

    // 2. Query starts from Schedule — only ACTIVE schedules on this exact date
    //    Reject past dates upfront to avoid returning stale results
    //    Join train → route → stops to check both stations exist in forward order
    //    This is the narrowest starting point and avoids loading all trains
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (departureDate < today) {
        return { from: { code: fromStation.code, name: fromStation.name }, to: { code: toStation.code, name: toStation.name }, date, count: 0, trains: [] };
    }

    const schedules = await prisma.schedule.findMany({
        where: {
            departureDate,
            status: 'ACTIVE',
            train: {
                isActive: true,
                route: {
                    // Train must have fromStation in its route
                    stops: { some: { stationId: fromStation.id } }
                }
            }
        },
        include: {
            train: {
                include: {
                    route: {
                        include: {
                            stops: {
                                include: { station: true },
                                orderBy: { sequence: 'asc' }
                            }
                        }
                    },
                    fares: true
                }
            }
        }
    });

    // 3. In-memory filter: toStation must also be in the route AND after fromStation (forward direction only)
    const results = schedules
        .filter(sch => {
            const stops = sch.train.route?.stops || [];
            const fromStop = stops.find(s => s.stationId === fromStation.id);
            const toStop = stops.find(s => s.stationId === toStation.id);
            return fromStop && toStop && fromStop.sequence < toStop.sequence;
        })
        .map(sch => {
            const stops = sch.train.route?.stops || [];
            const fromStop = stops.find(s => s.stationId === fromStation.id)!;
            const toStop = stops.find(s => s.stationId === toStation.id)!;

            return {
                trainId: sch.train.id,
                trainName: sch.train.name,
                trainNumber: sch.train.trainNumber,
                scheduleId: sch.id,
                scheduleStatus: sch.status,
                departureDate: sch.departureDate,
                from: {
                    stationId: fromStation.id,
                    name: fromStation.name,
                    code: fromStation.code,
                    city: fromStation.city,
                    sequence: fromStop.sequence,
                    arrivalMinute: fromStop.arrivalMinute,
                    departureMinute: fromStop.departureMinute,
                },
                to: {
                    stationId: toStation.id,
                    name: toStation.name,
                    code: toStation.code,
                    city: toStation.city,
                    sequence: toStop.sequence,
                    arrivalMinute: toStop.arrivalMinute,
                    departureMinute: toStop.departureMinute,
                },
                fares: sch.train.fares.map(f => ({
                    fromStationId: f.fromStationId,
                    toStationId: f.toStationId,
                    coachType: f.coachType,
                    fare: Number(f.fare)
                }))
            };
        });

    return {
        from: { code: fromStation.code, name: fromStation.name },
        to: { code: toStation.code, name: toStation.name },
        date,
        count: results.length,
        trains: results
    };
};

export default { createTrain, createRoute, getTrainById, createSchedule, createFares, getAllTrains, searchTrains }


