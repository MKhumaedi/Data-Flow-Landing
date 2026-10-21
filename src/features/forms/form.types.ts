export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'table'
  | 'signature_line'
  | 'document_number'
  | 'signature_block';

export interface FormFieldDef {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  columns?: string[];
  prefix?: string;
  roles?: string[];
  disclaimer?: string;
  helpText?: string;
}

export interface FormTemplateItem {
  id: string;
  slug: string;
  category: string;
  title: string;
  description: string;
  fields: FormFieldDef[];
  order: number;
  isPublished: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface CreateFormTemplateDto {
  slug?: string;
  category: string;
  title: string;
  description: string;
  fields: FormFieldDef[];
  order?: number;
  isPublished?: boolean;
}

export interface UpdateFormTemplateDto {
  slug?: string;
  category?: string;
  title?: string;
  description?: string;
  fields?: FormFieldDef[];
  order?: number;
  isPublished?: boolean;
}

export const FORM_CATEGORIES = [
  'HR & General Affairs',
  'Keuangan, Akuntansi & Pajak',
  'Sales, Marketing & Layanan Pelanggan',
  'Gudang, Logistik & Pengadaan',
  'Operasional, Proyek & Produksi',
  'K3 (HSE), IT & Legal',
] as const;

export type FormCategory = (typeof FORM_CATEGORIES)[number];
