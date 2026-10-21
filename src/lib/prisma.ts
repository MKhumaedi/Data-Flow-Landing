/**
 * Prisma Client Singleton Instance
 * Ensures single connection pool in development & production
 */

import { PrismaClient } from '@prisma/client';
import { createSoftDeleteClient } from './softDelete';

// Placeholder class for standard typing if Prisma CLI generation is pending
export class MockPrismaClient {
  user = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'usr-mock' }),
    update: async ({ data }: any) => ({ ...data }),
    delete: async () => ({ success: true }),
  };
  dataset = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'ds-mock' }),
    update: async ({ data }: any) => ({ ...data }),
    delete: async () => ({ success: true }),
  };
  dashboard = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'dash-mock' }),
    update: async ({ data }: any) => ({ ...data }),
    delete: async () => ({ success: true }),
  };
  dashboardTemplate = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'tmpl-mock' }),
    update: async ({ data }: any) => ({ ...data }),
    delete: async () => ({ success: true }),
  };
  refreshToken = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'rt-mock' }),
    update: async ({ data }: any) => ({ ...data }),
    deleteMany: async () => ({ count: 1 }),
  };
  paymentTransaction = {
    create: async ({ data }: any) => ({ ...data, id: 'inv-mock' }),
    findMany: async () => [],
  };
  editableContent = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'ec-mock' }),
    upsert: async ({ create, update }: any) => ({ ...create, ...update }),
    update: async ({ data }: any) => ({ ...data }),
  };
  adminAuditLog = {
    create: async ({ data }: any) => ({ ...data, id: 'audit-mock', createdAt: new Date() }),
    findMany: async () => [],
    count: async () => 0,
  };
  formula = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'form-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  adSlot = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'ad-mock', updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  adPlacement = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'pl-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  adBooking = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'bk-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  aIUsageLog = {
    create: async ({ data }: any) => ({ ...data, id: 'ai-mock', createdAt: new Date() }),
    count: async () => 0,
    findMany: async () => [],
  };
  formTemplate = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'ft-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  blogPost = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'bp-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  siteIntegration = {
    findFirst: async () => null,
    findUnique: async () => null,
    create: async ({ data }: any) => ({ ...data, id: 'site-int-mock', updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    upsert: async ({ create, update }: any) => ({ ...create, ...update, id: 'site-int-mock', updatedAt: new Date() }),
  };
  globalTrialMode = {
    findFirst: async () => null,
    findUnique: async () => null,
    create: async ({ data }: any) => ({ ...data, id: 'trial-mock', updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    upsert: async ({ create, update }: any) => ({ ...create, ...update, id: 'trial-mock', updatedAt: new Date() }),
  };
  paymentGatewayConfig = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'pg-mock', updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    upsert: async ({ create, update }: any) => ({ ...create, ...update, id: 'pg-mock', updatedAt: new Date() }),
  };
  manualPaymentAccount = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'acc-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
  };
  plan = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'plan-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
  };
  planPricing = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'pricing-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
  };
  transaction = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'trx-mock', createdAt: new Date(), updatedAt: new Date() }),
    update: async ({ data }: any) => ({ ...data, updatedAt: new Date() }),
    delete: async () => ({ success: true }),
  };
  notification = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'notif-mock', createdAt: new Date() }),
    update: async ({ data }: any) => ({ ...data }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
  notificationRead = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async ({ data }: any) => ({ ...data, id: 'read-mock', readAt: new Date() }),
    upsert: async ({ create }: any) => ({ ...create, id: 'read-mock', readAt: new Date() }),
    delete: async () => ({ success: true }),
    count: async () => 0,
  };
}

const globalForPrisma = global as unknown as { prisma: any };

// Ensure cached client has current schema models (prevent stale dev cache)
const isClientUpToDate =
  globalForPrisma.prisma &&
  typeof globalForPrisma.prisma.paymentGatewayConfig !== 'undefined' &&
  typeof globalForPrisma.prisma.manualPaymentAccount !== 'undefined' &&
  typeof globalForPrisma.prisma.plan !== 'undefined' &&
  typeof globalForPrisma.prisma.transaction !== 'undefined' &&
  typeof globalForPrisma.prisma.notification !== 'undefined';

const rawPrisma =
  (isClientUpToDate ? globalForPrisma.prisma : null) ||
  new PrismaClient({
    errorFormat: 'minimal',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = rawPrisma;
}

export const prisma = createSoftDeleteClient(rawPrisma);
export default prisma;
