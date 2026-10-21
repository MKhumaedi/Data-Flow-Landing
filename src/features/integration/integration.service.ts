import type { DataIntegration } from '../../types/shared';

const AVAILABLE_INTEGRATIONS: DataIntegration[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL Direct Connector',
    description: 'Sinkronisasi kueri langsung dari database operasional PostgreSQL dengan SSL tersertifikasi.',
    category: 'database',
    icon: 'Database',
    connected: false,
    configFields: [
      { key: 'host', label: 'Host / IP Server', type: 'text', required: true },
      { key: 'database', label: 'Nama Database', type: 'text', required: true },
      { key: 'username', label: 'User Database', type: 'text', required: true },
      { key: 'password', label: 'Kata Sandi Database', type: 'password', required: true },
    ],
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets Live Sync',
    description: 'Integrasi otomatis ke spreadsheet Google Sheets dengan pembaruan data terjadwal.',
    category: 'spreadsheet',
    icon: 'FileSpreadsheet',
    connected: false,
    configFields: [
      { key: 'sheetUrl', label: 'Tautan Google Sheet (Public/Shared)', type: 'url', required: true },
    ],
  },
  {
    id: 'snowflake',
    name: 'Snowflake Data Warehouse',
    description: 'Tarik data tabular dalam skala besar langsung dari Snowflake cloud warehouse.',
    category: 'cloud',
    icon: 'Cloud',
    connected: false,
    configFields: [
      { key: 'account', label: 'Snowflake Account Identifier', type: 'text', required: true },
      { key: 'warehouse', label: 'Warehouse Name', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce CRM Pipeline',
    description: 'Visualisasi otomatis deal pipeline, leads, dan konversi kuartalan tim sales.',
    category: 'crm',
    icon: 'TrendingUp',
    connected: false,
    configFields: [
      { key: 'instanceUrl', label: 'Salesforce Instance URL', type: 'url', required: true },
      { key: 'apiKey', label: 'Connected App Client Secret', type: 'password', required: true },
    ],
  },
];

class IntegrationService {
  private userIntegrations: Map<string, DataIntegration[]> = new Map();

  async getIntegrations(userId: string): Promise<DataIntegration[]> {
    if (!this.userIntegrations.has(userId)) {
      this.userIntegrations.set(userId, [...AVAILABLE_INTEGRATIONS]);
    }
    return this.userIntegrations.get(userId) || AVAILABLE_INTEGRATIONS;
  }

  async toggleIntegration(userId: string, integrationId: string, isConnected: boolean): Promise<DataIntegration> {
    const list = await this.getIntegrations(userId);
    const item = list.find(i => i.id === integrationId);
    if (!item) {
      throw { statusCode: 404, code: 'INTEGRATION_NOT_FOUND', message: 'Konektor integrasi tidak ditemukan.' };
    }
    item.connected = isConnected;
    item.lastSync = isConnected ? new Date().toISOString() : undefined;
    return item;
  }
}

export const integrationService = new IntegrationService();
