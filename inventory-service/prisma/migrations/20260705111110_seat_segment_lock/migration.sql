/*
  Warnings:

  - You are about to drop the `SeatInventory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SeatInventory" DROP CONSTRAINT "SeatInventory_scheduleInventoryId_fkey";

-- DropTable
DROP TABLE "SeatInventory";

-- CreateTable
CREATE TABLE "seat_inventory" (
    "id" TEXT NOT NULL,
    "scheduleInventoryId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "seatType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_segment_locks" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "fromSeq" INTEGER NOT NULL,
    "toSeq" INTEGER NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'LOCKED',
    "lockedBy" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_segment_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seat_inventory_scheduleId_seatId_idx" ON "seat_inventory"("scheduleId", "seatId");

-- CreateIndex
CREATE INDEX "seat_inventory_scheduleId_seatNumber_idx" ON "seat_inventory"("scheduleId", "seatNumber");

-- CreateIndex
CREATE INDEX "seat_inventory_lockExpiresAt_status_idx" ON "seat_inventory"("lockExpiresAt", "status");

-- CreateIndex
CREATE INDEX "seat_inventory_bookingId_idx" ON "seat_inventory"("bookingId");

-- CreateIndex
CREATE INDEX "seat_segment_locks_scheduleId_fromSeq_toSeq_idx" ON "seat_segment_locks"("scheduleId", "fromSeq", "toSeq");

-- CreateIndex
CREATE INDEX "seat_segment_locks_seatId_idx" ON "seat_segment_locks"("seatId");

-- CreateIndex
CREATE INDEX "seat_segment_locks_bookingId_idx" ON "seat_segment_locks"("bookingId");

-- CreateIndex
CREATE INDEX "schedule_inventory_trainId_idx" ON "schedule_inventory"("trainId");

-- AddForeignKey
ALTER TABLE "seat_inventory" ADD CONSTRAINT "seat_inventory_scheduleInventoryId_fkey" FOREIGN KEY ("scheduleInventoryId") REFERENCES "schedule_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
