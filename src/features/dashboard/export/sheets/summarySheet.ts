import { Workbook, Worksheet } from 'exceljs';
import { ExcelExportOptions, SummaryMetric } from '../types';

const TEAL_HEADER = 'FF00685F';
const TEAL_TITLE = 'FF004D46';

function addTitleSection(ws: Worksheet, options: ExcelExportOptions): void {
  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = options.dashboardTitle || 'Executive Financial & Growth Overview';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_TITLE } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 42;

  const exportDate = (options.exportedAt || new Date()).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ws.mergeCells('A2:E2');
  const subCell = ws.getCell('A2');
  subCell.value = `Dibuat dengan MayStudio • Diekspor pada ${exportDate}`;
  subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 24;
}

function addMetricsHeader(ws: Worksheet): void {
  ws.getCell('A4').value = 'RINGKASAN METRIK UTAMA';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: TEAL_HEADER } };

  ws.getRow(5).values = ['Metrik', 'Nilai', 'Pertumbuhan', 'Catatan Target'];
  ws.getRow(5).eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(5).height = 26;
}

function addMetricsRows(ws: Worksheet, metrics: SummaryMetric[]): void {
  metrics.forEach((m) => {
    ws.addRow([m.label, m.value, m.changePercentage, m.notes]);
  });
  ws.getCell('B6').numFmt = '"Rp" #,##0';
  ws.getCell('B7').numFmt = '#,##0';
  ws.getCell('B8').numFmt = '0.00%';
}

export function buildSummarySheet(wb: Workbook, options: ExcelExportOptions, metrics: SummaryMetric[]): Worksheet {
  const ws = wb.addWorksheet('Ringkasan', { views: [{ showGridLines: true }] });
  addTitleSection(ws, options);
  addMetricsHeader(ws);
  addMetricsRows(ws, metrics);
  ws.columns = [{ width: 32 }, { width: 22 }, { width: 16 }, { width: 32 }];
  return ws;
}
