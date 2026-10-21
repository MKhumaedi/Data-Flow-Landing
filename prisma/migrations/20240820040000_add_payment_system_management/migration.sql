-- Migration: add_payment_system_management
-- Add PaymentGatewayConfig and ManualPaymentAccount tables

-- CreateTable payment_gateway_configs
CREATE TABLE IF NOT EXISTS "payment_gateway_configs" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateway_configs_gateway_key" ON "payment_gateway_configs"("gateway");

-- CreateTable manual_payment_accounts
CREATE TABLE IF NOT EXISTS "manual_payment_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "manual_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "manual_payment_accounts_order_idx" ON "manual_payment_accounts"("order");
CREATE INDEX IF NOT EXISTS "manual_payment_accounts_isActive_idx" ON "manual_payment_accounts"("isActive");

-- Seed initial default gateway configs
INSERT INTO "payment_gateway_configs" ("id", "gateway", "isActive", "isDefault", "displayName", "updatedAt")
VALUES 
  ('pg-tripay', 'tripay', true, true, 'Tripay', NOW()),
  ('pg-midtrans', 'midtrans', false, false, 'Midtrans', NOW()),
  ('pg-manual', 'manual_transfer', false, false, 'Transfer Bank Manual', NOW())
ON CONFLICT ("gateway") DO NOTHING;
