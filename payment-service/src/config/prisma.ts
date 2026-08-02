import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

const globalForPrisma = global as unknown as {
    prisma: PrismaClient | undefined;
};

if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: ["error", "warn"]
    });
}

export const prisma = globalForPrisma.prisma;
