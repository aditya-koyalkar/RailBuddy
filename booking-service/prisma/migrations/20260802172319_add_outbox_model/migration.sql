-- CreateTable
CREATE TABLE "booking_outbox" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL DEFAULT 'Booking',
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_outbox_published_createdAt_idx" ON "booking_outbox"("published", "createdAt");
