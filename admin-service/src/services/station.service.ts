import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { adminProducer } from "../kafka/producer/admin.producer"
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

    const station = await prisma.station.create({
        data: {
            city,
            name,
            state,
            code
        }
    })

    logger.info("Station created successfully", { id: station.id, code: station.code })

    await adminProducer.publishStationCreated(station).catch((error) => {
        logger.error('Failed o publish station create event', { error: error.message })
    })

    return station

}

export default { createStation }