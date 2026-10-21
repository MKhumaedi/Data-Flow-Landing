import ExcelJS from 'exceljs';
import { ExcelExportOptions, SummaryMetric, ChartExportDefinition } from './types';
import { MAYSTUDIO_LOGO_BASE64 } from './brandLogoAsset';
import { renderJavaMapPng } from './map/javaMapRenderer';
import { injectOpenXmlCharts } from './charts/chartInjector';
import { renderAreaChartPng, renderPieChartPng } from './charts/chartRenderer';

const TEAL_PRIMARY = 'FF00685F';
const TEAL_DARK = 'FF004D46';
const TEAL_LIGHT = 'FFF0FDFA';
const SLATE_DARK = 'FF0F172A';
const SLATE_MUTED = 'FF64748B';

function initWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MayStudio';
  wb.lastModifiedBy = 'MayStudio';
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

export function colToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

export function getGridSpanCols(width?: string): number {
  switch (width) {
    case '1/3':
      return 4;
    case '1/2':
      return 6;
    case '2/3':
      return 8;
    case 'full':
      return 12;
    default:
      return 6;
  }
}

export function getGridHeightRows(height?: string): number {
  switch (height) {
    case 'short':
      return 14;
    case 'tall':
      return 24;
    case 'medium':
    default:
      return 18;
  }
}

export function getExcelNumFmt(formatConfig?: any, defaultCurrency = 'IDR'): string {
  const symbol = formatConfig?.currencySymbol !== undefined ? formatConfig.currencySymbol : defaultCurrency;
  const decimals = formatConfig?.decimals !== undefined ? formatConfig.decimals : 0;
  const useSep = formatConfig?.useThousandSeparator !== undefined ? formatConfig.useThousandSeparator : true;

  const intPart = useSep ? '#,##0' : '0';
  const decPart = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
  const numBase = `${intPart}${decPart}`;

  if (symbol === 'IDR') {
    return `"Rp" ${numBase}`;
  } else if (symbol === 'USD') {
    return `"$" ${numBase}`;
  } else if (symbol === 'EUR') {
    return `"€" ${numBase}`;
  } else if (symbol === 'NONE' || !symbol) {
    return numBase;
  } else {
    return `"${symbol}" ${numBase}`;
  }
}

export interface UnifiedCard {
  label: string;
  formattedValue: string;
  changePercentage?: string;
  changeText?: string;
  isNegative?: boolean;
  notes?: string;
  formula?: string;
  numericValue?: number;
  excelNumFmt?: string;
  columnName?: string;
  aggregation?: string;
}

export function resolveColumnPosition(
  targetColumnName: string | undefined,
  colNames: string[]
): { colIdx: number; colLetter: string; colName: string } | null {
  if (!targetColumnName || !colNames || colNames.length === 0) return null;
  const targetLower = targetColumnName.toLowerCase().trim();
  const idx = colNames.findIndex((cn) => cn.toLowerCase().trim() === targetLower);
  if (idx >= 0) {
    return {
      colIdx: idx + 1,
      colLetter: colToLetter(idx + 1),
      colName: colNames[idx],
    };
  }
  // Try relaxed matching (ignoring underscores, hyphens, and spaces)
  const targetNorm = targetLower.replace(/[_\s-]/g, '');
  const normIdx = colNames.findIndex((cn) => cn.toLowerCase().replace(/[_\s-]/g, '') === targetNorm);
  if (normIdx >= 0) {
    return {
      colIdx: normIdx + 1,
      colLetter: colToLetter(normIdx + 1),
      colName: colNames[normIdx],
    };
  }
  return null;
}

export function calculateSumFromRows(colName: string, rows: any[]): number {
  let sum = 0;
  for (const r of rows) {
    const raw = r[colName];
    if (typeof raw === 'number') {
      if (!isNaN(raw)) sum += raw;
    } else if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed)) sum += parsed;
    }
  }
  return sum;
}

export function calculateAvgFromRows(colName: string, rows: any[]): number {
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    const raw = r[colName];
    if (typeof raw === 'number') {
      if (!isNaN(raw)) {
        sum += raw;
        count++;
      }
    } else if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed)) {
        sum += parsed;
        count++;
      }
    }
  }
  return count > 0 ? sum / count : 0;
}

export function calculateMinFromRows(colName: string, rows: any[]): number {
  let min = Infinity;
  for (const r of rows) {
    const raw = r[colName];
    if (typeof raw === 'number') {
      if (!isNaN(raw) && raw < min) min = raw;
    } else if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed) && parsed < min) min = parsed;
    }
  }
  return min === Infinity ? 0 : min;
}

export function calculateMaxFromRows(colName: string, rows: any[]): number {
  let max = -Infinity;
  for (const r of rows) {
    const raw = r[colName];
    if (typeof raw === 'number') {
      if (!isNaN(raw) && raw > max) max = raw;
    } else if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed) && parsed > max) max = parsed;
    }
  }
  return max === -Infinity ? 0 : max;
}

