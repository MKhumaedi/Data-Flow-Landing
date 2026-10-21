export interface SiteIntegrationDto {
  gtmContainerId?: string | null;
  ga4MeasurementId?: string | null;
  gscVerificationCode?: string | null;
  customHeadScript?: string | null;
}

export interface SiteIntegrationRecord {
  id: string;
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
  gscVerificationCode: string | null;
  customHeadScript: string | null;
  updatedAt: string | Date;
  updatedBy: string | null;
}

export interface PublicSiteIntegration {
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
  gscVerificationCode: string | null;
  customHeadScript: string | null;
}
