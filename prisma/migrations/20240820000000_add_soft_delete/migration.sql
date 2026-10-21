-- Migration: add_soft_delete
-- Safe, additive migration adding nullable deletedAt column to all models

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable datasets
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable dashboard_templates
ALTER TABLE "dashboard_templates" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable dashboards
ALTER TABLE "dashboards" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable refresh_tokens
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