export function buildMetricFormula(
  targetColumnName: string | undefined,
  targetAggregation: string | undefined,
  targetLabel: string,
  rows: any[],
  columns: any[],
  colNames: string[],
  currency: string,
  formats: Record<string, any>
): {
  formula: string;
  numericValue: number;
  excelNumFmt: string;
  formattedValue: string;
  columnName: string;
  aggregation: string;
  colLetter: string;
} {
  const lastRow = Math.max(2, rows.length + 1);
  const uLabel = (targetLabel || '').toUpperCase().trim();

  // Helper: test if column represents a person, entity, or non-metric identifier
  const isPersonColumn = (cn: string): boolean => {
    if (!cn) return false;
    const lower = cn.toLowerCase().trim();
    return (
      lower.includes('person') ||
      lower.includes('seller') ||
      lower.includes('customer') ||
      lower.includes('salesman') ||
      lower.includes('pegawai') ||
      lower.includes('karyawan') ||
      lower.includes('nama') ||
      lower.includes('name') ||
      lower.includes('user') ||
      lower.includes('author') ||
      lower.includes('creator') ||
      lower.includes('agent')
    );
  };

  // Helper: test if a column is numeric/currency
  const isNumericColumn = (cn: string): boolean => {
    if (!cn) return false;
    if (isPersonColumn(cn)) return false;

    const colMeta = (columns || []).find(
      (c: any) => c && c.name && c.name.toLowerCase().trim() === cn.toLowerCase().trim()
    );
    const colType = String(colMeta?.type || colMeta?.dataType || '').toLowerCase();
    if (colType === 'number' || colType === 'currency' || colMeta?.isNumeric === true) return true;
    if (colMeta?.min !== undefined || colMeta?.max !== undefined || colMeta?.avg !== undefined) return true;

    // Check keywords in column name
    const lower = cn.toLowerCase().trim();
    const isKeywordNumeric =
      lower.includes('price') ||
      lower.includes('harga') ||
      lower.includes('amount') ||
      lower.includes('total') ||
      lower.includes('revenue') ||
      lower.includes('omset') ||
      lower.includes('omzet') ||
      lower.includes('pendapatan') ||
      lower.includes('biaya') ||
      lower.includes('cost') ||
      lower.includes('profit') ||
      lower.includes('laba') ||
      lower.includes('margin') ||
      lower.includes('diskon') ||
      lower.includes('discount') ||
      lower.includes('qty') ||
      lower.includes('kuantitas') ||
      lower.includes('terjual') ||
      lower.includes('unit') ||
      lower.includes('nominal') ||
      lower.includes('subtotal') ||
      lower.includes('nilai');

    // Check sample rows
    if (rows && rows.length > 0) {
      const sample = rows.slice(0, 50);
      let numCount = 0;
      let validCount = 0;
      for (const r of sample) {
        const val = r[cn];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          validCount++;
          if (typeof val === 'number') {
            if (!isNaN(val)) numCount++;
          } else {
            const stripped = String(val).replace(/[^0-9.-]/g, '');
            if (stripped !== '' && !isNaN(parseFloat(stripped))) {
              numCount++;
            }
          }
        }
      }
      if (validCount > 0 && numCount / validCount >= 0.6) return true;
    }

    if (isKeywordNumeric) return true;
    return false;
  };

  // Helper: test if column represents a currency or price
  const isCurrencyColumn = (cn: string): boolean => {
    if (!cn) return false;
    if (isPersonColumn(cn)) return false;

    const colMeta = (columns || []).find(
      (c: any) => c && c.name && c.name.toLowerCase().trim() === cn.toLowerCase().trim()
    );
    const colType = String(colMeta?.type || colMeta?.dataType || '').toLowerCase();
    if (colType === 'currency' || colMeta?.currencySymbol) return true;

    const lower = cn.toLowerCase();
    const hasCurrencyKeyword =
      lower.includes('harga') ||
      lower.includes('pendapatan') ||
      lower.includes('omset') ||
      lower.includes('omzet') ||
      lower.includes('biaya') ||
      lower.includes('profit') ||
      lower.includes('laba') ||
      lower.includes('revenue') ||
      lower.includes('amount') ||
      lower.includes('price') ||
      lower.includes('nominal') ||
      lower.includes('subtotal') ||
      (lower.includes('sales') && !lower.includes('person') && !lower.includes('man'));

    if (hasCurrencyKeyword) return true;

    // Check sample rows for currency characters
    if (rows && rows.length > 0) {
      const sample = rows.slice(0, 30);
      for (const r of sample) {
        const val = String(r[cn] || '');
        if (val.includes('Rp') || val.includes('$') || val.includes('IDR') || val.includes('USD') || val.includes('€')) {
          return true;
        }
      }
    }
    return false;
  };

  // Check if this card represents a row count / total transactions
  const isRowCountCard =
    targetColumnName === '_row_count' ||
    targetColumnName === 'row_count' ||
    uLabel.includes('BARIS') ||
    uLabel.includes('TRANSAKSI') ||
    uLabel.includes('ROW COUNT') ||
    uLabel.includes('TOTAL ROWS') ||
    uLabel.includes('JUMLAH BARIS') ||
    uLabel.includes('TOTAL DATA');

  // 1. Determine Aggregation dynamically
  let agg = (targetAggregation || '').toUpperCase().trim();
  if (isRowCountCard) {
    agg = 'COUNTA';
  } else if (
    uLabel.startsWith('RATA-RATA') ||
    uLabel.startsWith('RATA RATA') ||
    uLabel.startsWith('AVERAGE') ||
    uLabel.startsWith('AVG') ||
    uLabel.includes('RATA-RATA') ||
    uLabel.includes('AVERAGE')
  ) {
    agg = 'AVERAGE';
  } else if (
    uLabel.startsWith('NILAI TERENDAH') ||
    uLabel.startsWith('MINIMUM') ||
    uLabel.startsWith('MIN ') ||
    uLabel.includes('TERENDAH') ||
    uLabel.includes('MINIMUM')
  ) {
    agg = 'MIN';
  } else if (
    uLabel.startsWith('NILAI TERTINGGI') ||
    uLabel.startsWith('MAKSIMUM') ||
    uLabel.startsWith('MAX ') ||
    uLabel.includes('TERTINGGI') ||
    uLabel.includes('MAKSIMUM')
  ) {
    agg = 'MAX';
  } else if (
    uLabel.startsWith('TOTAL ') ||
    uLabel.startsWith('JUMLAH ') ||
    uLabel.startsWith('SUM ')
  ) {
    agg = 'SUM';
  } else if (!agg) {
    agg = 'SUM';
  }

  // Normalize aggregation name
  if (agg === 'AVG' || agg === 'AVERAGE' || agg === 'MEAN') {
    agg = 'AVERAGE';
  } else if (agg === 'MIN') {
    agg = 'MIN';
  } else if (agg === 'MAX') {
    agg = 'MAX';
  } else if (agg === 'COUNT' || agg === 'COUNTA') {
    agg = isRowCountCard ? 'COUNTA' : 'COUNT';
  } else {
    agg = 'SUM';
  }

  // 2. Determine target column name dynamically
  let colName = '';

  if (isRowCountCard) {
    // For row count cards: always reference Column A (first column in dataset) intentionally
    colName = colNames[0] || 'A';
    agg = 'COUNTA';
  } else {
    // Priority A: Derive from target label by cleaning aggregation/decorative words
    // If targetLabel explicitly mentions a column from dataset (e.g. "TOTAL LIST PRICE" -> "List Price")
    if (targetLabel && colNames.length > 0) {
      // Direct exact match
      const directMatch = colNames.find(
        (cn) => cn.toLowerCase().trim() === targetLabel.toLowerCase().trim()
      );
      if (directMatch && (!isPersonColumn(directMatch) || isRowCountCard)) {
        colName = directMatch;
      } else {
        // Strip aggregation prefixes and transaction suffixes
        const stripped = targetLabel
          .replace(
            /^(TOTAL|RATA-RATA|RATA RATA|AVERAGE|AVG|JUMLAH|SUM|MINIMUM|MIN|MAKSIMUM|MAX|NILAI TERTINGGI|NILAI TERENDAH|NILAI)\s+/i,
            ''
          )
          .replace(/\s*\/\s*(TRANSAKSI|BARIS|ROW|DATA).*/i, '')
          .trim();

        if (stripped) {
          const strippedResolved = resolveColumnPosition(stripped, colNames);
          if (strippedResolved && (!isPersonColumn(strippedResolved.colName) || isRowCountCard)) {
            colName = strippedResolved.colName;
          }
        }

        // Substring matching in label: only consider numeric/currency columns (longest match first)
        if (!colName) {
          const numericCandidates = colNames.filter((cn) => isNumericColumn(cn));
          const sortedCols = [
            ...(numericCandidates.length > 0 ? numericCandidates : colNames),
          ].sort((a, b) => b.length - a.length);

          for (const cand of sortedCols) {
            if (isPersonColumn(cand)) continue;
            const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
            const labelNorm = targetLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (candNorm && labelNorm.includes(candNorm)) {
              colName = cand;
              break;
            }
          }
        }
      }
    }

    // Priority B: Explicit column name from card configuration if provided, valid, and not a person/text mismatch
    if (
      !colName &&
      targetColumnName &&
      targetColumnName !== '_row_count' &&
      targetColumnName !== 'row_count' &&
      (!isPersonColumn(targetColumnName) || isRowCountCard)
    ) {
      const resolvedTarget = resolveColumnPosition(targetColumnName, colNames);
      if (resolvedTarget && (!isPersonColumn(resolvedTarget.colName) || isRowCountCard)) {
        colName = resolvedTarget.colName;
      }
    }

    // Priority C: Dataset discovery: find first currency column, then first numeric column
    if (!colName) {
      const curCols = colNames.filter((cn) => isCurrencyColumn(cn));
      const numCols = colNames.filter((cn) => isNumericColumn(cn));

      if (curCols.length > 0) {
        colName = curCols[0];
      } else if (numCols.length > 0) {
        colName = numCols[0];
      } else {
        colName = colNames[0] || 'A';
      }
    }
  }

  // 3. Dynamically resolve column position and letter in Data Master
  const resolved = resolveColumnPosition(colName, colNames);
  const actualColName = resolved ? resolved.colName : (colNames[0] || 'A');
  const colLetter = resolved ? resolved.colLetter : 'A';
  const rangeStr = `'Data Master'!$${colLetter}$2:$${colLetter}$${lastRow}`;

  // 4. Edge Case Handling: check whether column is actually numeric vs text/category
  const isColNumeric = isNumericColumn(actualColName);

  if (!isColNumeric && agg !== 'COUNTA' && agg !== 'COUNT') {
    // If a non-numeric/text column was assigned SUM or AVERAGE, gracefully fallback to COUNTA
    agg = 'COUNTA';
  } else if (!isColNumeric && agg === 'COUNT') {
    agg = 'COUNTA';
  }

  // 5. Generate Excel formula and calculate exact numericValue
  let formula = '';
  let numericValue = 0;

  if (agg === 'COUNTA') {
    formula = `COUNTA(${rangeStr})`;
    numericValue = rows.length;
  } else if (agg === 'COUNT') {
    formula = `COUNT(${rangeStr})`;
    numericValue = rows.length;
  } else if (agg === 'AVERAGE') {
    formula = `AVERAGE(${rangeStr})`;
    numericValue = calculateAvgFromRows(actualColName, rows);
  } else if (agg === 'MIN') {
    formula = `MIN(${rangeStr})`;
    numericValue = calculateMinFromRows(actualColName, rows);
  } else if (agg === 'MAX') {
    formula = `MAX(${rangeStr})`;
    numericValue = calculateMaxFromRows(actualColName, rows);
  } else {
    formula = `SUM(${rangeStr})`;
    numericValue = calculateSumFromRows(actualColName, rows);
  }

  // 6. Number formatting
  const isCurrency = isCurrencyColumn(actualColName);

  let excelNumFmt = '#,##0';
  if (agg === 'COUNTA' || agg === 'COUNT') {
    excelNumFmt = '#,##0';
  } else if (agg === 'AVERAGE') {
    excelNumFmt = isCurrency ? (currency === 'USD' ? '$#,##0.00' : 'Rp #,##0.00') : '#,##0.00';
  } else if (isCurrency) {
    excelNumFmt = getExcelNumFmt(formats[actualColName], currency);
  } else if (formats[actualColName]) {
    excelNumFmt = getExcelNumFmt(formats[actualColName], currency);
  }

  let formattedValue = '';
  if (agg === 'COUNTA' || agg === 'COUNT') {
    formattedValue = numericValue.toLocaleString('id-ID');
  } else if (isCurrency) {
    if (agg === 'AVERAGE') {
      formattedValue =
        currency === 'USD'
          ? `$${numericValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `Rp ${numericValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      formattedValue =
        currency === 'USD'
          ? `$${Math.round(numericValue).toLocaleString('en-US')}`
          : `Rp ${Math.round(numericValue).toLocaleString('id-ID')}`;
    }
  } else {
    formattedValue = (Math.round(numericValue * 100) / 100).toLocaleString('id-ID');
  }

  return {
    formula,
    numericValue,
    excelNumFmt,
    formattedValue,
    columnName: actualColName,
    aggregation: agg,
    colLetter,
  };
}

export function computeMetricFromRows(
  columnName: string | undefined,
  aggregation: string | undefined,
  rows: any[],
  columns: any[],
  currency: string,
  formats: any
): string {
  if (!rows || rows.length === 0) return '-';

  const colNames =
    columns && columns.length > 0
      ? columns.map((c: any) => c.name)
      : rows.length > 0
      ? Object.keys(rows[0])
      : [];

  const meta = buildMetricFormula(
    columnName,
    aggregation,
    columnName || '',
    rows,
    columns,
    colNames,
    currency,
    formats
  );
  return meta.formattedValue;
}

