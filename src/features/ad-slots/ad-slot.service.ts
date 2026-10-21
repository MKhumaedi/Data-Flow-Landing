import { Client } from 'pg';
import { AdSlotItem, CreateAdSlotDto, UpdateAdSlotDto } from './ad-slot.types';
import { logger } from '../../lib/logger';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

const DEFAULT_AD_SLOTS: AdSlotItem[] = [
  {
    id: 'ad-slot-formula-sidebar-1',
    placement: 'formula_page_sidebar_right',
    type: 'image',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
    linkUrl: 'https://maystudio.app',
    scriptCode: null,
    isActive: true,
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    updatedBy: 'admin@maystudio.app',
    deletedAt: null,
  },
];

class AdSlotService {
  private inMemoryStore: AdSlotItem[] = [...DEFAULT_AD_SLOTS];
  private isInitialized = false;

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async ensureSeeded(client: Client): Promise<void> {
    if (this.isInitialized) return;
    try {
      const countRes = await client.query('SELECT COUNT(*) FROM "ad_slots" WHERE "deletedAt" IS NULL');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        for (const item of DEFAULT_AD_SLOTS) {
          await client.query(
            `INSERT INTO "ad_slots" ("id", "placement", "type", "imageUrl", "linkUrl", "scriptCode", "isActive", "updatedAt", "updatedBy")
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
             ON CONFLICT ("id") DO NOTHING`,
            [item.id, item.placement, item.type, item.imageUrl, item.linkUrl, item.scriptCode, item.isActive, item.updatedBy]
          );
        }
      }
      this.isInitialized = true;
    } catch (e: any) {
      logger.warn(`[AdSlotService] ensureSeeded check: ${e.message}`);
    }
  }

  async getActiveByPlacement(placement: string): Promise<AdSlotItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const res = await client.query(
          `SELECT * FROM "ad_slots" WHERE "placement" = $1 AND "isActive" = true AND "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 1`,
          [placement]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    return this.inMemoryStore.find((a) => a.placement === placement && a.isActive && !a.deletedAt) || null;
  }

  async listAllAdmin(includeDeleted = false): Promise<AdSlotItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const query = includeDeleted
          ? `SELECT * FROM "ad_slots" ORDER BY "updatedAt" DESC`
          : `SELECT * FROM "ad_slots" WHERE "deletedAt" IS NULL ORDER BY "updatedAt" DESC`;
        const res = await client.query(query);
        return res.rows;
      } catch (err: any) {
        logger.warn(`[AdSlotService] listAllAdmin fallback: ${err.message}`);
      } finally {
        await client.end();
      }
    }
    return includeDeleted ? [...this.inMemoryStore] : this.inMemoryStore.filter((a) => !a.deletedAt);
  }

  async create(dto: CreateAdSlotDto, updatedBy: string): Promise<AdSlotItem> {
    const id = `ad-${Date.now()}`;
    const isActive = dto.isActive ?? true;
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `INSERT INTO "ad_slots" ("id", "placement", "type", "imageUrl", "linkUrl", "scriptCode", "isActive", "updatedAt", "updatedBy")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
           RETURNING *`,
          [id, dto.placement, dto.type, dto.imageUrl || null, dto.linkUrl || null, dto.scriptCode || null, isActive, updatedBy]
        );
        return res.rows[0];
      } catch (err: any) {
        logger.warn(`[AdSlotService] create db fallback: ${err.message}`);
      } finally {
        await client.end();
      }
    }
    const item: AdSlotItem = {
      id,
      placement: dto.placement,
      type: dto.type,
      imageUrl: dto.imageUrl || null,
      linkUrl: dto.linkUrl || null,
      scriptCode: dto.scriptCode || null,
      isActive,
      updatedAt: new Date(),
      updatedBy,
    };
    this.inMemoryStore.unshift(item);
    return item;
  }

  async update(id: string, dto: UpdateAdSlotDto, updatedBy: string): Promise<AdSlotItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const updates: string[] = ['"updatedAt" = NOW()', '"updatedBy" = $1'];
        const values: any[] = [updatedBy];
        let p = 2;

        if (dto.placement !== undefined) { updates.push(`"placement" = $${p++}`); values.push(dto.placement); }
        if (dto.type !== undefined) { updates.push(`"type" = $${p++}`); values.push(dto.type); }
        if (dto.imageUrl !== undefined) { updates.push(`"imageUrl" = $${p++}`); values.push(dto.imageUrl); }
        if (dto.linkUrl !== undefined) { updates.push(`"linkUrl" = $${p++}`); values.push(dto.linkUrl); }
        if (dto.scriptCode !== undefined) { updates.push(`"scriptCode" = $${p++}`); values.push(dto.scriptCode); }
        if (dto.isActive !== undefined) { updates.push(`"isActive" = $${p++}`); values.push(dto.isActive); }

        values.push(id);
        const res = await client.query(
          `UPDATE "ad_slots" SET ${updates.join(', ')} WHERE "id" = $${p} RETURNING *`,
          values
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err: any) {
        logger.warn(`[AdSlotService] update db fallback: ${err.message}`);
      } finally {
        await client.end();
      }
    }
    const idx = this.inMemoryStore.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.inMemoryStore[idx] = { ...this.inMemoryStore[idx], ...dto, updatedAt: new Date(), updatedBy };
    return this.inMemoryStore[idx];
  }

  async softDelete(id: string, updatedBy: string): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`UPDATE "ad_slots" SET "deletedAt" = NOW(), "updatedBy" = $2 WHERE "id" = $1`, [id, updatedBy]);
        return true;
      } catch (err: any) {
        logger.warn(`[AdSlotService] softDelete db fallback: ${err.message}`);
      } finally {
        await client.end();
      }
    }
    const idx = this.inMemoryStore.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.inMemoryStore[idx].deletedAt = new Date();
      this.inMemoryStore[idx].updatedBy = updatedBy;
      return true;
    }
    return false;
  }

  async restore(id: string, updatedBy: string): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`UPDATE "ad_slots" SET "deletedAt" = NULL, "updatedBy" = $2 WHERE "id" = $1`, [id, updatedBy]);
        return true;
      } catch (err: any) {
        logger.warn(`[AdSlotService] restore db fallback: ${err.message}`);
      } finally {
        await client.end();
      }
    }
    const idx = this.inMemoryStore.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.inMemoryStore[idx].deletedAt = null;
      this.inMemoryStore[idx].updatedBy = updatedBy;
      return true;
    }
    return false;
  }
}

export const adSlotService = new AdSlotService();
