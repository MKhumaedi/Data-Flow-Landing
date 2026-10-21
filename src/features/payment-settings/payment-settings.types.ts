export interface PaymentGatewayConfigItem {
  id: string;
  gateway: string;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  isIntegrated: boolean;
  integrationNote?: string;
  envStatus: Record<string, boolean>;
  hasMissingEnv: boolean;
  lastTestedAt?: string | null;
  lastTestResult?: 'SUCCESS' | 'FAILED' | null;
  lastTestMessage?: string | null;
  detectedServerIp?: string | null;
  tripayMode?: 'sandbox' | 'production';
  merchantCode?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface TestConnectionResponse {
  success: boolean;
  gateway: string;
  testedAt: string;
  message: string;
}

export interface ManualPaymentAccountItem {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManualAccountDTO {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdateManualAccountDTO {
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdateGatewayConfigDTO {
  isActive: boolean;
  isDefault?: boolean;
}

export interface PublicPaymentOptions {
  defaultGateway?: string;
  gateways: Array<{
    gateway: string;
    displayName: string;
    isDefault: boolean;
  }>;
  manualTransfer: {
    isActive: boolean;
    accounts: Array<{
      id: string;
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    }>;
  };
}