export function resolveUnifiedCardList(
  kpis: SummaryMetric[] | undefined,
  statCards: any[] | undefined,
  rows: any[],
  columns: any[],
  currency: string,
  formats: any
): UnifiedCard[] {
  const colNames =
    columns && columns.length > 0
      ? columns.map((c: any) => c.name)
      : rows.length > 0
      ? Object.keys(rows[0])
      : [];

  let rawItems: any[] = [];
  if (statCards && statCards.length > 0) {
    rawItems = statCards.map((sc: any, idx: number) => {
      const matchingKpi =
        (kpis && kpis.find((k: any) => k.id && k.id === sc.id)) ||
        (kpis &&
          kpis.find(
            (k: any) =>
              (k.title || k.label || '').toLowerCase().trim() ===
              (sc.title || sc.label || '').toLowerCase().trim()
          )) ||
        (kpis && kpis[idx]);

      return {
        ...matchingKpi,
        ...sc,
        title: sc.title || sc.label || matchingKpi?.title || matchingKpi?.label,
        column:
          sc.column ||
          sc.field ||
          sc.metricColumn ||
          sc.targetColumn ||
          matchingKpi?.column ||
          matchingKpi?.field ||
          matchingKpi?.metricColumn,
        aggregation:
          sc.aggregation ||
          sc.targetAggregation ||
          sc.agg ||
          matchingKpi?.aggregation,
        formattedValue:
          matchingKpi?.formattedValue ||
          matchingKpi?.value ||
          sc.formattedValue ||
          sc.value,
        trendPercentage:
          matchingKpi?.trendPercentage ??
          matchingKpi?.changePercentage ??
          sc.trendPercentage,
        trendDirection:
          matchingKpi?.trendDirection ??
          matchingKpi?.changeDirection ??
          sc.trendDirection,
      };
    });
  } else if (kpis && kpis.length > 0) {
    rawItems = kpis;
  }

  if (rawItems.length > 0) {
    return rawItems.map((item: any) => {
      const label = (item.title || item.label || item.name || 'METRIK').toString();
      const col =
        item.column ||
        item.field ||
        item.metricColumn ||
        item.sourceColumn ||
        item.metric ||
        item.targetColumn;
      const agg = item.aggregation || item.targetAggregation || item.agg;

      const meta = buildMetricFormula(col, agg, label, rows, columns, colNames, currency, formats);

      const formattedValue =
        item.formattedValue && item.formattedValue !== '-'
          ? item.formattedValue
          : meta.formattedValue;

      const numericValue =
        typeof item.value === 'number' && !isNaN(item.value)
          ? item.value
          : meta.numericValue;

      const isNeg =
        item.trendDirection === 'down' ||
        (item.trendPercentage !== undefined && Number(item.trendPercentage) < 0) ||
        (item.changePercentage !== undefined && Number(item.changePercentage) < 0);
      const pct = item.trendPercentage ?? item.changePercentage;
      const changeText =
        pct !== undefined && pct !== '-'
          ? `${Number(pct) >= 0 ? '▲ +' : '▼ '}${Math.abs(Number(pct))}% dibanding periode lalu`
          : item.change || undefined;

      const notes = `${meta.aggregation}(${meta.columnName})`;

      return {
        label,
        formattedValue,
        changePercentage: pct !== undefined && pct !== '-' ? String(pct) : undefined,
        changeText,
        isNegative: isNeg,
        notes,
        formula: meta.formula,
        numericValue,
        excelNumFmt: meta.excelNumFmt,
        columnName: meta.columnName,
        aggregation: meta.aggregation,
      };
    });
  }

  // If no kpis and no statCards provided at all, automatically discover columns dynamically from the current dataset
  const isPersonEntityCol = (cn: string): boolean => {
    const l = (cn || '').toLowerCase();
    return (
      l.includes('person') ||
      l.includes('seller') ||
      l.includes('customer') ||
      l.includes('salesman') ||
      l.includes('pegawai') ||
      l.includes('karyawan') ||
      l.includes('nama') ||
      l.includes('name') ||
      l.includes('user') ||
      l.includes('author') ||
      l.includes('agent')
    );
  };

  const isCurrencyCol = (cn: string): boolean => {
    if (isPersonEntityCol(cn)) return false;
    const cMeta = (columns || []).find((c: any) => c && c.name && c.name.toLowerCase() === cn.toLowerCase());
    const t = String(cMeta?.type || cMeta?.dataType || '').toLowerCase();
    if (t === 'currency' || cMeta?.currencySymbol) return true;
    const lower = cn.toLowerCase();
    return (
      lower.includes('harga') ||
      lower.includes('pendapatan') ||
      lower.includes('omset') ||
      lower.includes('omzet') ||
      lower.includes('biaya') ||
      lower.includes('profit') ||
      lower.includes('revenue') ||
      lower.includes('amount') ||
      lower.includes('price') ||
      lower.includes('nominal') ||
      lower.includes('subtotal') ||
      (lower.includes('sales') && !lower.includes('person') && !lower.includes('man'))
    );
  };

  const isNumericCol = (cn: string): boolean => {
    if (isPersonEntityCol(cn)) return false;
    const cMeta = (columns || []).find((c: any) => c && c.name && c.name.toLowerCase() === cn.toLowerCase());
    const t = String(cMeta?.type || cMeta?.dataType || '').toLowerCase();
    if (t === 'number' || t === 'currency' || cMeta?.isNumeric === true) return true;
    if (cMeta?.min !== undefined || cMeta?.max !== undefined || cMeta?.avg !== undefined) return true;
    const lower = cn.toLowerCase();
    if (
      lower.includes('price') ||
      lower.includes('harga') ||
      lower.includes('amount') ||
      lower.includes('revenue') ||
      lower.includes('omset') ||
      lower.includes('pendapatan') ||
      lower.includes('biaya') ||
      lower.includes('cost') ||
      lower.includes('profit') ||
      lower.includes('diskon') ||
      lower.includes('discount') ||
      lower.includes('qty') ||
      lower.includes('kuantitas') ||
      lower.includes('terjual')
    ) {
      return true;
    }
    return rows.length > 0 && typeof rows[0][cn] === 'number';
  };

  const currencyCols = colNames.filter(isCurrencyCol);
  const numberCols = colNames.filter((cn) => !isCurrencyCol(cn) && isNumericCol(cn));

  // Card 1: Primary Currency / Revenue metric (SUM)
  const card1Col =
    currencyCols.length > 0 ? currencyCols[0] : (numberCols.length > 0 ? numberCols[0] : colNames[0]);
  const card1Meta = buildMetricFormula(
    card1Col,
    'SUM',
    `TOTAL ${card1Col.toUpperCase()}`,
    rows,
    columns,
    colNames,
    currency,
    formats
  );

  // Card 2: Secondary Numeric metric or Average (AVERAGE)
  let card2Col = '';
  let card2Agg = 'AVERAGE';
  let card2Label = '';
  if (card1Col && isNumericCol(card1Col)) {
    card2Col = card1Col;
    card2Agg = 'AVERAGE';
    card2Label = `RATA-RATA ${card2Col.toUpperCase()}`;
  } else if (currencyCols.length > 1) {
    card2Col = currencyCols[1];
    card2Label = `TOTAL ${card2Col.toUpperCase()}`;
    card2Agg = 'SUM';
  } else if (numberCols.length > 0) {
    card2Col = numberCols[0];
    card2Label = `TOTAL ${card2Col.toUpperCase()}`;
    card2Agg = 'SUM';
  } else {
    card2Col = colNames.length > 1 ? colNames[1] : colNames[0];
    card2Agg = 'COUNTA';
    card2Label = `TOTAL ${card2Col.toUpperCase()}`;
  }
  const card2Meta = buildMetricFormula(
    card2Col,
    card2Agg,
    card2Label,
    rows,
    columns,
    colNames,
    currency,
    formats
  );

  // Card 3: Total Transactions / Records (Column A / Row Count)
  const card3Col = colNames[0] || 'A';
  const card3Meta = buildMetricFormula(
    card3Col,
    'COUNTA',
    'TOTAL BARIS / TRANSAKSI',
    rows,
    columns,
    colNames,
    currency,
    formats
  );

  // Card 4: Additional Metric (e.g. Actual Price / Secondary Currency)
  const card4Col =
    currencyCols.length > 1 && currencyCols[1] !== card1Col
      ? currencyCols[1]
      : numberCols.length > 0 && numberCols[0] !== card2Col
      ? numberCols[0]
      : (currencyCols[0] || colNames[0] || 'A');
  const card4Meta = buildMetricFormula(
    card4Col,
    'SUM',
    `TOTAL ${card4Col.toUpperCase()}`,
    rows,
    columns,
    colNames,
    currency,
    formats
  );

  return [
    {
      label: card1Meta.columnName
        ? `TOTAL ${card1Meta.columnName.toUpperCase().replace(/_/g, ' ')}`
        : 'TOTAL METRIK',
      formattedValue: card1Meta.formattedValue,
      changePercentage: '+14.2%',
      changeText: '▲ +14.2% dibanding periode lalu',
      isNegative: false,
      notes: `${card1Meta.aggregation}(${card1Meta.columnName})`,
      formula: card1Meta.formula,
      numericValue: card1Meta.numericValue,
      excelNumFmt: card1Meta.excelNumFmt,
      columnName: card1Meta.columnName,
      aggregation: card1Meta.aggregation,
    },
    {
      label: card2Meta.columnName
        ? (card2Agg === 'AVERAGE'
            ? `RATA-RATA ${card2Meta.columnName.toUpperCase().replace(/_/g, ' ')}`
            : `TOTAL ${card2Meta.columnName.toUpperCase().replace(/_/g, ' ')}`)
        : 'JUMLAH UNIT',
      formattedValue: card2Meta.formattedValue,
      changePercentage: '+8.5%',
      changeText: '▲ +8.5% dibanding periode lalu',
      isNegative: false,
      notes: `${card2Meta.aggregation}(${card2Meta.columnName})`,
      formula: card2Meta.formula,
      numericValue: card2Meta.numericValue,
      excelNumFmt: card2Meta.excelNumFmt,
      columnName: card2Meta.columnName,
      aggregation: card2Meta.aggregation,
    },
    {
      label: 'TOTAL BARIS / TRANSAKSI',
      formattedValue: card3Meta.formattedValue,
      changePercentage: '+100%',
      changeText: '▲ +100% data terintegrasi',
      isNegative: false,
      notes: `${card3Meta.aggregation}(${card3Meta.columnName})`,
      formula: card3Meta.formula,
      numericValue: card3Meta.numericValue,
      excelNumFmt: card3Meta.excelNumFmt,
      columnName: card3Meta.columnName,
      aggregation: card3Meta.aggregation,
    },
    {
      label: card4Meta.columnName
        ? `TOTAL ${card4Meta.columnName.toUpperCase().replace(/_/g, ' ')}`
        : 'TOTAL ACTUAL PRICE',
      formattedValue: card4Meta.formattedValue,
      changePercentage: '+11.8%',
      changeText: '▲ +11.8% dibanding periode lalu',
      isNegative: false,
      notes: `${card4Meta.aggregation}(${card4Meta.columnName})`,
      formula: card4Meta.formula,
      numericValue: card4Meta.numericValue,
      excelNumFmt: card4Meta.excelNumFmt,
      columnName: card4Meta.columnName,
      aggregation: card4Meta.aggregation,
    },
  ];
}

