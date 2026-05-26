import { config } from "../config/index.js"
import { logger } from "../config/logger.js"
import { prisma } from "../config/prisma.js"
import { redis } from "../config/redis.js"
import { NotFoundError } from "../utils/error.js"

const getProfile = async (userId: string) => {
    logger.info('getting user profile')
    const cache = await redis.get(`user:${userId}`)
    if (cache) {
        logger.info('Cache hit returning stored data')
        return JSON.parse(cache)
    }
    logger.info('Cache miss retriving from database')

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    })

    if (!user) {
        throw new NotFoundError("User not found")
    }
    const { password: _password, ...safeUser } = user;
    logger.info('Storing user in cache')
    await redis.set(`user:${userId}`, JSON.stringify(safeUser), 'EX', config.REDIS_DEFAULT_TTL)
    return safeUser
}

export default { getProfile }