-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'BOOKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "schedule_inventory" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "trainNumber" TEXT NOT NULL,
    "trainName" TEXT NOT NULL,
    "departureDate" DATE NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "available" INTEGER NOT NULL,
    "locked" INTEGER NOT NULL DEFAULT 0,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatInventory" (
    "id" TEXT NOT NULL,
    "scheduleInventoryId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "SeatInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_inventory_scheduleId_key" ON "schedule_inventory"("scheduleId");

-- CreateIndex
CREATE INDEX "schedule_inventory_scheduleId_status_idx" ON "schedule_inventory"("scheduleId", "status");

-- CreateIndex
CREATE INDEX "schedule_inventory_departureDate_idx" ON "schedule_inventory"("departureDate");

-- CreateIndex
CREATE INDEX "route_stops_scheduleId_idx" ON "route_stops"("scheduleId");

-- CreateIndex
CREATE INDEX "route_stops_stationId_idx" ON "route_stops"("stationId");

-- AddForeignKey
ALTER TABLE "SeatInventory" ADD CONSTRAINT "SeatInventory_scheduleInventoryId_fkey" FOREIGN KEY ("scheduleInventoryId") REFERENCES "schedule_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