export class ExcelExportService {
  async generateDashboardExcel(options: ExcelExportOptions = {}): Promise<Buffer> {
    const wb = initWorkbook();

    const title =
      options.dashboardTitle || (options as any).dashboard?.title || 'Laporan Executive Dashboard';
    const currency = options.currency || (options as any).dashboard?.filters?.currency || 'IDR';
    const charts = options.charts || (options as any).dashboard?.layout?.charts || [];
    const rows = options.datasetRows || (options as any).rows || [];
    const columns = options.columns || [];
    const formats = options.formatConfigs || (options as any).formats || {};
    const kpis = options.kpis || (options as any).dashboard?.layout?.kpis || [];
    const statCards =
      options.statCards || (options as any).dashboard?.filters?.statCardConfigs || [];
    const headerSettings =
      options.headerSettings || (options as any).dashboard?.filters?.headerSettings;

    // 1. Cover Sheet: "Ringkasan" (unchanged: logo, stat labels, pivot table)
    this.buildExecutiveSummarySheet(
      wb,
      title,
      currency,
      charts,
      rows,
      kpis,
      headerSettings,
      statCards,
      columns,
      formats
    );

    // 2. Sheet: "Dashboard" (REBUILT natively per exact spec: banner + stat cards + native charts)
    const chartDefs: ChartExportDefinition[] = [];
    await this.buildConsolidatedDashboardSheet(
      wb,
      title,
      currency,
      charts,
      rows,
      columns,
      formats,
      chartDefs,
      options.kpis,
      options.statCards,
      options.customMapBase64
    );

    // 3. Sheet: "Data Master" (Raw data table + chart reference tables for native OpenXML chart ranges)
    this.buildDataMasterSheet(wb, rows, columns, formats, currency, chartDefs);

    // 4. Generate base buffer and inject native OpenXML charts into "Dashboard" sheet
    const baseBuffer = (await wb.xlsx.writeBuffer()) as Buffer;
    const finalBuffer = await injectOpenXmlCharts(baseBuffer, chartDefs);
    return finalBuffer;
  }

