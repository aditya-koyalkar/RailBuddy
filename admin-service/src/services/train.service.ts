import { logger } from "../config/logger"
import { prisma } from "../config/prisma"
import { adminProducer } from "../kafka/producer/admin.producer"
import { CreateTrainDTO } from "../types/create.train.type"
import { BadRequestError, ConflictError } from "../utils/error"

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

export default { createTrain }
