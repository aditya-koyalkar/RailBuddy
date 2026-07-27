-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('LOCKED', 'BOOKED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "response" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_inventory" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "departureDate" DATE NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "InventoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_inventory" (
    "id" TEXT NOT NULL,
    "scheduleInventoryId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "coachNumber" TEXT NOT NULL,
    "coachType" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "seatLabel" TEXT NOT NULL,
    "seatType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "arrivalDay" INTEGER,
    "departureDay" INTEGER,
    "arrivalMinute" INTEGER,
    "departureMinute" INTEGER,

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_segment_reservations" (
    "id" TEXT NOT NULL,
    "scheduleInventoryId" TEXT NOT NULL,
    "seatInventoryId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "fromStationId" TEXT NOT NULL,
    "toStationId" TEXT NOT NULL,
    "fromSequence" INTEGER NOT NULL,
    "toSequence" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_segment_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_outbox" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_eventKey_key" ON "idempotency_records"("eventKey");

-- CreateIndex
CREATE INDEX "idempotency_records_eventKey_idx" ON "idempotency_records"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_inventory_scheduleId_key" ON "schedule_inventory"("scheduleId");

-- CreateIndex
CREATE INDEX "schedule_inventory_trainId_idx" ON "schedule_inventory"("trainId");

-- CreateIndex
CREATE INDEX "schedule_inventory_departureDate_idx" ON "schedule_inventory"("departureDate");

-- CreateIndex
CREATE INDEX "seat_inventory_scheduleId_idx" ON "seat_inventory"("scheduleId");

-- CreateIndex
CREATE INDEX "seat_inventory_coachNumber_idx" ON "seat_inventory"("coachNumber");

-- CreateIndex
CREATE INDEX "seat_inventory_coachType_idx" ON "seat_inventory"("coachType");

-- CreateIndex
CREATE UNIQUE INDEX "seat_inventory_scheduleId_seatId_key" ON "seat_inventory"("scheduleId", "seatId");

-- CreateIndex
CREATE INDEX "route_stops_scheduleId_idx" ON "route_stops"("scheduleId");

-- CreateIndex
CREATE INDEX "route_stops_stationId_idx" ON "route_stops"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "route_stops_scheduleId_sequence_key" ON "route_stops"("scheduleId", "sequence");

-- CreateIndex
CREATE INDEX "seat_segment_reservations_scheduleId_seatId_idx" ON "seat_segment_reservations"("scheduleId", "seatId");

-- CreateIndex
CREATE INDEX "seat_segment_reservations_scheduleId_status_idx" ON "seat_segment_reservations"("scheduleId", "status");

-- CreateIndex
CREATE INDEX "seat_segment_reservations_bookingId_idx" ON "seat_segment_reservations"("bookingId");

-- CreateIndex
CREATE INDEX "seat_segment_reservations_expiresAt_status_idx" ON "seat_segment_reservations"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "seat_segment_reservations_scheduleId_fromSequence_toSequenc_idx" ON "seat_segment_reservations"("scheduleId", "fromSequence", "toSequence");

-- CreateIndex
CREATE INDEX "inventory_outbox_published_idx" ON "inventory_outbox"("published");

-- CreateIndex
CREATE INDEX "inventory_outbox_aggregateType_aggregateId_idx" ON "inventory_outbox"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "seat_inventory" ADD CONSTRAINT "seat_inventory_scheduleInventoryId_fkey" FOREIGN KEY ("scheduleInventoryId") REFERENCES "schedule_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_segment_reservations" ADD CONSTRAINT "seat_segment_reservations_scheduleInventoryId_fkey" FOREIGN KEY ("scheduleInventoryId") REFERENCES "schedule_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_segment_reservations" ADD CONSTRAINT "seat_segment_reservations_seatInventoryId_fkey" FOREIGN KEY ("seatInventoryId") REFERENCES "seat_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
