import type { TemplateTheme } from '../../types/shared';
import { prisma } from '../../lib/prisma';

export const TEMPLATE_THEMES: TemplateTheme[] = [
  {
    id: 'minimal-teal',
    name: 'Minimal Teal',
    description: 'Palet modern teal & emerald dengan rasio kontras tinggi, ideal untuk laporan analitik operasional.',
    isPremium: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#00685f',
      secondary: '#006399',
      accent: '#0D9488',
      background: '#f9f9ff',
      cardBg: '#ffffff',
      textPrimary: '#141b2b',
      textSecondary: '#3d4947',
      border: '#e2e8f0',
      chartPalette: ['#00685f', '#006399', '#924628', '#008378', '#6bd8cb'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-xl',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-[#00685f]',
  },
  {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    description: 'Warna formal slate navy & royal blue untuk laporan dewan direksi dan presentasi investor.',
    isPremium: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#1e3a8a',
      secondary: '#0284c7',
      accent: '#3b82f6',
      background: '#f8fafc',
      cardBg: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      border: '#cbd5e1',
      chartPalette: ['#1e3a8a', '#0284c7', '#0369a1', '#64748b', '#94a3b8'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-lg',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-[#1e3a8a]',
  },
  {
    id: 'midnight-executive',
    name: 'Midnight Executive',
    description: 'Deep navy accent, high-density cards, sharp corners, minimal chart style untuk eksekutif c-suite.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#0f172a',
      secondary: '#334155',
      accent: '#0284c7',
      background: '#f8fafc',
      cardBg: '#ffffff',
      textPrimary: '#020617',
      textSecondary: '#475569',
      border: '#cbd5e1',
      chartPalette: ['#0f172a', '#0284c7', '#38bdf8', '#64748b', '#94a3b8'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-none',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-900',
  },
  {
    id: 'sage-analytics',
    name: 'Sage Analytics',
    description: 'Muted sage green accent, medium density, soft rounded corners, editorial chart style.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#365314',
      secondary: '#65a30d',
      accent: '#84cc16',
      background: '#f7fee7',
      cardBg: '#ffffff',
      textPrimary: '#1a2e05',
      textSecondary: '#4d7c0f',
      border: '#d9f99d',
      chartPalette: ['#4d7c0f', '#65a30d', '#a3e635', '#84cc16', '#365314'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-2xl',
    badgeBg: 'bg-lime-50',
    badgeText: 'text-lime-800',
  },
  {
    id: 'amber-insight',
    name: 'Amber Insight',
    description: 'Warm amber/gold accent, high density, minimal style untuk visualisasi finansial dan omzet ritel.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#b45309',
      secondary: '#f59e0b',
      accent: '#d97706',
      background: '#fffbeb',
      cardBg: '#ffffff',
      textPrimary: '#451a03',
      textSecondary: '#78350f',
      border: '#fde68a',
      chartPalette: ['#d97706', '#f59e0b', '#fbbf24', '#b45309', '#78350f'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-lg',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
  },
  {
    id: 'slate-professional',
    name: 'Slate Professional',
    description: 'Cool slate gray accent, low density (generous whitespace), bold chart style untuk laporan riset industri.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#1e293b',
      secondary: '#475569',
      accent: '#64748b',
      background: '#f1f5f9',
      cardBg: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      border: '#cbd5e1',
      chartPalette: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-3xl',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
  },
  {
    id: 'coral-modern',
    name: 'Coral Modern',
    description: 'Coral/terracotta accent, medium density, minimal style untuk performa e-commerce dan marketing modern.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#be123c',
      secondary: '#e11d48',
      accent: '#fb7185',
      background: '#fff1f2',
      cardBg: '#ffffff',
      textPrimary: '#4c0519',
      textSecondary: '#881337',
      border: '#fecdd3',
      chartPalette: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#9f1239'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-xl',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
  },
  {
    id: 'indigo-precision',
    name: 'Indigo Precision',
    description: 'Indigo accent, high density, editorial style dengan kontras tajam untuk analitik data saintifik.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#312e81',
      secondary: '#4338ca',
      accent: '#6366f1',
      background: '#eef2ff',
      cardBg: '#ffffff',
      textPrimary: '#1e1b4b',
      textSecondary: '#3730a3',
      border: '#c7d2fe',
      chartPalette: ['#312e81', '#4338ca', '#6366f1', '#818cf8', '#a5b4fc'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-md',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
  },
  {
    id: 'emerald-corporate',
    name: 'Emerald Corporate',
    description: 'Emerald green accent (distinct shade from free teal), low density, bold style untuk laporan ESG & korporasi.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#064e3b',
      secondary: '#047857',
      accent: '#10b981',
      background: '#ecfdf5',
      cardBg: '#ffffff',
      textPrimary: '#022c22',
      textSecondary: '#065f46',
      border: '#a7f3d0',
      chartPalette: ['#064e3b', '#047857', '#059669', '#10b981', '#34d399'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-2xl',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
  },
  {
    id: 'charcoal-minimalist',
    name: 'Charcoal Minimalist',
    description: 'Near-black charcoal accent with single color pop, high density, minimal style bergaya Swiss studio.',
    isPremium: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80',
    colors: {
      primary: '#09090b',
      secondary: '#27272a',
      accent: '#f97316',
      background: '#fafafa',
      cardBg: '#ffffff',
      textPrimary: '#09090b',
      textSecondary: '#52525b',
      border: '#e4e4e7',
      chartPalette: ['#18181b', '#3f3f46', '#71717a', '#f97316', '#a1a1aa'],
    },
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    roundedStyle: 'rounded-sm',
    badgeBg: 'bg-zinc-100',
    badgeText: 'text-zinc-900',
  },
];

class TemplateService {
  async listTemplates(): Promise<TemplateTheme[]> {
    try {
      if (prisma?.dashboardTemplate?.findMany) {
        const dbTemplates = await prisma.dashboardTemplate.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (dbTemplates && dbTemplates.length > 0) {
          return dbTemplates.map((dbT: any) => {
            const layout = typeof dbT.layoutConfig === 'string'
              ? JSON.parse(dbT.layoutConfig)
              : dbT.layoutConfig || {};
            return {
              id: dbT.id as any,
              name: dbT.name,
              description: layout.description || dbT.description || 'Tema dashboard MayStudio terverifikasi.',
              isPremium: dbT.isPremium,
              thumbnailUrl: dbT.thumbnail || TEMPLATE_THEMES[0].thumbnailUrl,
              colors: layout.colors || TEMPLATE_THEMES[0].colors,
              fontFamily: layout.fontFamily || TEMPLATE_THEMES[0].fontFamily,
              roundedStyle: layout.roundedStyle || TEMPLATE_THEMES[0].roundedStyle,
              badgeBg: layout.badgeBg || TEMPLATE_THEMES[0].badgeBg,
              badgeText: layout.badgeText || TEMPLATE_THEMES[0].badgeText,
            };
          });
        }
      }
    } catch {
      // Fallback to built-in templates
    }
    return TEMPLATE_THEMES;
  }

  async getTemplateById(id: string): Promise<TemplateTheme | null> {
    try {
      if (prisma?.dashboardTemplate?.findUnique) {
        const dbT = await prisma.dashboardTemplate.findUnique({
          where: { id },
        });
        if (dbT) {
          const layout = typeof dbT.layoutConfig === 'string'
            ? JSON.parse(dbT.layoutConfig)
            : dbT.layoutConfig || {};
          return {
            id: dbT.id as any,
            name: dbT.name,
            description: layout.description || dbT.description || 'Tema dashboard MayStudio terverifikasi.',
            isPremium: dbT.isPremium,
            thumbnailUrl: dbT.thumbnail || TEMPLATE_THEMES[0].thumbnailUrl,
            colors: layout.colors || TEMPLATE_THEMES[0].colors,
            fontFamily: layout.fontFamily || TEMPLATE_THEMES[0].fontFamily,
            roundedStyle: layout.roundedStyle || TEMPLATE_THEMES[0].roundedStyle,
            badgeBg: layout.badgeBg || TEMPLATE_THEMES[0].badgeBg,
            badgeText: layout.badgeText || TEMPLATE_THEMES[0].badgeText,
          };
        }
      }
    } catch {
      // Fallback
    }
    return TEMPLATE_THEMES.find((t) => t.id === id) || null;
  }
}

export const templateService = new TemplateService();
