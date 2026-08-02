-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentAuditAction" AS ENUM ('CHECKOUT_CREATED', 'WEBHOOK_RECEIVED', 'PAYMENT_VERIFIED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'REFUND_FAILED');

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "polarCheckoutId" TEXT,
    "polarOrderId" TEXT,
    "checkoutUrl" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "refundId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(10,2),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "action" "PaymentAuditAction" NOT NULL,
    "previousStatus" "PaymentOrderStatus",
    "newStatus" "PaymentOrderStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_outbox" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL DEFAULT 'PaymentOrder',
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "response" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_bookingId_key" ON "payment_orders"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_polarCheckoutId_key" ON "payment_orders"("polarCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_polarOrderId_key" ON "payment_orders"("polarOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_idempotencyKey_key" ON "payment_orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");

-- CreateIndex
CREATE INDEX "payment_orders_userId_idx" ON "payment_orders"("userId");

-- CreateIndex
CREATE INDEX "payment_audit_logs_paymentOrderId_idx" ON "payment_audit_logs"("paymentOrderId");

-- CreateIndex
CREATE INDEX "payment_audit_logs_bookingId_idx" ON "payment_audit_logs"("bookingId");

-- CreateIndex
CREATE INDEX "payment_audit_logs_action_idx" ON "payment_audit_logs"("action");

-- CreateIndex
CREATE INDEX "payment_outbox_processed_createdAt_idx" ON "payment_outbox"("processed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_eventKey_key" ON "idempotency_records"("eventKey");

-- AddForeignKey
ALTER TABLE "payment_audit_logs" ADD CONSTRAINT "payment_audit_logs_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
