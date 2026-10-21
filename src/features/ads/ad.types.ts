export type BookingStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type InquiryStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED';

export interface AdPlacementItem {
  id: string;
  key: string;
  label: string;
  description: string | null;
  dimensions: string;
  previewImageUrl?: string | null;
  pricePerWeek: number;
  pricePerMonth: number;
  hiddenForPremium: boolean;
  isAvailable: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  bookingsCount?: number;
}

export interface AdBookingItem {
  id: string;
  placementId: string;
  placement?: AdPlacementItem;
  advertiserName: string;
  advertiserContact: string | null;
  type: 'image' | 'script';
  imageUrl: string | null;
  linkUrl: string | null;
  scriptCode: string | null;
  startDate: Date | string;
  endDate: Date | string;
  pricePaid: number;
  status: BookingStatus;
  computedStatus?: BookingStatus;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
}

export interface AdInquiryItem {
  id: string;
  placementId: string;
  placement?: AdPlacementItem;
  companyName: string;
  contactName: string;
  email: string;
  whatsapp: string;
  message: string | null;
  status: InquiryStatus;
  createdAt: Date | string;
  deletedAt?: Date | string | null;
}

export interface ActiveAdResponse {
  hasAd: boolean;
  placement: {
    key: string;
    label: string;
    dimensions: string;
    hiddenForPremium: boolean;
  } | null;
  ad: {
    id: string;
    advertiserName: string;
    type: 'image' | 'script';
    imageUrl: string | null;
    linkUrl: string | null;
    scriptCode: string | null;
    startDate: string;
    endDate: string;
  } | null;
}

export interface CreateAdPlacementDto {
  key: string;
  label: string;
  description?: string;
  dimensions: string;
  previewImageUrl?: string | null;
  pricePerWeek: number;
  pricePerMonth: number;
  hiddenForPremium?: boolean;
  isAvailable?: boolean;
}

export interface UpdateAdPlacementDto {
  label?: string;
  description?: string;
  dimensions?: string;
  previewImageUrl?: string | null;
  pricePerWeek?: number;
  pricePerMonth?: number;
  hiddenForPremium?: boolean;
  isAvailable?: boolean;
}

export interface CreateAdBookingDto {
  placementId: string;
  advertiserName: string;
  advertiserContact?: string;
  type: 'image' | 'script';
  imageUrl?: string;
  linkUrl?: string;
  scriptCode?: string;
  startDate: string;
  endDate: string;
  pricePaid?: number;
}

export interface CreateAdInquiryDto {
  placementId: string;
  companyName: string;
  contactName: string;
  email: string;
  whatsapp: string;
  message?: string;
  desiredDuration?: string;
}

export interface PublicAdInfoResponse {
  placements: AdPlacementItem[];
  totalBlogViews: number;
}