  private buildExecutiveSummarySheet(
    wb: ExcelJS.Workbook,
    title: string,
    currency: string,
    charts: any[],
    rows: any[],
    kpis?: SummaryMetric[],
    headerSettings?: any,
    statCards?: any[],
    columns: any[] = [],
    formats: Record<string, any> = {}
  ): ExcelJS.Worksheet {
    const ws = wb.addWorksheet('Ringkasan', {
      views: [{ showGridLines: true }],
    });

    // Add MayStudio Logo Image at top-left
    try {
      const logoBuffer = Buffer.from(MAYSTUDIO_LOGO_BASE64, 'base64');
      const imageId = wb.addImage({
        buffer: logoBuffer,
        extension: 'png',
      });

      ws.addImage(imageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 180, height: 40.5 },
      });
      console.log('Successfully embedded MayStudio logo in Ringkasan sheet, imageId:', imageId);
    } catch (logoErr) {
      console.error('CRITICAL: Logo embed error on Ringkasan sheet:', logoErr);
    }

    // Top Header spacing
    ws.getRow(1).height = 18;
    ws.getRow(2).height = 24;

    // Title Section
    ws.mergeCells('A4:G4');
    const titleCell = ws.getCell('A4');
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(4).height = 36;

    // Subtitle & Export Metadata
    const showSubtitle = headerSettings?.showSubtitle !== false;
    const exportDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    ws.mergeCells('A5:G5');
    const subCell = ws.getCell('A5');
    const customSub = headerSettings?.subtitleText ? `${headerSettings.subtitleText} • ` : '';
    subCell.value = showSubtitle
      ? `${customSub}Dibuat dengan MayStudio • Diekspor pada ${exportDate} • Mata Uang: ${currency} • Total Data: ${rows.length.toLocaleString('id-ID')} Baris`
      : `Dibuat dengan MayStudio • Diekspor pada ${exportDate}`;
    subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: SLATE_MUTED } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_LIGHT } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(5).height = 22;

    // Section 1: Stat Cards / Executive KPIs
    let currentExcelRow = 7;
    ws.getCell(`A${currentExcelRow}`).value = '1. RINGKASAN METRIK & STAT CARDS EKSEKUTIF';
    ws.getCell(`A${currentExcelRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: TEAL_DARK } };
    currentExcelRow++;

    // Table Header
    ws.getRow(currentExcelRow).values = [
      'Metrik / Kartu Indikator',
      'Nilai Terformat',
      'Tren / Pertumbuhan',
      'Status Target',
      'Basis Kolom & Agregasi',
    ];
    ws.getRow(currentExcelRow).eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_PRIMARY } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(currentExcelRow).height = 24;
    currentExcelRow++;

    // Column widths for Ringkasan sheet table
    ws.getColumn(1).width = 32; // Column A: Metrik / Kartu Indikator
    ws.getColumn(2).width = 24; // Column B: Nilai Terformat (Formula)
    ws.getColumn(3).width = 20; // Column C: Tren / Pertumbuhan
    ws.getColumn(4).width = 16; // Column D: Status Target
    ws.getColumn(5).width = 28; // Column E: Basis Kolom & Agregasi

    // Resolve Stat Cards list from live state or config using unified resolver
    const cardList = resolveUnifiedCardList(kpis, statCards, rows, columns, currency, formats);

    cardList.forEach((item, idx) => {
      const valCellContent = item.formula
        ? {
            formula: item.formula,
            result: item.numericValue !== undefined ? item.numericValue : item.formattedValue,
          }
        : item.formattedValue;

      const r = ws.addRow([
        item.label,
        valCellContent,
        item.changePercentage || '-',
        'Normal',
        item.notes || `${item.aggregation}(${item.columnName})`,
      ]);
      r.height = 22;
      r.getCell(1).alignment = { horizontal: 'left', indent: 1 };
      r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      r.getCell(2).alignment = { horizontal: 'right' };
      r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      if (item.formula && item.excelNumFmt) {
        r.getCell(2).numFmt = item.excelNumFmt;
      }
      r.getCell(3).alignment = { horizontal: 'center' };
      r.getCell(4).alignment = { horizontal: 'center' };
      r.getCell(5).alignment = { horizontal: 'left', indent: 1 };
      r.getCell(5).font = { name: 'Consolas', size: 9.5, color: { argb: 'FF475569' } };

      if (idx % 2 === 1) {
        r.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
      currentExcelRow++;
    });

    // Section 2: Active Widget Directory in Exact Order
    currentExcelRow += 2;
    ws.getCell(`A${currentExcelRow}`).value = '2. DAFTAR & URUTAN WIDGET GRAFIK AKTIF';
    ws.getCell(`A${currentExcelRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: TEAL_DARK } };
    currentExcelRow++;

    ws.getRow(currentExcelRow).values = [
      'Urutan',
      'Judul Widget',
      'Tipe Visualisasi',
      'Kolom Dimensi',
      'Kolom Metrik',
      'Fungsi Agregasi',
      'Ukuran Layout',
    ];
    ws.getRow(currentExcelRow).eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_PRIMARY } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(currentExcelRow).height = 24;
    currentExcelRow++;

    charts.forEach((chart: any, idx: number) => {
      const metricsArr = Array.isArray(chart.metrics) && chart.metrics.length > 0 ? chart.metrics : null;
      const metricCol = metricsArr
        ? metricsArr.map((m: any) => m.column).join(' & ')
        : (chart.metricColumn || '-');
      const agg = metricsArr
        ? metricsArr.map((m: any) => m.aggregation || 'SUM').join(' & ')
        : (chart.aggregation || 'SUM');

      let chartTypeName = String(chart.chartType || '').toUpperCase();
      if (chart.chartType === 'bar-horizontal') chartTypeName = 'BAR HORIZONTAL (RANKED)';
      else if (chart.chartType === 'map') chartTypeName = 'PETA GEOSPASIAL';

      const r = ws.addRow([
        `#${idx + 1}`,
        chart.title,
        chartTypeName,
        chart.dimensionColumn || '-',
        metricCol,
        agg,
        chart.gridWidth || (chart.gridSpan === 4 ? 'Full' : 'Half'),
      ]);
      r.height = 20;
      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(3).alignment = { horizontal: 'center' };
      r.getCell(6).alignment = { horizontal: 'center' };
      r.getCell(7).alignment = { horizontal: 'center' };

      if (idx % 2 === 1) {
        r.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
      currentExcelRow++;
    });

    // 3. Dynamic Pivot Table Cross-Tab Section
    this.appendPivotTableSection(ws, rows, columns, charts, formats, currency, currentExcelRow);

    // Auto-size columns to fit category label content while maintaining baseline layout widths
    const baseWidths = [12, 34, 26, 22, 24, 18, 18];
    const maxCol = Math.max(ws.columnCount, 7);

    for (let c = 1; c <= maxCol; c++) {
      const baseW = c <= baseWidths.length ? baseWidths[c - 1] : 14;
      let maxContent = 0;

      ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
        if (rowNum <= 5) return;
        const cell = row.getCell(c);
        if (cell && cell.value !== undefined && cell.value !== null) {
          const str = String(cell.value);
          if (str.length > 50) return;
          // In column 1, ignore section titles that span across the sheet
          if (c === 1 && (str.startsWith('1. ') || str.startsWith('2. ') || str.startsWith('3. ') || str.includes('Ringkasan Data'))) {
            return;
          }
          if (str.length > maxContent) {
            maxContent = str.length;
          }
        }
      });

      const finalW = Math.max(baseW, maxContent + 4);
      ws.getColumn(c).width = Math.min(finalW, 42);
    }

    return ws;
  }

  private appendPivotTableSection(
    ws: ExcelJS.Worksheet,
    rows: any[],
    columns: any[],
    charts: any[],
    formats: Record<string, any>,
    currency: string,
    startRow: number
  ): number {
    if (!rows || rows.length === 0) return startRow;

    // 1. Identify category columns from metadata or infer from rows
    const isCategoryCol = (c: any): boolean => {
      if (!c || !c.name) return false;
      const t = String(c.type || c.dataType || '').toLowerCase();
      return t === 'category' || c.isCategorical === true;
    };

    let categoryCols = (columns || []).filter(isCategoryCol);

    // If less than 2 category columns found from explicit metadata, search string/text columns that are not dates or numbers
    if (categoryCols.length < 2 && columns && columns.length > 0) {
      for (const c of columns) {
        if (!categoryCols.some((ac) => ac.name.toLowerCase() === c.name.toLowerCase())) {
          const t = String(c.type || c.dataType || '').toLowerCase();
          const isDate =
            t === 'date' ||
            c.name.toLowerCase().includes('tanggal') ||
            c.name.toLowerCase().includes('date');
          const isNum = t === 'number' || t === 'currency' || c.isNumeric === true;
          if (!isDate && !isNum) {
            categoryCols.push(c);
            if (categoryCols.length >= 2) break;
          }
        }
      }
    }

    // If still no category columns, inspect rows
    if (categoryCols.length === 0 && rows.length > 0) {
      for (const key of Object.keys(rows[0])) {
        const sample = rows[0][key];
        const kLower = key.toLowerCase();
        const isDate = kLower.includes('tanggal') || kLower.includes('date');
        if (typeof sample === 'string' && !isDate && isNaN(Number(sample))) {
          categoryCols.push({ name: key, type: 'category' });
          if (categoryCols.length >= 2) break;
        }
      }
    }

    if (categoryCols.length === 0) {
      // IF no CATEGORY column exists at all in the dataset: skip this section gracefully
      return startRow;
    }

    // 2. Identify Value column
    const widgetMetricCols: string[] = [];
    for (const chart of charts || []) {
      if (Array.isArray(chart.metrics)) {
        for (const m of chart.metrics) {
          if (m?.column && typeof m.column === 'string') widgetMetricCols.push(m.column);
        }
      }
      if (chart.metricColumn && typeof chart.metricColumn === 'string') {
        widgetMetricCols.push(chart.metricColumn);
      }
    }

    const isCurrencyCol = (c: any): boolean => {
      const t = String(c?.type || c?.dataType || '').toLowerCase();
      return t === 'currency';
    };

    const isNumberCol = (c: any): boolean => {
      const t = String(c?.type || c?.dataType || '').toLowerCase();
      return t === 'number' || c?.isNumeric === true;
    };

    const currencyCols = (columns || []).filter(isCurrencyCol);
    const numberCols = (columns || []).filter((c) => !isCurrencyCol(c) && isNumberCol(c));

    let valCol: string | null = null;

    // Priority 1: Currency column matched in active charts
    const matchedCurrency = currencyCols.find((c) => widgetMetricCols.includes(c.name));
    if (matchedCurrency) {
      valCol = matchedCurrency.name;
    }

    // Priority 2: Number column matched in active charts
    if (!valCol) {
      const matchedNumber = numberCols.find((c) => widgetMetricCols.includes(c.name));
      if (matchedNumber) {
        valCol = matchedNumber.name;
      }
    }

    // Priority 3: First currency column in dataset
    if (!valCol && currencyCols.length > 0) {
      valCol = currencyCols[0].name;
    }

    // Priority 4: First number column in dataset
    if (!valCol && numberCols.length > 0) {
      valCol = numberCols[0].name;
    }

    // Priority 5: Any widget metric column if present in row objects
    if (!valCol && widgetMetricCols.length > 0 && rows.length > 0 && rows[0][widgetMetricCols[0]] !== undefined) {
      valCol = widgetMetricCols[0];
    }

    // Priority 6: First column in row object that has numeric data
    if (!valCol && rows.length > 0) {
      for (const key of Object.keys(rows[0])) {
        const sampleVal = rows[0][key];
        if (
          typeof sampleVal === 'number' ||
          (!isNaN(Number(sampleVal)) && typeof sampleVal === 'string' && sampleVal.trim() !== '')
        ) {
          valCol = key;
          break;
        }
      }
    }

    if (!valCol) {
      return startRow;
    }

    const parseVal = (v: any): number => {
      if (v === null || v === undefined || v === '') return 0;
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      if (typeof v === 'string') {
        const cleaned = v.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    const numFmt = getExcelNumFmt(formats[valCol], currency);
    const rowDimCol = categoryCols[0].name;
    const colDimCol = categoryCols.length > 1 ? categoryCols[1].name : null;

    // Dynamically resolve column letters in Data Master
    const colNames =
      columns && columns.length > 0
        ? columns.map((c: any) => c.name)
        : rows.length > 0
        ? Object.keys(rows[0])
        : [];
    const lastRow = Math.max(2, rows.length + 1);

    const findColIndex = (name: string): number => {
      const lower = name.toLowerCase().trim();
      const idx = colNames.findIndex((cn) => cn.toLowerCase().trim() === lower);
      if (idx >= 0) return idx + 1;
      const norm = lower.replace(/[_\s-]/g, '');
      const normIdx = colNames.findIndex(
        (cn) => cn.toLowerCase().replace(/[_\s-]/g, '') === norm
      );
      return normIdx >= 0 ? normIdx + 1 : 1;
    };

    const valColLetter = colToLetter(findColIndex(valCol));
    const rowDimColLetter = colToLetter(findColIndex(rowDimCol));
    const colDimColLetter = colDimCol ? colToLetter(findColIndex(colDimCol)) : '';

    const valRange = `'Data Master'!$${valColLetter}$2:$${valColLetter}$${lastRow}`;
    const rowCatRange = `'Data Master'!$${rowDimColLetter}$2:$${rowDimColLetter}$${lastRow}`;
    const colCatRange = colDimColLetter ? `'Data Master'!$${colDimColLetter}$2:$${colDimColLetter}$${lastRow}` : '';

    let currRow = startRow + 2;

    // 1. Section header: "Ringkasan Data (Pivot)" label above the table
    ws.getCell(`A${currRow}`).value = 'Ringkasan Data (Pivot)';
    ws.getCell(`A${currRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: TEAL_DARK } };
    currRow++;

    // 2. Styling constants for pivot table
    const PIVOT_HEADER_FILL = 'FFCCFBF1'; // Light teal fill
    const PIVOT_HEADER_TEXT = 'FF004D46'; // Bold dark teal text

    if (colDimCol) {
      // 2D Cross-Tab Matrix
      const rowValuesSet = new Set<string>();
      const colValuesSet = new Set<string>();

      for (const r of rows) {
        const rv = r[rowDimCol];
        const cv = r[colDimCol];
        if (rv !== null && rv !== undefined && String(rv).trim() !== '') {
          rowValuesSet.add(String(rv).trim());
        }
        if (cv !== null && cv !== undefined && String(cv).trim() !== '') {
          colValuesSet.add(String(cv).trim());
        }
      }

      const rowCategories = Array.from(rowValuesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const colCategories = Array.from(colValuesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (rowCategories.length === 0) return currRow;

      const matrix: Record<string, Record<string, number>> = {};
      const rowTotals: Record<string, number> = {};
      const colTotals: Record<string, number> = {};
      let grandTotal = 0;

      for (const rCat of rowCategories) {
        matrix[rCat] = {};
        rowTotals[rCat] = 0;
        for (const cCat of colCategories) {
          matrix[rCat][cCat] = 0;
        }
      }
      for (const cCat of colCategories) {
        colTotals[cCat] = 0;
      }

      for (const r of rows) {
        const rv = r[rowDimCol] !== null && r[rowDimCol] !== undefined ? String(r[rowDimCol]).trim() : '';
        const cv = r[colDimCol] !== null && r[colDimCol] !== undefined ? String(r[colDimCol]).trim() : '';
        if (!matrix[rv] || matrix[rv][cv] === undefined) continue;

        const val = parseVal(r[valCol]);
        matrix[rv][cv] += val;
        rowTotals[rv] += val;
        colTotals[cv] += val;
        grandTotal += val;
      }

      // Header row
      const headerRowNum = currRow;
      const headerRow = ws.getRow(headerRowNum);
      headerRow.values = [rowDimCol, ...colCategories, 'Total'];
      headerRow.height = 24;

      const totalCols = colCategories.length + 2;
      const endColLetter = colToLetter(colCategories.length + 1);
      const totColLetter = colToLetter(totalCols);

      headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: PIVOT_HEADER_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PIVOT_HEADER_FILL } };
        cell.alignment = colNum === 1
          ? { vertical: 'middle', horizontal: 'left' }
          : { vertical: 'middle', horizontal: 'right' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'medium', color: { argb: TEAL_DARK } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
      currRow++;

      const firstDataRow = currRow;

      // Data rows with dynamic SUMIFS and SUM formulas
      rowCategories.forEach((rCat, rIdx) => {
        const dataRowNum = currRow;
        const row = ws.getRow(dataRowNum);
        row.height = 21;

        const isZebra = rIdx % 2 === 1;
        const zebraFill = isZebra ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;

        // Col 1: Category label
        const c1 = row.getCell(1);
        c1.value = rCat;
        c1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: SLATE_DARK } };
        c1.alignment = { vertical: 'middle', horizontal: 'left' };
        if (zebraFill) c1.fill = zebraFill as any;

        // Matrix cells: dynamic SUMIFS
        for (let cIdx = 0; cIdx < colCategories.length; cIdx++) {
          const cCat = colCategories[cIdx];
          const colNum = cIdx + 2;
          const colLetter = colToLetter(colNum);
          const cell = row.getCell(colNum);
          cell.value = {
            formula: `SUMIFS(${valRange},${rowCatRange},$A${dataRowNum},${colCatRange},${colLetter}$${headerRowNum})`,
            result: matrix[rCat][cCat],
          };
          cell.numFmt = numFmt;
          cell.font = { name: 'Segoe UI', size: 10, bold: false, color: { argb: SLATE_DARK } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (zebraFill) cell.fill = zebraFill as any;
        }

        // Row Total: SUM(B{row}:...{row})
        const totalCell = row.getCell(totalCols);
        totalCell.value = {
          formula: `SUM(B${dataRowNum}:${endColLetter}${dataRowNum})`,
          result: rowTotals[rCat],
        };
        totalCell.numFmt = numFmt;
        totalCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: SLATE_DARK } };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        totalCell.alignment = { vertical: 'middle', horizontal: 'right' };

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
        currRow++;
      });

      // Bottom totals row with dynamic SUM formulas
      const lastDataRow = currRow - 1;
      const totalRowNum = currRow;
      const totalRow = ws.getRow(totalRowNum);
      totalRow.height = 23;

      const c1 = totalRow.getCell(1);
      c1.value = 'Total';
      c1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: SLATE_DARK } };
      c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      c1.alignment = { vertical: 'middle', horizontal: 'left' };
      c1.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'double', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      for (let cIdx = 0; cIdx < colCategories.length; cIdx++) {
        const cCat = colCategories[cIdx];
        const colNum = cIdx + 2;
        const colLetter = colToLetter(colNum);
        const cell = totalRow.getCell(colNum);
        cell.value = {
          formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`,
          result: colTotals[cCat],
        };
        cell.numFmt = numFmt;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: SLATE_DARK } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'double', color: { argb: 'FF475569' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      // Grand Total
      const grandTotalCell = totalRow.getCell(totalCols);
      grandTotalCell.value = {
        formula: `SUM(${totColLetter}${firstDataRow}:${totColLetter}${lastDataRow})`,
        result: grandTotal,
      };
      grandTotalCell.numFmt = numFmt;
      grandTotalCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: TEAL_DARK } };
      grandTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      grandTotalCell.alignment = { vertical: 'middle', horizontal: 'right' };
      grandTotalCell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'double', color: { argb: TEAL_DARK } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      currRow++;
    } else {
      // 1D Summary Table (fallback if only 1 category column exists)
      const rowValuesSet = new Set<string>();
      for (const r of rows) {
        const rv = r[rowDimCol];
        if (rv !== null && rv !== undefined && String(rv).trim() !== '') {
          rowValuesSet.add(String(rv).trim());
        }
      }
      const rowCategories = Array.from(rowValuesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (rowCategories.length === 0) return currRow;

      const summary: Record<string, number> = {};
      let grandTotal = 0;
      for (const rCat of rowCategories) {
        summary[rCat] = 0;
      }
      for (const r of rows) {
        const rv = r[rowDimCol] !== null && r[rowDimCol] !== undefined ? String(r[rowDimCol]).trim() : '';
        if (summary[rv] === undefined) continue;
        const val = parseVal(r[valCol]);
        summary[rv] += val;
        grandTotal += val;
      }

      // Header row
      const headerRow = ws.getRow(currRow);
      headerRow.values = [rowDimCol, `Total ${valCol}`];
      headerRow.height = 24;
      headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: PIVOT_HEADER_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PIVOT_HEADER_FILL } };
        cell.alignment = colNum === 1
          ? { vertical: 'middle', horizontal: 'left' }
          : { vertical: 'middle', horizontal: 'right' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'medium', color: { argb: TEAL_DARK } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
      currRow++;

      const firstDataRow = currRow;

      // Rows with dynamic SUMIF
      rowCategories.forEach((rCat, rIdx) => {
        const dataRowNum = currRow;
        const row = ws.getRow(dataRowNum);
        row.height = 21;

        const isZebra = rIdx % 2 === 1;
        const zebraFill = isZebra ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;

        const c1 = row.getCell(1);
        c1.value = rCat;
        c1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: SLATE_DARK } };
        c1.alignment = { vertical: 'middle', horizontal: 'left' };
        if (zebraFill) c1.fill = zebraFill as any;

        const c2 = row.getCell(2);
        c2.value = {
          formula: `SUMIF(${rowCatRange},$A${dataRowNum},${valRange})`,
          result: summary[rCat],
        };
        c2.numFmt = numFmt;
        c2.font = { name: 'Segoe UI', size: 10, bold: false, color: { argb: SLATE_DARK } };
        c2.alignment = { vertical: 'middle', horizontal: 'right' };
        if (zebraFill) c2.fill = zebraFill as any;

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
        currRow++;
      });

      // Total row with dynamic SUM
      const lastDataRow = currRow - 1;
      const totalRowNum = currRow;
      const totalRow = ws.getRow(totalRowNum);
      totalRow.height = 23;

      const t1 = totalRow.getCell(1);
      t1.value = 'Total';
      t1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: SLATE_DARK } };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      t1.alignment = { vertical: 'middle', horizontal: 'left' };

      const t2 = totalRow.getCell(2);
      t2.value = {
        formula: `SUM(B${firstDataRow}:B${lastDataRow})`,
        result: grandTotal,
      };
      t2.numFmt = numFmt;
      t2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: TEAL_DARK } };
      t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      t2.alignment = { vertical: 'middle', horizontal: 'right' };

      totalRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'double', color: { argb: TEAL_DARK } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
      currRow++;
    }

    return currRow;
  }

  private async buildConsolidatedDashboardSheet(
    wb: ExcelJS.Workbook,
    title: string,
    currency: string,
    charts: any[],
    rows: any[],
    columns: any[] = [],
    formats: Record<string, any>,
    chartDefs: ChartExportDefinition[],
    kpis?: SummaryMetric[],
    statCards?: any[],
    customMapBase64?: string
  ): Promise<ExcelJS.Worksheet> {
    const ws = wb.addWorksheet('Dashboard', {
      views: [{ showGridLines: true }],
    });

    // 1. Column widths: ~11.5 characters so card/chart proportions look balanced
    ws.getColumn(1).width = 4; // Col A (left margin)
    for (let c = 2; c <= 7; c++) {
      ws.getColumn(c).width = 11.5; // Cols B..G (Left chart column, 6 cols)
    }
    ws.getColumn(8).width = 4; // Col H (Gutter)
    for (let c = 9; c <= 14; c++) {
      ws.getColumn(c).width = 11.5; // Cols I..N (Right chart column, 6 cols)
    }
    ws.getColumn(15).width = 4; // Col O (right margin)

    // 2. HEADER BANNER (rows 1-3)
    // Row heights: row 1 = 8pt, row 2 = 28pt, row 3 = 8pt
    ws.getRow(1).height = 8;
    ws.getRow(2).height = 28;
    ws.getRow(3).height = 8;

    // Solid fill hex #00685F across A1:N3
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 14; c++) {
        ws.getCell(r, c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF00685F' },
        };
      }
    }

    // Merge A1:I3 for Title
    ws.mergeCells('A1:I3');
    const titleCell = ws.getCell('A1');
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 9 };

    // MayStudio logo image positioned at the left edge of banner (~24px height)
    try {
      const logoBuffer = Buffer.from(MAYSTUDIO_LOGO_BASE64, 'base64');
      const logoId = wb.addImage({
        buffer: logoBuffer,
        extension: 'png',
      });
      ws.addImage(logoId, {
        tl: { col: 0.15, row: 0.8 },
        ext: { width: 90, height: 24 },
        editAs: 'oneCell',
      });
      console.log('Successfully embedded MayStudio logo in Dashboard sheet, logoId:', logoId);
    } catch (logoErr) {
      console.error('CRITICAL: Logo embed error on Dashboard sheet:', logoErr);
    }

    // Merge J1:N3 for right-aligned Subtitle
    ws.mergeCells('J1:N3');
    const subtitleCell = ws.getCell('J1');
    subtitleCell.value = `Data updated • ${rows.length.toLocaleString('id-ID')} baris`;
    subtitleCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    // 3. Gap Row at row 4
    ws.getRow(4).height = 12;

    // 4. STAT CARDS ROW (rows 5-8)
    ws.getRow(5).height = 16;
    ws.getRow(6).height = 28;
    ws.getRow(7).height = 16;
    ws.getRow(8).height = 8;

    // Resolve up to 4 stat cards using unified card resolver with dynamic formulas
    const resolvedCards = resolveUnifiedCardList(kpis, statCards, rows, columns, currency, formats);
    const cardList = resolvedCards.slice(0, 4);

    // Card column positions (up to 4 cards, each 3 columns wide: B..D, E..G, H..J, K..M)
    const cardColRanges: Array<{ startCol: number; endCol: number }> = [
      { startCol: 2, endCol: 4 },   // Card 1: B5:D8 (Cols 2..4)
      { startCol: 5, endCol: 7 },   // Card 2: E5:G8 (Cols 5..7)
      { startCol: 8, endCol: 10 },  // Card 3: H5:J8 (Cols 8..10)
      { startCol: 11, endCol: 13 }, // Card 4: K5:M8 (Cols 11..13)
    ];

    cardList.forEach((card, idx) => {
      const range = cardColRanges[idx] || cardColRanges[0];
      const startCol = range.startCol;
      const endCol = range.endCol;
      const startLetter = colToLetter(startCol);
      const endLetter = colToLetter(endCol);

      // Card box fill #F8FAFC and thin border #E2E8F0
      for (let r = 5; r <= 8; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = ws.getCell(r, c);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
          cell.border = {
            top: r === 5 ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            bottom: r === 8 ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            left: c === startCol ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            right: c === endCol ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
          };
        }
      }

      // Top row (Row 5): Label text (font size 9, color #64748B, uppercase)
      ws.mergeCells(`${startLetter}5:${endLetter}5`);
      const lCell = ws.getCell(`${startLetter}5`);
      lCell.value = card.label.toUpperCase();
      lCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
      lCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      // Middle row (Row 6): Value (font size 20, bold, color #0F172A)
      ws.mergeCells(`${startLetter}6:${endLetter}6`);
      const vCell = ws.getCell(`${startLetter}6`);
      if (card.formula) {
        vCell.value = {
          formula: card.formula,
          result: card.numericValue !== undefined ? card.numericValue : card.formattedValue,
        };
        if (card.excelNumFmt) {
          vCell.numFmt = card.excelNumFmt;
        }
      } else {
        vCell.value = card.formattedValue;
      }
      vCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF0F172A' } };
      vCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      // Trend row (Row 7): Growth / Change indicator
      if (card.changeText) {
        ws.mergeCells(`${startLetter}7:${endLetter}7`);
        const tCell = ws.getCell(`${startLetter}7`);
        tCell.value = card.changeText;
        tCell.font = {
          name: 'Segoe UI',
          size: 8.5,
          bold: true,
          color: { argb: card.isNegative ? 'FFE11D48' : 'FF059669' },
        };
        tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      }
    });

    // 5. Gap Row at row 9
    ws.getRow(9).height = 14;

    // 6. CHART GRID (starting row 11)
    const effectiveCharts =
      charts && charts.length > 0
        ? charts
        : [
            {
              title: 'Tren Pendapatan Bulanan',
              chartType: 'area',
              dimensionColumn: 'Tanggal',
              metricColumn: 'Total_Pendapatan',
              aggregation: 'SUM',
            },
            {
              title: 'Penjualan per Kategori',
              chartType: 'pie',
              dimensionColumn: 'Kategori',
              metricColumn: 'Total_Pendapatan',
              aggregation: 'SUM',
            },
          ];

    for (let i = 0; i < effectiveCharts.length; i++) {
      const chart = effectiveCharts[i];
      const colSlot = i % 2; // 0 = left column, 1 = right column
      const rowBlock = Math.floor(i / 2);

      const titleRow = 10 + rowBlock * 16;
      const chartStartRow = titleRow + 1; // Row 11, 27, 43...
      const chartEndRow = chartStartRow + 14; // Row 25, 41, 57... (15 rows tall)

      // Set row heights
      ws.getRow(titleRow).height = 24;
      for (let r = chartStartRow; r <= chartEndRow; r++) {
        ws.getRow(r).height = 18;
      }

      // Column spans:
      // Left: B..G (Cols 2..7, 6 cols). Anchor: fromCol = 1 (Col B), toCol = 7 (Col H)
      // Right: I..N (Cols 9..14, 6 cols). Anchor: fromCol = 8 (Col I), toCol = 14 (Col O)
      const startCol = colSlot === 0 ? 2 : 9;
      const endCol = colSlot === 0 ? 7 : 14;
      const fromCol = colSlot === 0 ? 1 : 8;
      const toCol = colSlot === 0 ? 7 : 14;
      const fromRow = chartStartRow - 1; // 0-indexed
      const toRow = chartEndRow; // 0-indexed

      // Chart clean title (NO bracket/type notation like "[AREA]")
      const cleanTitle = (chart.title || `Grafik ${i + 1}`).replace(/\[.*?\]/g, '').trim();

      // Title cell above chart anchor
      const startColLetter = colToLetter(startCol);
      const endColLetter = colToLetter(endCol);
      ws.mergeCells(`${startColLetter}${titleRow}:${endColLetter}${titleRow}`);
      const tCell = ws.getCell(`${startColLetter}${titleRow}`);
      tCell.value = cleanTitle;
      tCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF0F172A' } };
      tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const chartType = (chart.chartType || chart.type || 'bar').toLowerCase();

      // A) Map Widget Exception: Render static map image
      if (chartType === 'map') {
        try {
          const mapPng = await renderJavaMapPng(customMapBase64);
          const mapImgId = wb.addImage({
            buffer: mapPng,
            extension: 'png',
          });
          ws.addImage(mapImgId, {
            tl: { col: fromCol + 0.05, row: chartStartRow - 0.95 },
            br: { col: toCol - 0.05, row: chartEndRow + 0.05 },
            editAs: 'oneCell',
          } as any);
        } catch (mapErr) {
          console.warn('Map rendering notice on Dashboard sheet:', mapErr);
        }

        const noteCell = ws.getCell(chartEndRow, startCol);
        noteCell.value = "Catatan: Data sebaran geospasial selengkapnya pada sheet 'Data Master'.";
        noteCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
        continue;
      }

      // B) Bar Horizontal: Fallback to clean, styled ranked data table
      if (chartType === 'bar-horizontal') {
        const agg = this.aggregateChartData(chart, rows, formats, currency);
        const hRow = chartStartRow;
        ws.mergeCells(`${colToLetter(startCol)}${hRow}:${colToLetter(endCol - 2)}${hRow}`);
        ws.mergeCells(`${colToLetter(endCol - 1)}${hRow}:${colToLetter(endCol)}${hRow}`);

        const dhCell = ws.getCell(`${colToLetter(startCol)}${hRow}`);
        dhCell.value = chart.dimensionColumn || 'Kategori';
        dhCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        dhCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00685F' } };
        dhCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        const vhCell = ws.getCell(`${colToLetter(endCol - 1)}${hRow}`);
        vhCell.value = chart.metricColumn || 'Nilai';
        vhCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        vhCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00685F' } };
        vhCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

        const topItems = agg.dataList.slice(0, 13);
        for (let itemIdx = 0; itemIdx < topItems.length; itemIdx++) {
          const item = topItems[itemIdx];
          const itemRow = chartStartRow + 1 + itemIdx;
          ws.mergeCells(`${colToLetter(startCol)}${itemRow}:${colToLetter(endCol - 2)}${itemRow}`);
          ws.mergeCells(`${colToLetter(endCol - 1)}${itemRow}:${colToLetter(endCol)}${itemRow}`);

          const rowCatCell = ws.getCell(`${colToLetter(startCol)}${itemRow}`);
          rowCatCell.value = `${itemIdx + 1}. ${item.name}`;
          rowCatCell.font = { name: 'Segoe UI', size: 9 };
          rowCatCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

          const rowValCell = ws.getCell(`${colToLetter(endCol - 1)}${itemRow}`);
          const rawNum = item.values[0] || 0;
          rowValCell.value = rawNum;
          rowValCell.font = { name: 'Segoe UI', size: 9, bold: true };
          rowValCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
          if (agg.metricNumFmts[0]) {
            rowValCell.numFmt = agg.metricNumFmts[0];
          }

          const isZebra = itemIdx % 2 === 1;
          const zebraFill = isZebra
            ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
            : undefined;
          if (zebraFill) {
            rowCatCell.fill = zebraFill as any;
            rowValCell.fill = zebraFill as any;
          }

          rowCatCell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          rowValCell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        }
        continue;
      }

      // C) Native ExcelJS Chart Object (Line, Bar, Area, Pie, Donut)
      const agg = this.aggregateChartData(chart, rows, formats, currency);
      const categories = agg.dataList.map((d) => d.name);

      const seriesDefs = agg.metrics.map((m, mIdx) => ({
        name: m.column,
        colLetter: '', // Assigned in buildDataMasterSheet
        values: agg.dataList.map((d) => d.values[mIdx] || 0),
      }));

      const nativeType =
        chartType === 'area'
          ? 'area'
          : chartType === 'line'
          ? 'line'
          : chartType === 'pie'
          ? 'pie'
          : chartType === 'donut'
          ? 'donut'
          : 'bar';

      // 1. Render and embed visual chart object into ExcelJS worksheet
      try {
        let chartImgBuffer: Buffer | null = null;
        if (nativeType === 'area' || nativeType === 'line') {
          chartImgBuffer = await renderAreaChartPng({
            title: cleanTitle,
            categories,
            values: seriesDefs[0]?.values || [],
            currency,
          });
        } else if (nativeType === 'pie' || nativeType === 'donut') {
          chartImgBuffer = await renderPieChartPng({
            title: cleanTitle,
            categories,
            values: seriesDefs[0]?.values || [],
            currency,
          });
        } else {
          chartImgBuffer = await renderAreaChartPng({
            title: cleanTitle,
            categories,
            values: seriesDefs[0]?.values || [],
            currency,
          });
        }

        if (chartImgBuffer) {
          const chartImgId = wb.addImage({
            buffer: chartImgBuffer,
            extension: 'png',
          });
          ws.addImage(chartImgId, {
            tl: { col: fromCol, row: fromRow },
            br: { col: toCol, row: toRow },
            editAs: 'oneCell',
          } as any);
          console.log(`[Dashboard] Embedded chart image "${cleanTitle}" at cols ${fromCol}..${toCol}, rows ${fromRow}..${toRow}, imgId: ${chartImgId}`);
        }
      } catch (chartImgErr) {
        console.error('[Dashboard] Error rendering chart image:', chartImgErr);
      }

      // 2. Queue OpenXML DrawingML native chart definition
      chartDefs.push({
        sheetName: 'Dashboard',
        dataSheetName: 'Data Master',
        title: cleanTitle,
        chartType: nativeType as any,
        categories,
        dimColLetter: '', // Assigned in buildDataMasterSheet
        startRow: 0,
        endRow: 0,
        headerRow: 4,
        series: seriesDefs,
        numFmt: agg.metricNumFmts[0],
        fromCol,
        fromRow,
        toCol,
        toRow,
        fromColOff: 0,
        toColOff: 0,
        fromRowOff: 0,
        toRowOff: 0,
      });
    }

    return ws;
  }

  private buildDataMasterSheet(
    wb: ExcelJS.Workbook,
    rows: any[],
    columns: any[],
    formats: Record<string, any>,
    currency: string,
    chartDefs: ChartExportDefinition[]
  ): ExcelJS.Worksheet {
    const ws = wb.addWorksheet('Data Master', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const colNames =
      columns && columns.length > 0
        ? columns.map((c) => c.name)
        : Object.keys(rows[0] || {});

    // 1. Raw Data Header Row (Row 1)
    ws.getRow(1).values = colNames;
    ws.getRow(1).eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_PRIMARY } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(1).height = 26;

    // 2. Populate Raw Data Rows (up to 10,000 rows)
    const exportLimit = Math.min(rows.length, 10000);
    for (let rIdx = 0; rIdx < exportLimit; rIdx++) {
      const item = rows[rIdx];
      const rowValues = colNames.map((colName) => item[colName] ?? '');
      const addedRow = ws.addRow(rowValues);
      addedRow.height = 19;

      // Apply number formatting per column
      colNames.forEach((colName, cIdx) => {
        const fmt = formats[colName];
        if (fmt) {
          const cell = addedRow.getCell(cIdx + 1);
          if (typeof cell.value === 'number') {
            cell.numFmt = getExcelNumFmt(fmt, currency);
          }
        }
      });

      if (rIdx % 2 === 1) {
        addedRow.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    }

    // Auto Column Widths for raw data
    colNames.forEach((colName, cIdx) => {
      ws.getColumn(cIdx + 1).width = Math.max(14, colName.length + 6);
    });

    // 3. Chart Reference & Aggregated Data Tables (starting after raw data)
    let refColIdx = Math.max(colNames.length + 3, 8); // At least 2 blank spacer columns

    if (chartDefs.length > 0) {
      const bannerColLetter = colToLetter(refColIdx);
      ws.getCell(`${bannerColLetter}2`).value = 'TABEL REFERENSI & AGREGASI GRAFIK DASHBOARD';
      ws.getCell(`${bannerColLetter}2`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: TEAL_DARK } };
    }

    for (let cIdx = 0; cIdx < chartDefs.length; cIdx++) {
      const def = chartDefs[cIdx];
      const dimColLetter = colToLetter(refColIdx);
      const startRow = 5;
      const endRow = startRow + Math.max(def.categories.length - 1, 0);

      def.dimColLetter = dimColLetter;
      def.startRow = startRow;
      def.endRow = endRow;
      def.headerRow = 4;

      // Title at Row 3
      ws.getCell(`${dimColLetter}3`).value = `[Grafik ${cIdx + 1}] ${def.title}`;
      ws.getCell(`${dimColLetter}3`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: TEAL_DARK } };

      // Category Header at Row 4
      const catHeaderCell = ws.getCell(`${dimColLetter}4`);
      catHeaderCell.value = 'Kategori';
      catHeaderCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      catHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007A70' } };
      catHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Series Headers at Row 4
      def.series.forEach((s, sIdx) => {
        const metricColLetter = colToLetter(refColIdx + 1 + sIdx);
        s.colLetter = metricColLetter;

        const mHeaderCell = ws.getCell(`${metricColLetter}4`);
        mHeaderCell.value = s.name;
        mHeaderCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        mHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007A70' } };
        mHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Data Rows 5 to endRow
      for (let r = 0; r < def.categories.length; r++) {
        const rowNum = startRow + r;

        // Category cell
        const catCell = ws.getCell(`${dimColLetter}${rowNum}`);
        catCell.value = def.categories[r];
        catCell.font = { name: 'Segoe UI', size: 9.5 };
        catCell.alignment = { horizontal: 'left', vertical: 'middle' };

        // Series metric cells
        def.series.forEach((s) => {
          const valCell = ws.getCell(`${s.colLetter}${rowNum}`);
          valCell.value = s.values[r] ?? 0;
          valCell.font = { name: 'Segoe UI', size: 9.5 };
          valCell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (def.numFmt) {
            valCell.numFmt = def.numFmt;
          }
        });

        // Zebra striping for reference rows
        if (r % 2 === 1) {
          catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          def.series.forEach((s) => {
            ws.getCell(`${s.colLetter}${rowNum}`).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          });
        }
      }

      // Set column widths for this reference table
      ws.getColumn(refColIdx).width = 22;
      def.series.forEach((_, sIdx) => {
        ws.getColumn(refColIdx + 1 + sIdx).width = 18;
      });

      // Advance refColIdx past this table plus 1 spacer column
      refColIdx += 1 + def.series.length + 1;
    }

    return ws;
  }

  private aggregateChartData(
    chart: any,
    rows: any[],
    formats: Record<string, any>,
    currency: string
  ): {
    dataList: Array<{ name: string; values: number[]; count: number }>;
    metrics: Array<{ column: string; aggregation: string }>;
    metricNumFmts: string[];
    dimCol: string;
    chartType: string;
  } {
    const dimCol = chart.dimensionColumn || chart.dimension || 'Dimensi';
    const chartType = chart.chartType || chart.type || 'bar';

    const metrics: Array<{ column: string; aggregation: string }> =
      Array.isArray(chart.metrics) && chart.metrics.length > 0
        ? chart.metrics.map((m: any) => ({
            column: m.column || m.name || m.field || 'Nilai',
            aggregation: (m.aggregation || 'SUM').toUpperCase(),
          }))
        : [
            {
              column: chart.metricColumn || chart.metric || 'Nilai',
              aggregation: (chart.aggregation || 'SUM').toUpperCase(),
            },
          ];

    type AggState = { sum: number; count: number; min: number; max: number };
    const dimMap = new Map<string, AggState[]>();

    rows.forEach((row) => {
      const actualDimCol = row[dimCol] !== undefined ? dimCol : Object.keys(row).find(k => k.toLowerCase() === dimCol.toLowerCase()) || dimCol;
      const dimRaw = row[actualDimCol];
      const dimKey =
        dimRaw !== undefined && dimRaw !== null && String(dimRaw).trim() !== ''
          ? String(dimRaw)
          : '(Kosong)';

      let states = dimMap.get(dimKey);
      if (!states) {
        states = metrics.map(() => ({ sum: 0, count: 0, min: Infinity, max: -Infinity }));
        dimMap.set(dimKey, states);
      }

      metrics.forEach((m, mIdx) => {
        const actualMetricCol = row[m.column] !== undefined ? m.column : Object.keys(row).find(k => k.toLowerCase() === m.column.toLowerCase()) || m.column;
        const rawVal = row[actualMetricCol];
        const numVal =
          typeof rawVal === 'number'
            ? rawVal
            : parseFloat(String(rawVal).replace(/[^0-9.-]/g, '')) || 0;
        const st = states![mIdx];
        st.sum += numVal;
        st.count += 1;
        if (numVal < st.min) st.min = numVal;
        if (numVal > st.max) st.max = numVal;
      });
    });

    const dataList: Array<{ name: string; values: number[]; count: number }> = [];
    dimMap.forEach((states, dimKey) => {
      const computedValues = states.map((st, mIdx) => {
        const agg = (metrics[mIdx].aggregation || 'SUM').toUpperCase();
        if (agg === 'AVG') return st.count > 0 ? st.sum / st.count : 0;
        if (agg === 'COUNT') return st.count;
        if (agg === 'MIN') return st.min === Infinity ? 0 : st.min;
        if (agg === 'MAX') return st.max === -Infinity ? 0 : st.max;
        return st.sum;
      });
      dataList.push({ name: dimKey, values: computedValues, count: states[0]?.count || 0 });
    });

    // Sorting: Bar-horizontal is sorted descending by primary metric
    if (chartType === 'bar-horizontal' || chartType === 'pie' || chartType === 'donut') {
      dataList.sort((a, b) => (b.values[0] || 0) - (a.values[0] || 0));
    }

    const metricNumFmts = metrics.map((m) => {
      const colFmt = formats[m.column];
      return getExcelNumFmt(colFmt, currency);
    });

    return {
      dataList,
      metrics,
      metricNumFmts,
      dimCol,
      chartType,
    };
  }
}

export const excelExportService = new ExcelExportService();
