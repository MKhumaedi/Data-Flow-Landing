import { prisma } from '../../../lib/prisma';
import { logAdminAction } from '../audit-log/audit.helper';

export interface EditableContentItem {
  id?: string;
  key: string;
  value: string;
  section: 'hero' | 'login' | 'footer' | 'general';
  label: string;
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_CONTENT_SEEDS: EditableContentItem[] = [
  {
    key: 'hero_headline',
    value: 'Satu Platform untuk Analisis Data, Belajar Rumus, dan Dokumen Kerja Anda',
    section: 'hero',
    label: 'Hero Main Headline',
    description: 'Judul utama pada bagian teratas landing page',
  },
  {
    key: 'hero_subheadline',
    value: 'Tingkatkan produktivitas kerja dengan tiga pilar terpadu: visualisasi dashboard interaktif, panduan rumus Excel gratis, dan 61 template formulir bisnis siap pakai.',
    section: 'hero',
    label: 'Hero Subheadline',
    description: 'Deskripsi pengantar di bawah judul utama',
  },
  {
    key: 'hero_cta_text',
    value: 'Mulai Gratis',
    section: 'hero',
    label: 'Hero Primary CTA Button',
    description: 'Teks pada tombol utama di hero section',
  },
  {
    key: 'announcement_banner',
    value: 'TOOLS & INSIGHT UNTUK KERJA LEBIH CERDAS',
    section: 'hero',
    label: 'Hero Announcement Badge',
    description: 'Badge notifikasi di atas judul hero',
  },
  {
    key: 'login_microcopy_1',
    value: 'Data Anda, dalam hitungan detik — Ubah spreadsheet mentah menjadi visualisasi eksekutif seketika.',
    section: 'login',
    label: 'Login Microcopy 1',
    description: 'Poin value prop animasi ke-1 di halaman login/register',
  },
  {
    key: 'login_microcopy_2',
    value: 'Tanpa rumus rumit — Algoritma cerdas otomatis mendeteksi metrik, tren, dan agregasi data.',
    section: 'login',
    label: 'Login Microcopy 2',
    description: 'Poin value prop animasi ke-2 di halaman login/register',
  },
  {
    key: 'login_microcopy_3',
    value: 'Dashboard siap dibagikan — Ekspor presentasi PDF atau bagikan tautan publik aman dengan satu klik.',
    section: 'login',
    label: 'Login Microcopy 3',
    description: 'Poin value prop animasi ke-3 di halaman login/register',
  },
  {
    key: 'footer_text',
    value: '© 2024 MayStudio Inc. Platform Visualisasi & Transformasi Data Eksekutif.',
    section: 'footer',
    label: 'Footer Copyright & Info',
    description: 'Teks hak cipta dan disclaimer di bagian bawah situs',
  },
];

class ContentService {
  private contentStore: Map<string, EditableContentItem> = new Map();
  private isInitialized = false;

  constructor() {
    // Initialize default seeds
    for (const seed of DEFAULT_CONTENT_SEEDS) {
      this.contentStore.set(seed.key, {
        ...seed,
        id: `ec-${seed.key}`,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system-seed',
      });
    }
  }

  private async ensureDatabaseSeeded(): Promise<void> {
    if (this.isInitialized) return;
    try {
      if (prisma?.editableContent?.count) {
        const count = await prisma.editableContent.count();
        if (count === 0) {
          for (const seed of DEFAULT_CONTENT_SEEDS) {
            await prisma.editableContent.create({
              data: {
                id: `ec-${seed.key}`,
                key: seed.key,
                value: seed.value,
                updatedBy: 'system-seed',
              },
            }).catch(() => null);
          }
        }
        this.isInitialized = true;
      }
    } catch {
      // Safe fallback
    }
  }

  async getAll(): Promise<EditableContentItem[]> {
    await this.ensureDatabaseSeeded();
    try {
      if (prisma?.editableContent?.findMany) {
        const dbItems = await prisma.editableContent.findMany();
        if (dbItems && dbItems.length > 0) {
          for (const item of dbItems) {
            const existing = this.contentStore.get(item.key);
            this.contentStore.set(item.key, {
              id: item.id,
              key: item.key,
              value: item.value,
              section: existing?.section || 'general',
              label: existing?.label || item.key,
              description: existing?.description,
              updatedAt: item.updatedAt?.toISOString ? item.updatedAt.toISOString() : String(item.updatedAt),
              updatedBy: item.updatedBy || 'system',
            });
          }
        }
      }
    } catch {
      // Fallback
    }

    return Array.from(this.contentStore.values());
  }

  async getPublicDictionary(): Promise<Record<string, string>> {
    const list = await this.getAll();
    const dict: Record<string, string> = {};
    for (const item of list) {
      dict[item.key] = item.value;
    }
    return dict;
  }

  async getByKey(key: string): Promise<EditableContentItem | null> {
    const all = await this.getAll();
    return all.find((item) => item.key === key) || null;
  }

  async updateBatch(
    admin: { id: string; email: string },
    items: Array<{ key: string; value: string }>
  ): Promise<EditableContentItem[]> {
    const updatedList: EditableContentItem[] = [];

    for (const item of items) {
      const current = this.contentStore.get(item.key) || {
        key: item.key,
        value: item.value,
        section: 'general',
        label: item.key,
      };

      const updatedRecord: EditableContentItem = {
        ...current,
        value: item.value,
        updatedAt: new Date().toISOString(),
        updatedBy: admin.email,
      };

      this.contentStore.set(item.key, updatedRecord);

      try {
        if (prisma?.editableContent?.upsert) {
          await prisma.editableContent.upsert({
            where: { key: item.key },
            update: { value: item.value, updatedBy: admin.email },
            create: { key: item.key, value: item.value, updatedBy: admin.email },
          });
        }
      } catch {
        // Fallback
      }

      updatedList.push(updatedRecord);
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CONTENT_UPDATED_BATCH',
      targetType: 'EDITABLE_CONTENT',
      targetId: items.map((i) => i.key).join(','),
      details: { updatedKeys: items.map((i) => i.key), count: items.length },
    });

    return updatedList;
  }
}

export const contentService = new ContentService();
