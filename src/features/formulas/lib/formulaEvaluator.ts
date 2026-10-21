import { HyperFormula } from 'hyperformula';
import { FormulaPracticeData } from '../formula.types';

export interface EvaluationResult {
  isValid: boolean;
  isEngineSupported: boolean;
  evaluatedValues: Record<string, any>;
  errors: string[];
  warning?: string;
}

export function evaluateFormulaWithHyperFormula(
  syntaxExample: string,
  practiceData: FormulaPracticeData
): EvaluationResult {
  const errors: string[] = [];
  const evaluatedValues: Record<string, any> = {};

  if (!practiceData || !practiceData.rows || !Array.isArray(practiceData.rows)) {
    return {
      isValid: false,
      isEngineSupported: false,
      evaluatedValues: {},
      errors: ['practiceData.rows must be a 2D array'],
    };
  }

  // Extract formula strings to test
  const formulaCells: { row: number; col: number; formula: string }[] = [];

  // Check rows for embedded formula cells starting with '='
  practiceData.rows.forEach((rowArr, rIdx) => {
    if (Array.isArray(rowArr)) {
      rowArr.forEach((cellVal, cIdx) => {
        if (typeof cellVal === 'string' && cellVal.trim().startsWith('=')) {
          formulaCells.push({ row: rIdx, col: cIdx, formula: cellVal.trim() });
        }
      });
    }
  });

  // Also check resultCell if defined
  if (practiceData.resultCell && practiceData.resultCell.formula) {
    const { row, col, formula } = practiceData.resultCell;
    const exists = formulaCells.some((c) => c.row === row && c.col === col);
    if (!exists && formula.trim().startsWith('=')) {
      formulaCells.push({ row, col, formula: formula.trim() });
    }
  }

  if (formulaCells.length === 0) {
    return {
      isValid: true,
      isEngineSupported: true,
      evaluatedValues: {},
      errors: [],
      warning: 'No dynamic formula cells found to evaluate in practiceData',
    };
  }

  try {
    const hf = HyperFormula.buildFromArray(practiceData.rows as (string | number | boolean | null)[][], {
      licenseKey: 'gpl-v3',
    });

    let hasFormulaError = false;
    let isSupported = true;

    for (const item of formulaCells) {
      const cellVal = hf.getCellValue({ sheet: 0, row: item.row, col: item.col });
      const coord = `R${item.row + 1}C${item.col + 1}`;
      evaluatedValues[coord] = cellVal;

      if (cellVal && typeof cellVal === 'object' && 'type' in (cellVal as any)) {
        hasFormulaError = true;
        const errType = (cellVal as any).value || (cellVal as any).type || 'Error';
        const errMsg = (cellVal as any).message || `Formula evaluated to ${errType}`;
        errors.push(`Cell [${item.row + 1},${item.col + 1}] (${item.formula}): ${errMsg}`);

        if (errType === '#NAME?' || String(errMsg).includes('unknown function') || String(errMsg).includes('is not a registered function')) {
          isSupported = false;
        }
      }
    }

    return {
      isValid: !hasFormulaError && errors.length === 0,
      isEngineSupported: isSupported,
      evaluatedValues,
      errors,
    };
  } catch (err: any) {
    return {
      isValid: false,
      isEngineSupported: false,
      evaluatedValues: {},
      errors: [err.message || 'HyperFormula build error'],
    };
  }
}
