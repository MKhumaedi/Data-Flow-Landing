-- Migration: add_ad_placements_and_bookings

-- CreateEnum BookingStatus
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN 
    CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED'); 
  END IF; 
END $$;

-- CreateTable ad_placements
CREATE TABLE IF NOT EXISTS "ad_placements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "dimensions" TEXT NOT NULL,
    "pricePerWeek" DECIMAL(12,2) NOT NULL,
    "pricePerMonth" DECIMAL(12,2) NOT NULL,
    "hiddenForPremium" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ad_placements_key_key" ON "ad_placements"("key");

-- CreateTable ad_bookings
CREATE TABLE IF NOT EXISTS "ad_bookings" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "advertiserContact" TEXT,
    "type" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "scriptCode" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "pricePaid" DECIMAL(12,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ad_bookings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ad_bookings_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ad_bookings_placementId_idx" ON "ad_bookings"("placementId");
