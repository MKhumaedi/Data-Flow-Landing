import { Client } from 'pg';
import {
  AdPlacementItem,
  AdBookingItem,
  AdInquiryItem,
  InquiryStatus,
  ActiveAdResponse,
  CreateAdPlacementDto,
  UpdateAdPlacementDto,
  CreateAdBookingDto,
  CreateAdInquiryDto,
  PublicAdInfoResponse,
} from './ad.types';
import { computeBookingStatus, formatBookingWithStatus, calculateEstimatedPrice } from './ad.helper';
import { processAndStoreAdImage, processAndStorePlacementPreview, ProcessedAdImageResult } from './ad-image.helper';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { logger } from '../../lib/logger';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

const INITIAL_PLACEMENTS: AdPlacementItem[] = [
  {
    id: 'cl_placement_sidebar_right',
    key: 'formula_sidebar_right',
    label: 'Sidebar Kanan Halaman Rumus',
    description: 'Banner vertikal di sidebar kanan halaman detail & belajar rumus Excel/Sheets',
    dimensions: '300x600',
    pricePerWeek: 150000,
    pricePerMonth: 500000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
  {
    id: 'cl_placement_formula_inline',
    key: 'formula_inline',
    label: 'Banner Inline Halaman Rumus',
    description: 'Banner horizontal native antara penjelasan rumus dan tabel latihan interaktif',
    dimensions: '728x150',
    pricePerWeek: 100000,
    pricePerMonth: 350000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
  {
    id: 'cl_placement_dashboard_bottom',
    key: 'dashboard_bottom',
    label: 'Banner Bawah Dashboard User',
    description: 'Banner horizontal di bagian bawah halaman daftar dashboard pengguna',
    dimensions: '728x90',
    pricePerWeek: 75000,
    pricePerMonth: 250000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
  {
    id: 'cl_placement_blog_sidebar_right',
    key: 'blog_sidebar_right',
    label: 'Sidebar Kanan Blog',
    description: 'Banner vertikal di sidebar kanan halaman daftar artikel & baca blog',
    dimensions: '300x600',
    pricePerWeek: 150000,
    pricePerMonth: 500000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
  {
    id: 'cl_placement_blog_sidebar_left',
    key: 'blog_sidebar_left',
    label: 'Sidebar Kiri Blog',
    description: 'Banner vertikal di sidebar kiri halaman blog pada layar desktop lebar (1440px+)',
    dimensions: '300x600',
    pricePerWeek: 150000,
    pricePerMonth: 500000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
  {
    id: 'cl_placement_blog_top_banner',
    key: 'blog_top_banner',
    label: 'Banner Atas Blog',
    description: 'Banner horizontal utama di bagian atas halaman artikel blog',
    dimensions: '728x90',
    pricePerWeek: 120000,
    pricePerMonth: 400000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
  {
    id: 'cl_placement_blog_bottom_banner',
    key: 'blog_bottom_banner',
    label: 'Banner Bawah Blog',
    description: 'Banner horizontal di bagian bawah setelah konten artikel & rekomendasi',
    dimensions: '728x90',
    pricePerWeek: 90000,
    pricePerMonth: 300000,
    hiddenForPremium: true,
    isAvailable: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    deletedAt: null,
    bookingsCount: 0,
  },
];

class AdInventoryService {
  private inMemoryPlacements: AdPlacementItem[] = JSON.parse(JSON.stringify(INITIAL_PLACEMENTS));
  private inMemoryBookings: AdBookingItem[] = [];
  private inMemoryInquiries: AdInquiryItem[] = [];
  private isInitialized = false;

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async ensureTableAndSeeds(client: Client): Promise<void> {
    if (this.isInitialized) return;
    try {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN 
            CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED'); 
          END IF; 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InquiryStatus') THEN 
            CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'); 
          END IF; 
        END $$;

        CREATE TABLE IF NOT EXISTS "ad_placements" (
            "id" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "label" TEXT NOT NULL,
            "description" TEXT,
            "dimensions" TEXT NOT NULL,
            "previewImageUrl" TEXT,
            "pricePerWeek" DECIMAL(12,2) NOT NULL,
            "pricePerMonth" DECIMAL(12,2) NOT NULL,
            "hiddenForPremium" BOOLEAN NOT NULL DEFAULT true,
            "isAvailable" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
        );
        ALTER TABLE "ad_placements" ADD COLUMN IF NOT EXISTS "previewImageUrl" TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS "ad_placements_key_key" ON "ad_placements"("key");

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
            CONSTRAINT "ad_bookings_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX IF NOT EXISTS "ad_bookings_placementId_idx" ON "ad_bookings"("placementId");

        CREATE TABLE IF NOT EXISTS "ad_inquiries" (
            "id" TEXT NOT NULL,
            "placementId" TEXT NOT NULL,
            "companyName" TEXT NOT NULL,
            "contactName" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "whatsapp" TEXT NOT NULL,
            "message" TEXT,
            "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "ad_inquiries_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX IF NOT EXISTS "ad_inquiries_placementId_idx" ON "ad_inquiries"("placementId");
        CREATE INDEX IF NOT EXISTS "ad_inquiries_status_idx" ON "ad_inquiries"("status");
      `);

      for (const p of INITIAL_PLACEMENTS) {
        await client.query(
          `INSERT INTO "ad_placements" ("id", "key", "label", "description", "dimensions", "pricePerWeek", "pricePerMonth", "hiddenForPremium", "isAvailable", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           ON CONFLICT ("key") DO UPDATE SET
             "label" = EXCLUDED."label",
             "description" = EXCLUDED."description",
             "dimensions" = EXCLUDED."dimensions",
             "pricePerWeek" = EXCLUDED."pricePerWeek",
             "pricePerMonth" = EXCLUDED."pricePerMonth",
             "hiddenForPremium" = EXCLUDED."hiddenForPremium",
             "isAvailable" = EXCLUDED."isAvailable",
             "updatedAt" = NOW()`,
          [p.id, p.key, p.label, p.description, p.dimensions, p.pricePerWeek, p.pricePerMonth, p.hiddenForPremium, p.isAvailable]
        );
      }
      this.isInitialized = true;
    } catch (err: any) {
      logger.warn(`[AdService] ensureTableAndSeeds error: ${err.message}`);
    }
  }

  async getActiveBookingByPlacementKey(placementKey: string): Promise<ActiveAdResponse> {
    const client = this.getPgClient();
    if (!client) {
      const p = this.inMemoryPlacements.find((x) => x.key === placementKey && !x.deletedAt && x.isAvailable);
      if (!p) return { hasAd: false, placement: null, ad: null };
      const now = new Date();
      const b = this.inMemoryBookings.find(
        (x) => x.placementId === p.id && x.status !== 'CANCELLED' && !x.deletedAt &&
          new Date(x.startDate) <= now && new Date(x.endDate) >= now
      );
      if (!b) {
        return {
          hasAd: false,
          placement: { key: p.key, label: p.label, dimensions: p.dimensions, hiddenForPremium: p.hiddenForPremium },
          ad: null,
        };
      }
      return {
        hasAd: true,
        placement: { key: p.key, label: p.label, dimensions: p.dimensions, hiddenForPremium: p.hiddenForPremium },
        ad: {
          id: b.id,
          advertiserName: b.advertiserName,
          type: b.type,
          imageUrl: b.imageUrl,
          linkUrl: b.linkUrl,
          scriptCode: b.scriptCode,
          startDate: typeof b.startDate === 'string' ? b.startDate : new Date(b.startDate).toISOString(),
          endDate: typeof b.endDate === 'string' ? b.endDate : new Date(b.endDate).toISOString(),
        },
      };
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const placeRes = await client.query(
        `SELECT * FROM "ad_placements" WHERE "key" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [placementKey]
      );
      if (placeRes.rows.length === 0 || !placeRes.rows[0].isAvailable) {
        return { hasAd: false, placement: null, ad: null };
      }

      const p = placeRes.rows[0];
      const bookRes = await client.query(
        `SELECT * FROM "ad_bookings" 
         WHERE "placementId" = $1 AND "status" != 'CANCELLED' AND "deletedAt" IS NULL
           AND "startDate" <= NOW() AND "endDate" >= NOW()
         ORDER BY "createdAt" DESC LIMIT 1`,
        [p.id]
      );

      if (bookRes.rows.length === 0) {
        return {
          hasAd: false,
          placement: { key: p.key, label: p.label, dimensions: p.dimensions, hiddenForPremium: p.hiddenForPremium },
          ad: null,
        };
      }

      const b = bookRes.rows[0];
      return {
        hasAd: true,
        placement: { key: p.key, label: p.label, dimensions: p.dimensions, hiddenForPremium: p.hiddenForPremium },
        ad: {
          id: b.id,
          advertiserName: b.advertiserName,
          type: b.type,
          imageUrl: b.imageUrl,
          linkUrl: b.linkUrl,
          scriptCode: b.scriptCode,
          startDate: b.startDate.toISOString(),
          endDate: b.endDate.toISOString(),
        },
      };
    } catch (err: any) {
      markDatabaseOffline(err);
      return { hasAd: false, placement: null, ad: null };
    } finally {
      await client.end().catch(() => null);
    }
  }

  async listPlacements(): Promise<AdPlacementItem[]> {
    const client = this.getPgClient();
    if (!client) {
      return this.inMemoryPlacements.filter((p) => !p.deletedAt);
    }
    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const res = await client.query(
        `SELECT p.*, COUNT(b.id)::int as "bookingsCount"
         FROM "ad_placements" p
         LEFT JOIN "ad_bookings" b ON b."placementId" = p."id" AND b."deletedAt" IS NULL
         WHERE p."deletedAt" IS NULL
         GROUP BY p."id"
         ORDER BY p."createdAt" ASC`
      );
      return res.rows.map((r) => ({
        ...r,
        pricePerWeek: Number(r.pricePerWeek),
        pricePerMonth: Number(r.pricePerMonth),
      }));
    } catch (err: any) {
      logger.warn(`[AdService] listPlacements error: ${err.message}`);
      return this.inMemoryPlacements.filter((p) => !p.deletedAt);
    } finally {
      await client.end();
    }
  }

  async createPlacement(dto: CreateAdPlacementDto, admin: { id: string; email: string }): Promise<AdPlacementItem> {
    const client = this.getPgClient();
    const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanKey = dto.key.trim().toLowerCase().replace(/\s+/g, '_');

    if (!client) {
      const newPlacement: AdPlacementItem = {
        id,
        key: cleanKey,
        label: dto.label,
        description: dto.description || null,
        dimensions: dto.dimensions,
        pricePerWeek: dto.pricePerWeek,
        pricePerMonth: dto.pricePerMonth,
        hiddenForPremium: dto.hiddenForPremium ?? true,
        isAvailable: dto.isAvailable ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        bookingsCount: 0,
      };
      this.inMemoryPlacements.push(newPlacement);
      return newPlacement;
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const res = await client.query(
        `INSERT INTO "ad_placements" ("id", "key", "label", "description", "dimensions", "pricePerWeek", "pricePerMonth", "hiddenForPremium", "isAvailable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          id,
          cleanKey,
          dto.label,
          dto.description || null,
          dto.dimensions,
          dto.pricePerWeek,
          dto.pricePerMonth,
          dto.hiddenForPremium ?? true,
          dto.isAvailable ?? true,
        ]
      );
      const row = res.rows[0];
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'CREATE_AD_PLACEMENT',
        targetType: 'AD_PLACEMENT',
        targetId: row.id,
        details: { key: row.key, label: row.label },
      });
      return { ...row, pricePerWeek: Number(row.pricePerWeek), pricePerMonth: Number(row.pricePerMonth) };
    } finally {
      await client.end();
    }
  }

  async updatePlacement(id: string, dto: UpdateAdPlacementDto, admin: { id: string; email: string }): Promise<AdPlacementItem> {
    const client = this.getPgClient();
    if (!client) {
      const idx = this.inMemoryPlacements.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error('Placement not found');
      this.inMemoryPlacements[idx] = {
        ...this.inMemoryPlacements[idx],
        ...dto,
        updatedAt: new Date().toISOString(),
      };
      return this.inMemoryPlacements[idx];
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const updates: string[] = ['"updatedAt" = NOW()'];
      const values: any[] = [];
      let idx = 1;

      if (dto.label !== undefined) { updates.push(`"label" = $${idx++}`); values.push(dto.label); }
      if (dto.description !== undefined) { updates.push(`"description" = $${idx++}`); values.push(dto.description); }
      if (dto.dimensions !== undefined) { updates.push(`"dimensions" = $${idx++}`); values.push(dto.dimensions); }
      if (dto.pricePerWeek !== undefined) { updates.push(`"pricePerWeek" = $${idx++}`); values.push(dto.pricePerWeek); }
      if (dto.pricePerMonth !== undefined) { updates.push(`"pricePerMonth" = $${idx++}`); values.push(dto.pricePerMonth); }
      if (dto.previewImageUrl !== undefined) { updates.push(`"previewImageUrl" = $${idx++}`); values.push(dto.previewImageUrl); }
      if (dto.hiddenForPremium !== undefined) { updates.push(`"hiddenForPremium" = $${idx++}`); values.push(dto.hiddenForPremium); }
      if (dto.isAvailable !== undefined) { updates.push(`"isAvailable" = $${idx++}`); values.push(dto.isAvailable); }

      values.push(id);
      const res = await client.query(
        `UPDATE "ad_placements" SET ${updates.join(', ')} WHERE "id" = $${idx} AND "deletedAt" IS NULL RETURNING *`,
        values
      );
      if (res.rows.length === 0) throw new Error('Placement not found');
      const row = res.rows[0];
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'UPDATE_AD_PLACEMENT',
        targetType: 'AD_PLACEMENT',
        targetId: row.id,
        details: dto,
      });
      return { ...row, pricePerWeek: Number(row.pricePerWeek), pricePerMonth: Number(row.pricePerMonth) };
    } finally {
      await client.end();
    }
  }

  async uploadPlacementPreviewImage(
    placementId: string,
    buffer: Buffer,
    admin: { id: string; email: string }
  ): Promise<AdPlacementItem> {
    const client = this.getPgClient();
    let placementKey = 'general';

    if (!client) {
      const idx = this.inMemoryPlacements.findIndex((p) => p.id === placementId);
      if (idx === -1) throw new Error('Placement not found');
      placementKey = this.inMemoryPlacements[idx].key;
      const processed = await processAndStorePlacementPreview(buffer, placementKey);
      this.inMemoryPlacements[idx].previewImageUrl = processed.publicUrl;
      this.inMemoryPlacements[idx].updatedAt = new Date().toISOString();
      return this.inMemoryPlacements[idx];
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);

      const findRes = await client.query(
        `SELECT * FROM "ad_placements" WHERE "id" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [placementId]
      );
      if (findRes.rows.length === 0) throw new Error('Placement not found');
      placementKey = findRes.rows[0].key;

      const processed = await processAndStorePlacementPreview(buffer, placementKey);

      const updateRes = await client.query(
        `UPDATE "ad_placements" 
         SET "previewImageUrl" = $1, "updatedAt" = NOW() 
         WHERE "id" = $2 AND "deletedAt" IS NULL 
         RETURNING *`,
        [processed.publicUrl, placementId]
      );

      const row = updateRes.rows[0];
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'GENERATE_PLACEMENT_PREVIEW' as any,
        targetType: 'AD_PLACEMENT',
        targetId: placementId,
        details: { key: placementKey, previewImageUrl: processed.publicUrl },
      });

      return { ...row, pricePerWeek: Number(row.pricePerWeek), pricePerMonth: Number(row.pricePerMonth) };
    } finally {
      await client.end();
    }
  }

  async listBookings(): Promise<AdBookingItem[]> {
    const client = this.getPgClient();
    if (!client) {
      return this.inMemoryBookings.filter((b) => !b.deletedAt);
    }
    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const res = await client.query(
        `SELECT b.*, p."key" as "placementKey", p."label" as "placementLabel", p."dimensions" as "placementDimensions"
         FROM "ad_bookings" b
         JOIN "ad_placements" p ON p."id" = b."placementId"
         WHERE b."deletedAt" IS NULL
         ORDER BY b."createdAt" DESC`
      );
      return res.rows.map((r) => {
        const item = formatBookingWithStatus(r);
        item.placement = {
          id: r.placementId,
          key: r.placementKey,
          label: r.placementLabel,
          dimensions: r.placementDimensions,
          description: null,
          pricePerWeek: 0,
          pricePerMonth: 0,
          hiddenForPremium: true,
          isAvailable: true,
        };
        return item;
      });
    } finally {
      await client.end();
    }
  }

  async createBooking(dto: CreateAdBookingDto, admin: { id: string; email: string }): Promise<AdBookingItem> {
    const client = this.getPgClient();
    const id = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const initialStatus = computeBookingStatus({
      status: 'SCHEDULED',
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    if (!client) {
      const p = this.inMemoryPlacements.find((x) => x.id === dto.placementId);
      if (!p) throw new Error('Placement not found');
      const pricePaid = dto.pricePaid !== undefined && dto.pricePaid !== null
        ? Number(dto.pricePaid)
        : calculateEstimatedPrice(dto.startDate, dto.endDate, Number(p.pricePerWeek), Number(p.pricePerMonth));

      const newBooking: AdBookingItem = {
        id,
        placementId: dto.placementId,
        advertiserName: dto.advertiserName,
        advertiserContact: dto.advertiserContact || null,
        type: dto.type,
        imageUrl: dto.imageUrl || null,
        linkUrl: dto.linkUrl || null,
        scriptCode: dto.scriptCode || null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        pricePaid,
        status: initialStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        placement: p,
      };
      this.inMemoryBookings.push(newBooking);
      return newBooking;
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const placeRes = await client.query(`SELECT * FROM "ad_placements" WHERE "id" = $1 AND "deletedAt" IS NULL`, [dto.placementId]);
      if (placeRes.rows.length === 0) throw new Error('Placement not found');
      const p = placeRes.rows[0];

      const pricePaid = dto.pricePaid !== undefined && dto.pricePaid !== null
        ? Number(dto.pricePaid)
        : calculateEstimatedPrice(dto.startDate, dto.endDate, Number(p.pricePerWeek), Number(p.pricePerMonth));

      const res = await client.query(
        `INSERT INTO "ad_bookings" ("id", "placementId", "advertiserName", "advertiserContact", "type", "imageUrl", "linkUrl", "scriptCode", "startDate", "endDate", "pricePaid", "status", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING *`,
        [
          id,
          dto.placementId,
          dto.advertiserName,
          dto.advertiserContact || null,
          dto.type,
          dto.imageUrl || null,
          dto.linkUrl || null,
          dto.scriptCode || null,
          new Date(dto.startDate),
          new Date(dto.endDate),
          pricePaid,
          initialStatus,
        ]
      );
      const row = res.rows[0];
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'CREATE_AD_BOOKING',
        targetType: 'AD_BOOKING',
        targetId: row.id,
        details: {
          advertiser: row.advertiserName,
          placement: p.key,
          contentType: row.type,
          pricePaid,
        },
      });
      return formatBookingWithStatus(row);
    } finally {
      await client.end();
    }
  }

  async uploadBookingImage(
    buffer: Buffer,
    placementKey: string,
    dimensions?: string | null
  ): Promise<ProcessedAdImageResult> {
    return processAndStoreAdImage(buffer, placementKey, dimensions);
  }

  async cancelBooking(id: string, admin: { id: string; email: string }): Promise<AdBookingItem> {
    const client = this.getPgClient();
    if (!client) {
      const idx = this.inMemoryBookings.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error('Booking not found');
      this.inMemoryBookings[idx] = {
        ...this.inMemoryBookings[idx],
        status: 'CANCELLED',
        updatedAt: new Date().toISOString(),
      };
      return this.inMemoryBookings[idx];
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const res = await client.query(
        `UPDATE "ad_bookings" SET "status" = 'CANCELLED', "updatedAt" = NOW()
         WHERE "id" = $1 AND "deletedAt" IS NULL
         RETURNING *`,
        [id]
      );
      if (res.rows.length === 0) throw new Error('Booking not found');
      const row = res.rows[0];
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'CANCEL_AD_BOOKING',
        targetType: 'AD_BOOKING',
        targetId: row.id,
        details: { advertiser: row.advertiserName },
      });
      return formatBookingWithStatus(row);
    } finally {
      await client.end();
    }
  }

  async createInquiry(dto: CreateAdInquiryDto): Promise<AdInquiryItem> {
    const client = this.getPgClient();
    const id = `inq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullMessage = dto.desiredDuration
      ? `[Durasi yang diminati: ${dto.desiredDuration}]\n${dto.message || ''}`.trim()
      : (dto.message || null);

    if (!client) {
      const p = this.inMemoryPlacements.find((x) => x.id === dto.placementId);
      const newInq: AdInquiryItem = {
        id,
        placementId: dto.placementId,
        placement: p,
        companyName: dto.companyName,
        contactName: dto.contactName,
        email: dto.email,
        whatsapp: dto.whatsapp,
        message: fullMessage,
        status: 'NEW',
        createdAt: new Date().toISOString(),
        deletedAt: null,
      };
      this.inMemoryInquiries.unshift(newInq);
      return newInq;
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const placeRes = await client.query(
        `SELECT * FROM "ad_placements" WHERE "id" = $1 AND "deletedAt" IS NULL`,
        [dto.placementId]
      );
      const p = placeRes.rows[0];

      const res = await client.query(
        `INSERT INTO "ad_inquiries" ("id", "placementId", "companyName", "contactName", "email", "whatsapp", "message", "status", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', NOW())
         RETURNING *`,
        [
          id,
          dto.placementId,
          dto.companyName.trim(),
          dto.contactName.trim(),
          dto.email.trim(),
          dto.whatsapp.trim(),
          fullMessage,
        ]
      );
      const row = res.rows[0];
      return {
        ...row,
        placement: p ? {
          ...p,
          pricePerWeek: Number(p.pricePerWeek),
          pricePerMonth: Number(p.pricePerMonth),
        } : undefined,
      };
    } finally {
      await client.end();
    }
  }

  async listInquiries(): Promise<AdInquiryItem[]> {
    const client = this.getPgClient();
    if (!client) {
      return this.inMemoryInquiries.filter((i) => !i.deletedAt);
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const res = await client.query(
        `SELECT i.*, 
                p."key" as "placementKey", 
                p."label" as "placementLabel", 
                p."dimensions" as "placementDimensions",
                p."pricePerWeek" as "placementPricePerWeek",
                p."pricePerMonth" as "placementPricePerMonth"
         FROM "ad_inquiries" i
         LEFT JOIN "ad_placements" p ON p."id" = i."placementId"
         WHERE i."deletedAt" IS NULL
         ORDER BY i."createdAt" DESC`
      );
      return res.rows.map((r) => ({
        id: r.id,
        placementId: r.placementId,
        companyName: r.companyName,
        contactName: r.contactName,
        email: r.email,
        whatsapp: r.whatsapp,
        message: r.message,
        status: r.status as InquiryStatus,
        createdAt: r.createdAt,
        deletedAt: r.deletedAt,
        placement: r.placementKey ? {
          id: r.placementId,
          key: r.placementKey,
          label: r.placementLabel,
          dimensions: r.placementDimensions,
          description: null,
          pricePerWeek: Number(r.placementPricePerWeek || 0),
          pricePerMonth: Number(r.placementPricePerMonth || 0),
          hiddenForPremium: true,
          isAvailable: true,
        } : undefined,
      }));
    } finally {
      await client.end();
    }
  }

  async updateInquiryStatus(
    id: string,
    status: InquiryStatus,
    admin?: { id: string; email: string }
  ): Promise<AdInquiryItem> {
    const client = this.getPgClient();
    if (!client) {
      const idx = this.inMemoryInquiries.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error('Inquiry not found');
      this.inMemoryInquiries[idx].status = status;
      return this.inMemoryInquiries[idx];
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const res = await client.query(
        `UPDATE "ad_inquiries" SET "status" = $1 WHERE "id" = $2 AND "deletedAt" IS NULL RETURNING *`,
        [status, id]
      );
      if (res.rows.length === 0) throw new Error('Inquiry not found');
      const row = res.rows[0];

      if (admin) {
        await logAdminAction({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'UPDATE_AD_INQUIRY_STATUS' as any,
          targetType: 'AD_INQUIRY' as any,
          targetId: row.id,
          details: { companyName: row.companyName, newStatus: status },
        });
      }

      return row;
    } finally {
      await client.end();
    }
  }

  async getPublicAdInfo(): Promise<PublicAdInfoResponse> {
    const client = this.getPgClient();
    if (!client) {
      const available = this.inMemoryPlacements.filter((p) => !p.deletedAt && p.isAvailable);
      return { placements: available, totalBlogViews: 23658 };
    }

    try {
      await client.connect();
      await this.ensureTableAndSeeds(client);
      const placeRes = await client.query(
        `SELECT * FROM "ad_placements" WHERE "deletedAt" IS NULL AND "isAvailable" = true ORDER BY "createdAt" ASC`
      );
      const blogStatsRes = await client.query(
        `SELECT COALESCE(SUM("viewCount"), 0)::int as total_views FROM "blog_posts" WHERE "deletedAt" IS NULL`
      );

      const totalBlogViews = blogStatsRes.rows[0]?.total_views || 0;
      const placements = placeRes.rows.map((r) => ({
        ...r,
        pricePerWeek: Number(r.pricePerWeek),
        pricePerMonth: Number(r.pricePerMonth),
      }));

      return { placements, totalBlogViews };
    } catch (err: any) {
      logger.warn(`[AdService] getPublicAdInfo error: ${err.message}`);
      return {
        placements: this.inMemoryPlacements.filter((p) => !p.deletedAt && p.isAvailable),
        totalBlogViews: 23658,
      };
    } finally {
      await client.end();
    }
  }
}

export const adInventoryService = new AdInventoryService();
