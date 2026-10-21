export type AdSlotType = 'image' | 'script_embed';

export interface AdSlotItem {
  id: string;
  placement: string;
  type: AdSlotType;
  imageUrl?: string | null;
  linkUrl?: string | null;
  scriptCode?: string | null;
  isActive: boolean;
  updatedAt: Date | string;
  updatedBy?: string | null;
  deletedAt?: Date | string | null;
}

export interface CreateAdSlotDto {
  placement: string;
  type: AdSlotType;
  imageUrl?: string | null;
  linkUrl?: string | null;
  scriptCode?: string | null;
  isActive?: boolean;
}

export interface UpdateAdSlotDto extends Partial<CreateAdSlotDto> {
  deletedAt?: Date | string | null;
}
