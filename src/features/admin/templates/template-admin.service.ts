import { prisma } from '../../../lib/prisma';
import { logAdminAction } from '../audit-log/audit.helper';

export interface TemplateLayoutConfig {
  accentColor: string;
  chartStyle: 'minimal' | 'bold' | 'editorial';
  cardDensity: 'compact' | 'normal' | 'spacious';
  fontTheme?: string;
  borderRadius?: string;
}

export interface AdminTemplateRecord {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  isPremium: boolean;
  usageCount: number;
  layoutConfig: TemplateLayoutConfig;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const INITIAL_TEMPLATES: AdminTemplateRecord[] = [
  {
    id: 'minimal-teal',
    name: 'Minimal Teal',
    description: 'Palet modern teal & emerald dengan rasio kontras tinggi, ideal untuk laporan analitik operasional.',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80',
    isPremium: false,
    usageCount: 1420,
    layoutConfig: {
      accentColor: '#00685f',
      chartStyle: 'minimal',
      cardDensity: 'normal',
      borderRadius: '12px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    description: 'Warna formal slate navy & royal blue untuk laporan dewan direksi dan presentasi investor.',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80',
    isPremium: false,
    usageCount: 890,
    layoutConfig: {
      accentColor: '#1e3a8a',
      chartStyle: 'minimal',
      cardDensity: 'compact',
      borderRadius: '8px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 50 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'midnight-executive',
    name: 'Midnight Executive',
    description: 'Deep navy accent, high-density cards, sharp corners, minimal chart style untuk eksekutif c-suite.',
    thumbnail: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 650,
    layoutConfig: {
      accentColor: '#0f172a',
      chartStyle: 'minimal',
      cardDensity: 'compact',
      borderRadius: '0px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sage-analytics',
    name: 'Sage Analytics',
    description: 'Muted sage green accent, medium density, soft rounded corners, editorial chart style.',
    thumbnail: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 420,
    layoutConfig: {
      accentColor: '#84cc16',
      chartStyle: 'editorial',
      cardDensity: 'normal',
      borderRadius: '16px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'amber-insight',
    name: 'Amber Insight',
    description: 'Warm amber/gold accent, high density, minimal style untuk visualisasi finansial dan omzet ritel.',
    thumbnail: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 510,
    layoutConfig: {
      accentColor: '#d97706',
      chartStyle: 'minimal',
      cardDensity: 'compact',
      borderRadius: '8px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slate-professional',
    name: 'Slate Professional',
    description: 'Cool slate gray accent, low density (generous whitespace), bold chart style untuk laporan riset industri.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 380,
    layoutConfig: {
      accentColor: '#64748b',
      chartStyle: 'bold',
      cardDensity: 'spacious',
      borderRadius: '24px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'coral-modern',
    name: 'Coral Modern',
    description: 'Coral/terracotta accent, medium density, minimal style untuk performa e-commerce dan marketing modern.',
    thumbnail: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 290,
    layoutConfig: {
      accentColor: '#fb7185',
      chartStyle: 'minimal',
      cardDensity: 'normal',
      borderRadius: '12px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'indigo-precision',
    name: 'Indigo Precision',
    description: 'Indigo accent, high density, editorial style dengan kontras tajam untuk analitik data saintifik.',
    thumbnail: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 340,
    layoutConfig: {
      accentColor: '#6366f1',
      chartStyle: 'editorial',
      cardDensity: 'compact',
      borderRadius: '6px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'emerald-corporate',
    name: 'Emerald Corporate',
    description: 'Emerald green accent (distinct shade from free teal), low density, bold style untuk laporan ESG & korporasi.',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 460,
    layoutConfig: {
      accentColor: '#10b981',
      chartStyle: 'bold',
      cardDensity: 'spacious',
      borderRadius: '16px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'charcoal-minimalist',
    name: 'Charcoal Minimalist',
    description: 'Near-black charcoal accent with single color pop, high density, minimal style bergaya Swiss studio.',
    thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
    isPremium: true,
    usageCount: 520,
    layoutConfig: {
      accentColor: '#f97316',
      chartStyle: 'minimal',
      cardDensity: 'compact',
      borderRadius: '2px',
    },
    deletedAt: null,
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class TemplateAdminService {
  private templates: AdminTemplateRecord[] = [...INITIAL_TEMPLATES];

  async listTemplates(includeArchived = false): Promise<AdminTemplateRecord[]> {
    try {
      if (prisma?.dashboardTemplate?.findMany) {
        const dbTemplates = await prisma.dashboardTemplate.findMany({
          where: includeArchived ? {} : { deletedAt: null },
          include: { _count: { select: { dashboards: true } } },
        });
        if (dbTemplates && dbTemplates.length > 0) {
          return dbTemplates.map((t: any) => ({
            id: t.id,
            name: t.name,
            thumbnail: t.thumbnail,
            isPremium: t.isPremium,
            usageCount: t._count?.dashboards || 0,
            layoutConfig: typeof t.layoutConfig === 'string' ? JSON.parse(t.layoutConfig) : t.layoutConfig,
            deletedAt: t.deletedAt ? (t.deletedAt.toISOString ? t.deletedAt.toISOString() : t.deletedAt) : null,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          }));
        }
      }
    } catch {
      // Fallback
    }

    return includeArchived ? this.templates : this.templates.filter((t) => !t.deletedAt);
  }

  async createTemplate(
    admin: { id: string; email: string },
    data: {
      name: string;
      description?: string;
      thumbnail?: string;
      isPremium: boolean;
      layoutConfig: TemplateLayoutConfig;
    }
  ): Promise<AdminTemplateRecord> {
    const newTemplate: AdminTemplateRecord = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name,
      description: data.description || 'Custom configured template preset',
      thumbnail:
        data.thumbnail ||
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80',
      isPremium: Boolean(data.isPremium),
      usageCount: 0,
      layoutConfig: data.layoutConfig,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (prisma?.dashboardTemplate?.create) {
        await prisma.dashboardTemplate.create({
          data: {
            id: newTemplate.id,
            name: newTemplate.name,
            thumbnail: newTemplate.thumbnail,
            isPremium: newTemplate.isPremium,
            layoutConfig: newTemplate.layoutConfig as any,
          },
        });
      }
    } catch {
      // Memory fallback
    }

    this.templates.unshift(newTemplate);

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TEMPLATE_CREATED',
      targetType: 'DASHBOARD_TEMPLATE',
      targetId: newTemplate.id,
      details: { name: newTemplate.name, isPremium: newTemplate.isPremium },
    });

    return newTemplate;
  }

  async togglePremium(
    admin: { id: string; email: string },
    templateId: string,
    isPremium: boolean
  ): Promise<AdminTemplateRecord | null> {
    const t = this.templates.find((item) => item.id === templateId);
    if (t) {
      t.isPremium = isPremium;
      t.updatedAt = new Date().toISOString();
    }

    try {
      if (prisma?.dashboardTemplate?.update) {
        await prisma.dashboardTemplate.update({
          where: { id: templateId },
          data: { isPremium },
        });
      }
    } catch {
      // Fallback
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TEMPLATE_PREMIUM_TOGGLED',
      targetType: 'DASHBOARD_TEMPLATE',
      targetId: templateId,
      details: { isPremium },
    });

    return t || null;
  }

  async archiveTemplate(
    admin: { id: string; email: string },
    templateId: string
  ): Promise<{ success: boolean; templateId: string }> {
    const t = this.templates.find((item) => item.id === templateId);
    if (t) {
      t.deletedAt = new Date().toISOString();
    }

    try {
      if (prisma?.dashboardTemplate?.update) {
        await prisma.dashboardTemplate.update({
          where: { id: templateId },
          data: { deletedAt: new Date() },
        });
      }
    } catch {
      // Fallback
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TEMPLATE_ARCHIVED',
      targetType: 'DASHBOARD_TEMPLATE',
      targetId: templateId,
      details: { archived: true },
    });

    return { success: true, templateId };
  }

  async restoreTemplate(
    admin: { id: string; email: string },
    templateId: string
  ): Promise<{ success: boolean; templateId: string }> {
    const t = this.templates.find((item) => item.id === templateId);
    if (t) {
      t.deletedAt = null;
    }

    try {
      if (prisma?.dashboardTemplate?.update) {
        await prisma.dashboardTemplate.update({
          where: { id: templateId },
          data: { deletedAt: null },
        });
      }
    } catch {
      // Fallback
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TEMPLATE_RESTORED',
      targetType: 'DASHBOARD_TEMPLATE',
      targetId: templateId,
      details: { restored: true },
    });

    return { success: true, templateId };
  }

  async updateTemplate(
    admin: { id: string; email: string },
    templateId: string,
    data: {
      name?: string;
      description?: string;
      thumbnail?: string;
      isPremium?: boolean;
      layoutConfig?: Partial<TemplateLayoutConfig>;
    }
  ): Promise<AdminTemplateRecord | null> {
    const t = this.templates.find((item) => item.id === templateId);
    if (t) {
      if (data.name !== undefined) t.name = data.name;
      if (data.description !== undefined) t.description = data.description;
      if (data.thumbnail !== undefined) t.thumbnail = data.thumbnail;
      if (data.isPremium !== undefined) t.isPremium = Boolean(data.isPremium);
      if (data.layoutConfig) {
        t.layoutConfig = {
          ...t.layoutConfig,
          ...data.layoutConfig,
        };
      }
      t.updatedAt = new Date().toISOString();
    }

    try {
      if (prisma?.dashboardTemplate?.update) {
        const existing = await prisma.dashboardTemplate.findUnique({
          where: { id: templateId },
        });

        if (existing) {
          const existingLayout = typeof existing.layoutConfig === 'string'
            ? JSON.parse(existing.layoutConfig)
            : existing.layoutConfig || {};

          const mergedLayout = {
            ...existingLayout,
            ...(data.layoutConfig || {}),
            ...(data.description ? { description: data.description } : {}),
          };

          await prisma.dashboardTemplate.update({
            where: { id: templateId },
            data: {
              ...(data.name ? { name: data.name } : {}),
              ...(data.thumbnail ? { thumbnail: data.thumbnail } : {}),
              ...(data.isPremium !== undefined ? { isPremium: data.isPremium } : {}),
              layoutConfig: mergedLayout as any,
            },
          });
        }
      }
    } catch {
      // Memory fallback
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TEMPLATE_UPDATED',
      targetType: 'DASHBOARD_TEMPLATE',
      targetId: templateId,
      details: {
        name: data.name,
        isPremium: data.isPremium,
        layoutConfig: data.layoutConfig,
      },
    });

    return t || null;
  }
}

export const templateAdminService = new TemplateAdminService();
