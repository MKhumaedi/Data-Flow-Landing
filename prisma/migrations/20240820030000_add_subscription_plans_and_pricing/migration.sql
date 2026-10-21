-- Migration: add_subscription_plans_and_pricing
-- Add premiumExpiresAt to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "premiumExpiresAt" TIMESTAMP(3);

-- CreateTable plans
CREATE TABLE IF NOT EXISTS "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "badge" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#00685f',
    "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug");
CREATE INDEX IF NOT EXISTS "plans_order_idx" ON "plans"("order");
CREATE INDEX IF NOT EXISTS "plans_isActive_idx" ON "plans"("isActive");

-- CreateTable plan_pricings
CREATE TABLE IF NOT EXISTS "plan_pricings" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "durationLabel" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "normalPrice" DECIMAL(12,2) NOT NULL,
    "discountPrice" DECIMAL(12,2),
    "isBestValue" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plan_pricings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plan_pricings_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "plan_pricings_planId_idx" ON "plan_pricings"("planId");
CREATE INDEX IF NOT EXISTS "plan_pricings_order_idx" ON "plan_pricings"("order");
CREATE INDEX IF NOT EXISTS "plan_pricings_isActive_idx" ON "plan_pricings"("isActive");

-- CreateTable transactions
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "merchantRef" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "planId" TEXT,
    "planPricingId" TEXT,
    "planName" TEXT,
    "durationDays" INTEGER,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_reference_key" ON "transactions"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_merchantRef_key" ON "transactions"("merchantRef");
CREATE INDEX IF NOT EXISTS "transactions_userId_idx" ON "transactions"("userId");
CREATE INDEX IF NOT EXISTS "transactions_userEmail_idx" ON "transactions"("userEmail");
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions"("status");
