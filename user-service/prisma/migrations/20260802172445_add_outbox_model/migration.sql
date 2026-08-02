-- CreateTable
CREATE TABLE "user_outbox" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_outbox_published_createdAt_idx" ON "user_outbox"("published", "createdAt");
