import { Workbook, Worksheet } from 'exceljs';
import { MonthlyDataRow } from '../types';

const TEAL_HEADER = 'FF00685F';

function styleHeaderRow(ws: Worksheet): void {
  ws.getRow(1).values = ['Bulan', 'Pendapatan (Juta Rp)'];
  ws.getRow(1).eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 26;
}

function populateMonthlyRows(ws: Worksheet, data: MonthlyDataRow[]): void {
  data.forEach((row, index) => {
    const r = ws.addRow([row.month, row.revenue]);
    const numCell = r.getCell(2);
    numCell.numFmt = '#,##0';
    numCell.alignment = { horizontal: 'right' };
    if (index % 2 === 1) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });
}

export function buildMonthlySheet(wb: Workbook, data: MonthlyDataRow[]): Worksheet {
  const ws = wb.addWorksheet('Data Bulanan', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });
  styleHeaderRow(ws);
  populateMonthlyRows(ws, data);
  ws.columns = [{ width: 20 }, { width: 26 }];
  return ws;
}
