-- CreateTable
CREATE TABLE "indempotency_records" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indempotency_records_eventKey_key" ON "indempotency_records"("eventKey");

-- CreateIndex
CREATE INDEX "indempotency_records_eventKey_idx" ON "indempotency_records"("eventKey");
