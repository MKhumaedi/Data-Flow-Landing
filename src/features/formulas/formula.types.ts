export interface FormulaPracticeData {
  headers?: string[];
  rows: (string | number | null)[][];
  resultCell?: {
    row: number;
    col: number;
    formula?: string;
    label?: string;
  };
  explanationNote?: string;
}

export interface FormulaItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDesc: string;
  fullExplanation: string;
  syntaxExample: string;
  practiceData: FormulaPracticeData;
  order: number;
  isPublished: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

export interface CreateFormulaDto {
  slug?: string;
  name: string;
  category: string;
  shortDesc: string;
  fullExplanation: string;
  syntaxExample: string;
  practiceData: FormulaPracticeData;
  order?: number;
  isPublished?: boolean;
}

export interface UpdateFormulaDto extends Partial<CreateFormulaDto> {
  deletedAt?: Date | string | null;
}
