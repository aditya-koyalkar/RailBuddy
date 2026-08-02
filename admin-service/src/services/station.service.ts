import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { CreateStationDTO } from "../types/create.station.type"
import { ConflictError } from "../utils/error"

const createStation = async ({ name, code, city, state }: CreateStationDTO) => {
    const existing = await prisma.station.findUnique({
        where: {
            code
        }
    })
    if (existing) {
        throw new ConflictError("Station code already exists")
    }

    const station = await prisma.$transaction(async (tx) => {
        const createdStation = await tx.station.create({
            data: {
                city,
                name,
                state,
                code
            }
        });

        await tx.adminOutbox.create({
            data: {
                aggregateType: "Station",
                aggregateId: createdStation.id,
                eventType: "STATION_CREATED",
                payload: createdStation as any
            }
        });

        return createdStation;
    });

    logger.info("Station created successfully with outbox record", { id: station.id, code: station.code });

    return station;
}

const getAllStations = async () => {
    return await prisma.station.findMany({
        orderBy: {
            name: 'asc'
        }
    });
}

export default { createStation, getAllStations }